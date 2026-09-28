'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('GUS launches only by approved proposal through existing main spawn authority', () => {
  const host = read('src/main/worldHelperHost.ts');
  const main = read('src/main/index.ts');
  assert.match(host, /approveProposal\s*\(/);
  assert.match(host, /this\.pending\s*=\s*null[\s\S]*?this\.deps\.launch\(request\)/);
  assert.match(main, /spawnAgentCore\(\{[\s\S]*?hive:\s*\{ id:\s*safeId/);
  assert.match(main, /requestCommand,\s*requestProvider:\s*provider/);
  assert.match(host, /safeContext = \{[\s\S]*?tasks: context\.tasks\.filter\(\(task\) => task\.status !== 'done'\)\.slice\(-8\)/);
  assert.doesNotMatch(host, /shellScript|execFile|child_process|spawn\(/);
  assert.match(main, /world-helper:approve'[\s\S]*?approveProposal\(proposalId, selectedNames\)/);
});

test('stopping GUS does not stop Munder workers and collapsed UI leaves main host alive', () => {
  const host = read('src/main/worldHelperHost.ts');
  const stop = host.slice(host.indexOf('async stop()'), host.indexOf('async dismissSetup()'));
  assert.match(stop, /this\.deps\.state\.enabled = false/);
  assert.doesNotMatch(stop, /kill|terminate|pty|workerStop/);
  const view = read('src/renderer/src/components/WorldHelperSurface.tsx');
  assert.match(view, /Launch target \(bound to this approval\)/);
  assert.match(view, /Minimize GUS/);
  assert.match(view, /setExpanded\(false\)/);
  assert.match(view, /Stop Helper/);
  const main = read('src/main/index.ts');
  assert.match(main, /hive\.addTaskStatusObserver/);
  assert.match(main, /ptyManager\.setExitHandler/);
  assert.match(main, /worldHelperHost\?\.observe/);
  assert.match(main, /if \(!worldHelperHost\?\.getSnapshot\(\)\.enabled\) return/);
});

test('provider networking and Hive truth are main-side; helper surface crosses only typed IPC', () => {
  const view = read('src/renderer/src/components/WorldHelperSurface.tsx');
  const preload = read('src/preload/worldHelperOverlay.ts');
  const providers = read('src/main/worldHelperProviders.ts');
  assert.doesNotMatch(view, /fetch\s*\(/);
  assert.match(view, /bridge\.chat\(/);
  assert.match(view, /bridge\.approve\(/);
  assert.match(providers, /globalThis\.fetch/);
  assert.match(preload, /ipcRenderer\.invoke\('world-helper:overlay-snapshot'/);
  assert.match(preload, /onStream:/);
  assert.match(preload, /onState:/);
});
