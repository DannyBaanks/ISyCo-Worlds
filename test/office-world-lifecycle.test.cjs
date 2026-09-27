'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const office = fs.readFileSync(path.join(process.cwd(), 'src/renderer/src/scene/office/OfficeFloor.tsx'), 'utf8');

test('OfficeFloor reports READY only after its resources, scene, and first render are complete', () => {
  assert.match(office, /onReady\??:\s*\(\)\s*=>\s*void/);
  const textures = office.indexOf('await Promise.all');
  const scene = office.indexOf('new TiledMapRenderer');
  const firstRender = office.indexOf('app.renderer.render(app.stage)');
  const ready = office.lastIndexOf('reportReady()');
  assert.ok(textures >= 0 && scene > textures && firstRender > scene && ready > firstRender);
});

test('OfficeFloor forwards structured async failures instead of leaving its own error canvas mounted', () => {
  assert.match(office, /onRenderFailure\??:\s*\(cause: unknown\)\s*=>\s*void/);
  assert.match(office, /reportFailure\(err\)/);
  assert.match(office, /onGiveUp:[\s\S]*reportFailure\(/);
  assert.match(office, /const onTick = \(ticker: Ticker\) => \{[\s\S]*catch \(err\)[\s\S]*reportFailure\(err\)/);
});

test('OfficeFloor has a guarded cleanup path for each mounted Pixi application', () => {
  assert.match(office, /return \(\) => \{[\s\S]*appRef\.current = null;[\s\S]*if \(initSettled\) finalizeDisposal\(\)/);
  assert.match(office, /const finalizeDisposal = \(\) => \{[\s\S]*safeDestroy\(app\);[\s\S]*onDisposed\?\.\(\)/);
  assert.match(office, /\.finally\(\(\) => \{[\s\S]*if \(mountIdRef\.current !== mountId\) finalizeDisposal\(\)/, 'a late async init is released before the next candidate is admitted');
  assert.match(office, /function safeDestroy\(app: Application\)[\s\S]*app\.ticker\?\.stop\(\)[\s\S]*app\.destroy\(true/);
});
