'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');
const art = loadTs('src/renderer/src/worlds/monster/monsterArt.ts');

const profile = (agentId, speciesId) => ({
  version: 1,
  agentId,
  seed: `isyco-worlds:v1:${agentId}`,
  appearances: { 'monster-trainer': { speciesId } },
  updatedAt: 'derived'
});

test('catalog defines ten original species with baby, middle, and final forms', () => {
  assert.equal(art.MONSTER_SPECIES.length, 10);
  const ids = new Set();
  for (const species of art.MONSTER_SPECIES) {
    ids.add(species.id);
    assert.deepEqual(Object.keys(species.forms), ['baby', 'middle', 'final']);
    assert.equal(new Set(Object.values(species.forms).map((form) => form.name)).size, 3,
      `${species.id} has a distinct name at each evolution stage`);
  }
  assert.equal(ids.size, 10, 'each species has a stable unique id');
});

test('each species keeps its palette and develops a distinct authored silhouette at both evolutions', () => {
  for (const species of art.MONSTER_SPECIES) {
    const forms = ['baby', 'middle', 'final'].map((stage) => art.creatureFramePlan(profile(species.id, species.id), {
      stage, action: 'idle', direction: 'down', frame: 0
    }));
    assert.ok(forms.every((form) => form.speciesId === species.id), `${species.id} stays assigned`);
    assert.ok(forms.every((form) => form.palette.join(',') === forms[0].palette.join(',')), `${species.id} keeps its palette`);
    assert.equal(new Set(forms.map((form) => JSON.stringify(form.blocks))).size, 3,
      `${species.id} has three individually authored stage silhouettes`);
    for (const form of forms) {
      for (const block of form.blocks) {
        assert.ok(block.x >= 0 && block.y >= 0 && block.x + block.w <= form.width && block.y + block.h <= form.height,
          `${species.id}/${form.stage} stays inside the sprite cell`);
      }
    }
  }
});

test('every base species is visually distinct at the in-world worker size', () => {
  const silhouettes = art.MONSTER_SPECIES.map((species) => JSON.stringify(art.creatureFramePlan(profile(species.id, species.id), {
    stage: 'baby', action: 'idle', direction: 'down', frame: 0
  }).blocks));
  assert.equal(new Set(silhouettes).size, art.MONSTER_SPECIES.length);
});

test('unrecognized species overrides fail closed to the stable seeded species', () => {
  const raw = { version: 1, agentId: 'a', seed: 'same-seed', appearances: {}, updatedAt: 'derived' };
  const invalid = { ...raw, appearances: { 'monster-trainer': { speciesId: 'not-a-species' } } };
  assert.equal(typeof art.creaturePlan(raw).speciesId, 'string');
  assert.equal(art.creaturePlan(invalid).speciesId, art.creaturePlan(raw).speciesId);
});
