#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn, execFileSync } = require('node:child_process');
const { once } = require('node:events');

const root = path.join(__dirname, '..');
const pkg = require('../package.json');

function parseArgs(argv) {
  const [platform, ...rest] = argv;
  let executable = null;
  let appArgs = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--executable' && rest[i + 1]) {
      executable = rest[++i];
    } else if (rest[i] === '--app-args' && rest[i + 1]) {
      appArgs = JSON.parse(rest[++i]);
    } else {
      throw new Error(`unknown argument: ${rest[i]}`);
    }
  }
  if (!['win', 'linux'].includes(platform)) {
    throw new Error('usage: node scripts/smoke-release-app.cjs <win|linux> [--executable <path> --app-args <json-array>]');
  }
  if (!Array.isArray(appArgs) || !appArgs.every((arg) => typeof arg === 'string')) {
    throw new Error('--app-args must be a JSON array of strings');
  }
  return { platform, executable: executable || resolveExecutable(platform), appArgs };
}

function resolveExecutable(platform) {
  if (platform === 'win') return path.join(root, 'dist', 'win-unpacked', 'ISyCo Worlds.exe');
  return path.join(root, 'dist', 'linux-unpacked', pkg.name);
}

function timeoutMs() {
  const configured = Number(process.env.ISYCO_RELEASE_SMOKE_TIMEOUT_MS);
  return Number.isInteger(configured) && configured >= 1000 && configured <= 120_000 ? configured : 60_000;
}

function appendTail(current, chunk) {
  return `${current}${chunk}`.slice(-8000);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readHealthConfig(file) {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Number.isInteger(value.port) && value.port > 0 && value.port <= 65535 && typeof value.token === 'string' && value.token) {
      return value;
    }
  } catch { /* not written yet, or an atomic write is in progress */ }
  return null;
}

function requestHealth(config) {
  return new Promise((resolve, reject) => {
    const request = http.get({
      host: '127.0.0.1',
      port: config.port,
      path: '/salud',
      headers: { authorization: `Bearer ${config.token}` },
      timeout: 3000
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (response.statusCode !== 200) throw new Error(`health endpoint returned HTTP ${response.statusCode}`);
          resolve(body);
        } catch (error) { reject(error); }
      });
    });
    request.on('timeout', () => request.destroy(new Error('health request timed out')));
    request.on('error', reject);
  });
}

async function stopProcess(child, platform) {
  if (!child || child.exitCode !== null || child.pid == null) return;
  if (platform === 'win') {
    try { execFileSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* exited between check and kill */ }
    await Promise.race([child.exitCode !== null ? Promise.resolve() : once(child, 'exit').catch(() => {}), delay(1500)]);
    return;
  }
  try { process.kill(-child.pid, 'SIGTERM'); } catch { /* process group already exited */ }
  await Promise.race([once(child, 'exit').catch(() => {}), delay(1500)]);
  if (child.exitCode === null) {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { /* process group already exited */ }
  }
}

async function removeTemporaryData(tempRoot) {
  const resolvedTemp = path.resolve(tempRoot);
  const resolvedOsTemp = path.resolve(os.tmpdir());
  if (!resolvedTemp.startsWith(`${resolvedOsTemp}${path.sep}`)) {
    throw new Error(`refusing to remove smoke data outside the temporary directory: ${resolvedTemp}`);
  }

  for (let attempt = 0; attempt < 25; attempt++) {
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
      return;
    } catch (error) {
      if (!['EBUSY', 'EPERM', 'EACCES', 'ENOTEMPTY'].includes(error?.code) || attempt === 24) throw error;
      await delay(200);
    }
  }
}

async function runSmoke({ platform, executable, appArgs }) {
  if (!fs.existsSync(executable) || !fs.statSync(executable).isFile()) {
    throw new Error(`packaged app executable not found: ${executable}`);
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'isyco-worlds-release-smoke-'));
  const home = path.join(tempRoot, 'home');
  const temp = path.join(tempRoot, 'tmp');
  const appData = platform === 'win' ? path.join(home, 'AppData', 'Roaming') : path.join(home, '.config');
  const userData = path.join(appData, pkg.name);
  const harnessHome = path.join(tempRoot, 'harness');
  const controlFile = path.join(userData, 'munder-control.json');
  fs.mkdirSync(userData, { recursive: true });
  fs.mkdirSync(temp, { recursive: true });
  fs.mkdirSync(harnessHome, { recursive: true });
  fs.writeFileSync(path.join(userData, 'config.json'), JSON.stringify({ onboardingComplete: true, harnessHome }));

  const env = {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    APPDATA: appData,
    LOCALAPPDATA: path.join(home, 'AppData', 'Local'),
    XDG_CONFIG_HOME: appData,
    TEMP: temp,
    TMP: temp,
    ISYCO_SMOKE_USER_DATA: userData,
    ISYCO_SMOKE_EXPECT_VERSION: pkg.version
  };
  const args = [...appArgs, '--disable-gpu'];
  if (platform === 'linux') args.push('--no-sandbox');

  let child;
  let stdout = '';
  let stderr = '';
  try {
    child = spawn(executable, args, {
      cwd: path.dirname(executable),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: platform === 'linux'
    });
    child.stdout.on('data', (chunk) => { stdout = appendTail(stdout, chunk); });
    child.stderr.on('data', (chunk) => { stderr = appendTail(stderr, chunk); });
    const startError = new Promise((_, reject) => child.once('error', reject));
    const deadline = Date.now() + timeoutMs();
    let health;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`packaged app exited ${child.exitCode}; stdout=${stdout}; stderr=${stderr}`);
      const config = readHealthConfig(controlFile);
      if (config) {
        try { health = await requestHealth(config); break; }
        catch (error) {
          if (Date.now() + 1000 >= deadline) throw error;
        }
      }
      await Promise.race([delay(250), startError]);
    }
    if (!health) throw new Error(`timed out waiting for packaged app health; stdout=${stdout}; stderr=${stderr}`);
    if (health.ok !== true || health.service !== 'munder-control' || health.instance?.version !== pkg.version || !Number.isInteger(health.instance?.pid)) {
      throw new Error(`unexpected health response: ${JSON.stringify(health)}`);
    }
    console.log(`release app health OK: service=${health.service} version=${health.instance.version} pid=${health.instance.pid}`);
  } finally {
    await stopProcess(child, platform);
    await removeTemporaryData(tempRoot);
  }
}

if (require.main === module) {
  try {
    void runSmoke(parseArgs(process.argv.slice(2))).catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}

module.exports = { parseArgs, resolveExecutable, runSmoke };
