'use strict';

/**
 * Regression tests for the second launch clobbering the running instance's
 * munder-control.json — the joint discovery file CLI/phone clients read.
 *
 * The live defect (reproduced on the v0.4.0 dev build and packaged AppImage):
 * launching the app a second time starts a process that LOSES the
 * single-instance race, sets allowQuit and calls app.quit() — but module
 * evaluation continues and Electron still fires the ready callback during the
 * graceful quit. The dying process then ran the whole boot: bound broker,
 * control and telemetry ports and overwrote munder-control.json with ITS
 * ports, which died with it ~1.5 s later. The first instance stayed up but its
 * advertised control port was gone (ECONNREFUSED) until a restart.
 *
 * How this is covered:
 *   1. test/electron/single-instance-fixture/main.cjs mirrors that lifecycle
 *      shape in a real Electron process, with SI_GUARDED toggling the fix
 *      (`if (!gotInstanceLock) return;` at the top of the ready callback). The
 *      unguarded run asserts the fixture still REPRODUCES the clobber on the
 *      running Electron, so the guarded run's green is meaningful rather than
 *      vacuous.
 *   2. A source contract pins the real src/main/index.ts: the ready callback
 *      must still early-return for the losing instance, before it reaches
 *      bootstrapHiveServices — the fixture alone cannot guard the real file.
 *
 * Linux hosts without DISPLAY run the fixture under xvfb-run, same as the
 * world-presentation witness. The fixture spawn is detached and reaped by
 * process group so the xvfb-run wrapper can never orphan Xvfb or Electron,
 * whose inherited stdio would otherwise hang the test worker after a green
 * run (the Linux CI step hung exactly that way before the group reap).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'test/electron/single-instance-fixture/main.cjs');
const electron = require('electron');
assert.equal(typeof electron, 'string', 'expected the electron package to export the binary path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function spawnInstance(env) {
  const electronArgs = ['--no-sandbox', '--disable-gpu', fixture];
  const useXvfb = process.platform === 'linux' && !process.env.DISPLAY;
  const command = useXvfb ? 'xvfb-run' : electron;
  const args = useXvfb ? ['-a', electron, ...electronArgs] : electronArgs;

  const childEnv = {
    ...process.env,
    ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    ...env
  };
  delete childEnv.ELECTRON_RUN_AS_NODE; // must launch as Electron, not as Node

  const child = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: childEnv,
    // The child leads its own process group so reap() can tear down xvfb-run,
    // Xvfb and Electron together; see reap().
    detached: process.platform === 'linux'
  });
  let output = '';
  child.on('error', (err) => { output += String(err); });
  child.stdout.on('data', (d) => { output += d; });
  child.stderr.on('data', (d) => { output += d; });
  child.collectedOutput = () => output;
  return child;
}

function waitExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve(child.exitCode ?? child.signalCode);
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve('timeout'), timeoutMs);
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      resolve(code ?? signal);
    });
    child.on('error', () => {
      clearTimeout(timer);
      resolve('spawn-error');
    });
  });
}

function reap(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') {
    // Same process-tree reap as quit-sweep: on Windows a child is not killed
    // when its parent exits, and taskkill /T is the synchronous sweep.
    try { execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { timeout: 10_000 }); } catch { /* already gone */ }
  } else if (process.platform === 'linux') {
    // The child leads its own process group (detached spawn), so the signal
    // reaches xvfb-run, Xvfb and every Electron process at once. Killing only
    // the xvfb-run wrapper orphans Electron, whose inherited stdout/stderr
    // pipes keep this test worker's event loop alive: the run then never
    // finishes even though every test already passed.
    try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already gone */ }
  } else {
    child.kill('SIGTERM');
  }
}

async function reapAndWait(child, timeoutMs = 10_000) {
  reap(child);
  let exit = await waitExit(child, timeoutMs);
  if (exit === 'timeout' && process.platform === 'linux') {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ }
    exit = await waitExit(child, 5_000);
  }
  return exit;
}

async function waitForControlFile(file, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      await sleep(100);
    }
  }
  return null;
}

async function launchPair(guarded) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'second-instance-'));
  const controlFile = path.join(dir, 'control.json');
  const env = {
    SI_CONTROL_FILE: controlFile,
    SI_DATA_DIR: path.join(dir, 'data'),
    SI_GUARDED: guarded ? '1' : '0'
  };

  const primary = spawnInstance(env);
  try {
    const first = await waitForControlFile(controlFile, 20_000);
    assert.ok(first, `primary never wrote the control file; output:\n${primary.collectedOutput()}`);

    const secondary = spawnInstance(env);
    const exit = await waitExit(secondary, 30_000);
    assert.equal(exit, 0, `secondary launch must quit cleanly; exited ${exit}; output:\n${secondary.collectedOutput()}`);

    const after = JSON.parse(fs.readFileSync(controlFile, 'utf8'));
    return { first, after, primary };
  } catch (e) {
    await reapAndWait(primary);
    throw e;
  }
}

test('pre-fix shape: the second launch clobbers the primary control file (fixture reproduces the defect)', {
  // Observed on the macOS CI runner: the losing launch quits without ever
  // running the ready callback (expected 15018, actual 15018 — the file kept
  // the primary's), so the defect does not manifest there and this fixture
  // cannot reproduce it. It manifests where ready still fires after the early
  // quit — reproduced on Linux locally and on the Windows CI runner. The
  // guarded test below runs on every platform.
  skip: process.platform === 'darwin'
    ? 'a losing second launch on macOS never runs the ready callback; the defect cannot manifest there'
    : false,
  timeout: 90_000
}, async () => {
  const { first, after, primary } = await launchPair(false);
  try {
    assert.notEqual(after.pid, first.pid, 'the losing instance must have overwritten the control file for this fixture to model the defect');
    assert.notEqual(after.nonce, first.nonce, 'the rewritten file must be the dying instance\'s');
  } finally {
    await reapAndWait(primary);
  }
});

test('fixed shape: the second launch leaves the primary control file intact', { timeout: 90_000 }, async () => {
  const { first, after, primary } = await launchPair(true);
  try {
    assert.deepEqual(after, first, 'the losing instance must never write the control file');
    assert.equal(primary.exitCode, null, 'the primary instance must still be running');
  } finally {
    await reapAndWait(primary);
  }
});

test('src/main/index.ts keeps the losing instance out of the boot path', () => {
  const src = fs.readFileSync(path.join(root, 'src/main/index.ts'), 'utf8');
  const lockAt = src.indexOf('const gotInstanceLock = app.requestSingleInstanceLock()');
  assert.ok(lockAt > 0, 'the single-instance lock must still be requested');

  const whenReadyAt = src.indexOf('app.whenReady()');
  assert.ok(whenReadyAt > lockAt, 'the ready callback must come after the lock');

  const readyBody = src.slice(whenReadyAt);
  const guardAt = readyBody.indexOf('if (!gotInstanceLock) return;');
  assert.ok(guardAt >= 0, 'the ready callback must early-return when the instance lock was not acquired');

  const bootAt = readyBody.indexOf('await bootstrapHiveServices()');
  assert.ok(bootAt > guardAt, 'the guard must run before the hive bootstrap');
});
