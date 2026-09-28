'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const helperPath = path.resolve(__dirname, '../src/renderer/src/worlds/worldPresentationVisibility.ts');

test('the native world yields its rectangle to Marketplace and app-owned overlays, then restores it', () => {
  assert.equal(fs.existsSync(helperPath), true, 'the presentation visibility policy is missing');
  const { shouldSuspendWorldPresentation, resolveWorldPresentationBounds } = loadTs(
    'src/renderer/src/worlds/worldPresentationVisibility.ts'
  );
  const ordinary = {
    globalView: 'office', settingsMenuOpen: false, settingsOpen: false,
    addAgentOpen: false, quitWarningOpen: false, fullscreenOpen: false,
    ideOpen: false, taskDetailOpen: false
  };
  const viewport = { left: 24, top: 60, width: 820, height: 640 };

  assert.equal(shouldSuspendWorldPresentation(ordinary), false);
  assert.deepEqual(resolveWorldPresentationBounds(viewport, true, false), {
    x: 24, y: 60, width: 820, height: 640
  });

  for (const overlay of [
    { globalView: 'marketplace' },
    { settingsMenuOpen: true },
    { settingsOpen: true },
    { addAgentOpen: true },
    { quitWarningOpen: true },
    { fullscreenOpen: true },
    { ideOpen: true },
    { taskDetailOpen: true }
  ]) {
    const state = { ...ordinary, ...overlay };
    assert.equal(shouldSuspendWorldPresentation(state), true, `suspends for ${Object.keys(overlay)[0]}`);
    assert.deepEqual(resolveWorldPresentationBounds(viewport, true, true), {
      x: 0, y: 0, width: 0, height: 0
    });
  }

  assert.deepEqual(resolveWorldPresentationBounds(viewport, false, false), {
    x: 0, y: 0, width: 0, height: 0
  });
});

test('WorldHost is wired to hide only the native presentation bounds, not dispose or restart it', () => {
  const host = fs.readFileSync(path.resolve(__dirname, '../src/renderer/src/worlds/WorldHost.tsx'), 'utf8');
  const app = fs.readFileSync(path.resolve(__dirname, '../src/renderer/src/App.tsx'), 'utf8');

  assert.match(app, /shouldSuspendWorldPresentation\(/);
  assert.match(app, /suspended=\{worldPresentationSuspended\}/);
  assert.match(host, /resolveWorldPresentationBounds\(/);
  assert.match(host, /suspended/);
  assert.doesNotMatch(host.slice(host.indexOf('const update = () =>'), host.indexOf('const observer = new ResizeObserver(update)')), /disposeWorldPresentation|restartWorldPresentation/);
});
