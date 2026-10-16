'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const version = require('../package.json').version;
const smoke = path.join(root, 'scripts', 'smoke-release-app.cjs');
const fixture = path.join(__dirname, 'fixtures', 'release-smoke-app.cjs');
const { parseArgs } = require(smoke);

test('smoke runner resolves relative executables from the repository root', () => {
  const parsed = parseArgs(['linux', '--executable', 'dist/ISyCo-Worlds.AppImage', '--app-args', '[]']);
  assert.equal(parsed.executable, path.join(root, 'dist', 'ISyCo-Worlds.AppImage'));
});

test('packaged-app smoke waits for an authenticated /salud response before succeeding', () => {
  const smokeDirsBefore = new Set(fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith('isyco-worlds-release-smoke-')));
  const platform = process.platform === 'win32' ? 'win' : 'linux';
  const result = spawnSync(process.execPath, [
    smoke,
    platform,
    '--executable', process.execPath,
    '--app-args', JSON.stringify([fixture])
  ], {
    cwd: root,
    encoding: 'utf8',
    timeout: 20_000,
    env: { ...process.env, ISYCO_RELEASE_SMOKE_TIMEOUT_MS: '8000' }
  });

  assert.equal(result.status, 0, `smoke runner failed; stdout=${result.stdout}; stderr=${result.stderr}`);
  assert.ok(
    result.stdout.includes(`release app health OK: service=munder-control version=${version}`),
    `smoke runner reported the wrong version: ${result.stdout}`
  );
  const leaked = fs.readdirSync(os.tmpdir())
    .filter((name) => name.startsWith('isyco-worlds-release-smoke-') && !smokeDirsBefore.has(name));
  assert.deepEqual(leaked, [], 'smoke runner should remove its isolated profile after shutdown');
});
