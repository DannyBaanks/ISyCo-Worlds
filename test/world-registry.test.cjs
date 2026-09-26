'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const registry = fs.readFileSync(path.join(process.cwd(), 'src/renderer/src/worlds/worldRegistry.ts'), 'utf8');

test('registry declares Office as its stable fallback and every world owns a resource manifest', () => {
  assert.match(registry, /FALLBACK_WORLD_ID[^=]*= 'office'/);
  assert.match(registry, /id: 'office'/);
  assert.match(registry, /id: 'monster-trainer'/);
  assert.match(registry, /resources: OFFICE_THEME\.tilesets\.map/);
  assert.match(registry, /STARTER_VILLAGE_SCENARIO/);
  assert.match(registry, /resources: STARTER_VILLAGE_SCENARIO\.resources/);
  assert.match(registry, /render: \(lifecycle\)/);
  assert.match(registry, /world\.id === id/);
});
