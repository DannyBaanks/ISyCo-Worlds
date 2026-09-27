'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const loadTs = require('./load-ts.cjs');
const art = loadTs('src/renderer/src/worlds/monster/monsterArt.ts');

const profile = (agentId, appearances) => ({
  version: 1,
  agentId,
  seed: `munder-worlds:v1:${agentId}`,
  appearances: appearances ?? {},
  updatedAt: 'derived'
});

test('the same seed and appearance produce equal primitives', () => {
  const a = art.creaturePlan(profile('agent-1'));
  const b = art.creaturePlan(profile('agent-1'));
  assert.deepEqual(a, b);
});

test('differing seeds still choose valid variants and palettes', () => {
  for (const id of ['agent-a', 'agent-b', 'agent-c', 'agent-d', 'agent-e']) {
    const plan = art.creaturePlan(profile(id));
    assert.ok(art.MONSTER_VARIANTS.includes(plan.variant), `variant ${plan.variant}`);
    assert.ok(plan.palette.length >= 2, 'palette has at least body and accent');
    for (const color of plan.palette) {
      assert.ok(Number.isInteger(color) && color >= 0 && color <= 0xffffff, `color ${color}`);
    }
  }
});

test('the original catalog has ten distinct species and selects one deterministically', () => {
  assert.ok(Array.isArray(art.MONSTER_CATALOG), 'the catalog is exported as data');
  assert.equal(art.MONSTER_CATALOG.length, 10, 'Starter Village has the first ten species');
  const ids = art.MONSTER_CATALOG.map((species) => species.id);
  assert.equal(new Set(ids).size, 10, 'species ids are unique');
  assert.ok(art.MONSTER_CATALOG.every((species) => species.frame.w === 16 && species.frame.h === 16), 'every species occupies one source-pixel frame');
  assert.deepEqual(art.monsterSpeciesFor(profile('agent-catalog')), art.monsterSpeciesFor(profile('agent-catalog')), 'an agent keeps its species across renders');
});

test('every primitive coordinate and size is a whole pixel', () => {
  for (const id of ['agent-a', 'agent-b', 'agent-c']) {
    const plan = art.creaturePlan(profile(id));
    assert.ok(plan.blocks.length > 0, 'a creature draws at least one block');
    for (const block of plan.blocks) {
      for (const value of [block.x, block.y, block.w, block.h]) {
        assert.ok(Number.isInteger(value), `non-integer value ${value}`);
      }
      assert.ok(block.w > 0 && block.h > 0, 'blocks have area');
    }
  }
});

test('appearance overrides apply only when valid', () => {
  const variant = art.MONSTER_VARIANTS[1] ?? art.MONSTER_VARIANTS[0];
  const valid = art.creaturePlan(profile('agent-1', { 'monster-trainer': { variant } }));
  assert.equal(valid.variant, variant);
  const invalid = art.creaturePlan(profile('agent-1', { 'monster-trainer': { variant: 'pikachu', palette: ['red'] } }));
  assert.ok(art.MONSTER_VARIANTS.includes(invalid.variant), 'invalid variant falls back');
  assert.equal(invalid.variant, art.creaturePlan(profile('agent-1')).variant, 'invalid override equals the seed default');
});

test('each supported state has a distinct non-color-only marker', () => {
  const states = ['idle', 'working', 'blocked', 'awaitsHuman'];
  const shapes = states.map((state) => art.stateMarker(state).shape);
  assert.equal(new Set(shapes).size, states.length, 'every state marker shape is distinct');
});

test('awaiting a human beats the underlying agent state', () => {
  const agent = { id: 'a1', name: 'A', state: 'working', archived: false };
  const tasks = [{ id: 't1', title: 'T', assignee: 'a1', status: 'blocked', awaitsHuman: true }];
  assert.equal(art.visualStateFor(agent, tasks), 'awaitsHuman');
  assert.equal(art.visualStateFor(agent, []), 'working');
});
