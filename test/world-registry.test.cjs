'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');

const Registry = loadTs('src/renderer/src/worlds/worldRegistry.ts');

test('registry keeps Office as the stable default and unknown ids recover there', () => {
  assert.deepEqual(Registry.WORLD_REGISTRY.map((world) => world.id), ['office', 'monster-trainer']);
  assert.equal(Registry.worldById('office').id, 'office');
  assert.equal(Registry.worldById('monster-trainer').experimental, true);
  assert.equal(Registry.worldById('not-a-world').id, 'office');
});
