'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const main = fs.readFileSync('src/main/index.ts', 'utf8');
const app = fs.readFileSync('src/renderer/src/App.tsx', 'utf8');
const config = fs.readFileSync('electron.vite.config.ts', 'utf8');

test('primary BrowserWindow owns a sandboxed helper overlay and restores it above each world child', () => {
  assert.match(main, /function createWorldHelperOverlayView\(win: BrowserWindow\)/);
  assert.match(main, /preload: join\(__dirname, '\.\.\/preload\/worldHelperOverlay\.js'\)/);
  assert.match(main, /sandbox: true/);
  assert.match(main, /win\.contentView\.addChildView\(overlay\)/);
  assert.match(main, /win\.contentView\.addChildView\(view\)[\s\S]*?raiseWorldHelperOverlay/);
  assert.match(main, /overlay\.webContents\.close\(\{ waitForBeforeUnload: false \}\)/);
  assert.match(main, /worldHelperOverlayView = null/);
  assert.match(config, /world-helper-overlay\.html/);
  assert.match(config, /worldHelperOverlay: resolve\(__dirname, 'src\/preload\/worldHelperOverlay\.ts'\)/);
});

test('GUS UI and streaming draft live in the sibling overlay; main App only opens and hides it', () => {
  assert.doesNotMatch(app, /WorldHelperSurface/);
  assert.match(app, /worldHelperOverlayVisible\(/);
  const entry = fs.readFileSync('src/renderer/src/world-helper-overlay.tsx', 'utf8');
  const surface = fs.readFileSync('src/renderer/src/worlds/WorldHelperOverlay.tsx', 'utf8');
  const panel = fs.readFileSync('src/renderer/src/components/WorldHelperSurface.tsx', 'utf8');
  assert.match(entry, /WorldHelperOverlay/);
  assert.match(surface, /WorldHelperSurface/);
  assert.match(panel, /bridge\.onStream/);
  assert.match(panel, /event\.requestId/);
  assert.match(panel, /event\.type === 'delta'/);
  assert.match(panel, /world-helper-stream/);
});
