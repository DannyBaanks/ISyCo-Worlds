'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const preloadPath = 'src/preload/worldHelperOverlay.ts';
const preload = fs.existsSync(preloadPath) ? fs.readFileSync(preloadPath, 'utf8') : '';
const main = fs.readFileSync('src/main/index.ts', 'utf8');

test('dedicated overlay preload exposes only bounded GUS actions and removable stream/state subscriptions', () => {
  assert.match(preload, /exposeInMainWorld\(['"]gusOverlay['"]/);
  for (const capability of ['providers', 'snapshot', 'configure', 'chat', 'approve', 'stop', 'dismissSetup', 'onStream', 'onState']) {
    assert.match(preload, new RegExp(`${capability}:`));
  }
  assert.match(preload, /removeListener\('world-helper:stream'/);
  assert.match(preload, /removeListener\('world-helper:overlay-state'/);
  assert.doesNotMatch(preload, /getSecret|apiKeyGet|ipcRenderer\.send\s*\(/);
});

test('main gates dedicated overlay requests by owned WebContents and routes stream only to that view', () => {
  assert.match(main, /isWorldHelperOverlaySender/);
  assert.match(main, /evt\.sender\.id\s*===\s*contents\.id/);
  assert.match(main, /owner\.send\('world-helper:stream'/);
  assert.match(main, /ensureWorldHelperHost\(\)\.chat\(message,[\s\S]*owner\.send\('world-helper:stream'/);
});

test('overlay state payload is a host-generated safe snapshot, never provider credentials', () => {
  assert.match(main, /worldHelperHost\.subscribe\(\(snapshot\)[\s\S]*?overlayContents\.send\('world-helper:overlay-state',\s*snapshot\)/);
  assert.match(main, /return host\.getSnapshot\(\)/);
  assert.doesNotMatch(main, /world-helper:overlay-state.{0,160}(?:apiKey|secret)/is);
});
