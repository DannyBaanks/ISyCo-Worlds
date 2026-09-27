'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'test/electron/world-presentation-fixture/main.cjs');
const electron = require('electron');

test('Electron visual WebContents owns a separately restartable OS renderer process', { timeout: 30_000 }, () => {
  assert.ok(fs.existsSync(fixture), `fixture exists: ${fixture}`);
  const electronArgs = ['--no-sandbox', fixture];
  let command = electron;
  let args = electronArgs;
  if (process.platform === 'linux' && !process.env.DISPLAY && process.env.WAYLAND_DISPLAY) {
    throw new Error('Electron PID witness needs X11/Xvfb; Wayland-only session is not supported by this test launcher');
  }
  if (process.platform === 'linux' && !process.env.DISPLAY) {
    command = 'xvfb-run';
    args = ['-a', electron, ...electronArgs];
  }

  const stdout = execFileSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 25_000,
    env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const line = stdout.split(/\r?\n/).find((entry) => entry.includes('WORLD_PRESENTATION_PID_WITNESS'));
  assert.ok(line, `fixture emitted witness; output was:\n${stdout}`);
  const witness = JSON.parse(line);
  assert.equal(witness.distinctFromPrimary, true, JSON.stringify(witness));
  assert.equal(witness.primaryPidStable, true, JSON.stringify(witness));
  assert.equal(witness.primaryAliveAfterVisualRestart, true, JSON.stringify(witness));
  assert.equal(witness.visualGenerationRecreated, true, JSON.stringify(witness));
  assert.ok(witness.primaryPid > 0);
  assert.ok(witness.firstVisualPid > 0);
  assert.ok(witness.restartedVisualPid > 0);
});
