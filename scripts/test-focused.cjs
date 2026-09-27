#!/usr/bin/env node
'use strict';
// `npm run test:focused`, the same on every OS. The script used to be
// `node --test test/*.test.cjs`, but npm runs scripts through cmd.exe on
// Windows, which does not expand globs, and Node 20's test runner does not
// either: on Windows the suite never started. List the files here instead.
// Extra args pass through (e.g. `npm run test:focused -- --test-reporter=spec`).
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const files = fs.readdirSync(path.join(root, 'test'))
  .filter((f) => f.endsWith('.test.cjs'))
  .sort()
  .map((f) => path.join('test', f));
const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith('-'));
const selected = args.filter((a) => !a.startsWith('-'));
const suite = selected.length ? selected : files;
const electronWitness = suite.filter((file) => path.basename(file) === 'world-presentation-pid.test.cjs');
const unitTests = suite.filter((file) => path.basename(file) !== 'world-presentation-pid.test.cjs');

function run(filesToRun) {
  if (!filesToRun.length) return 0;
  const result = spawnSync(process.execPath, ['--test', ...flags, ...filesToRun], { cwd: root, stdio: 'inherit' });
  return result.status ?? 1;
}

// This Electron/Xvfb witness starts Chromium GPU and renderer processes. Keep
// it out of Node's parallel file workers: resource contention can kill the
// GPU process before Electron delivers render-process-gone. Run it after the
// regular suite has fully exited, still as part of the same focused command.
const unitStatus = run(unitTests);
if (unitStatus !== 0) process.exit(unitStatus);
process.exit(run(electronWitness));
