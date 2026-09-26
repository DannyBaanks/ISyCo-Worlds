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
