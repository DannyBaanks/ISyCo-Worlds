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

test('creature frames change pose without changing the worker identity or palette', () => {
  assert.equal(typeof art.creatureFramePlan, 'function', 'the renderer needs authored animation poses');
  const identity = profile('agent-willow');
  const idle = art.creatureFramePlan(identity, { stage: 'baby', action: 'idle', direction: 'down', frame: 0 });
  const walk = art.creatureFramePlan(identity, { stage: 'baby', action: 'walk', direction: 'right', frame: 1 });
  const work = art.creatureFramePlan(identity, { stage: 'baby', action: 'work', direction: 'down', frame: 0 });
  assert.equal(idle.variant, walk.variant);
  assert.deepEqual(idle.palette, walk.palette);
  assert.notDeepEqual(idle.blocks, walk.blocks, 'walking changes the silhouette pose');
  assert.notDeepEqual(idle.blocks, work.blocks, 'working has its own readable pose');
  for (const frame of [idle, walk, work]) {
    for (const block of frame.blocks) {
      assert.ok(block.x >= 0 && block.y >= 0 && block.x + block.w <= frame.width && block.y + block.h <= frame.height);
    }
  }
});

test('all three evolution stages keep the same identity while changing the creature silhouette', () => {
  assert.equal(typeof art.creatureFramePlan, 'function', 'evolution needs an explicit visual stage input');
  const identity = profile('agent-evolution');
  const baby = art.creatureFramePlan(identity, { stage: 'baby', action: 'idle', direction: 'down', frame: 0 });
  const middle = art.creatureFramePlan(identity, { stage: 'middle', action: 'idle', direction: 'down', frame: 0 });
  const final = art.creatureFramePlan(identity, { stage: 'final', action: 'idle', direction: 'down', frame: 0 });
  assert.deepEqual([baby.variant, baby.palette], [middle.variant, middle.palette]);
  assert.deepEqual([baby.variant, baby.palette], [final.variant, final.palette]);
  assert.notDeepEqual(baby.blocks, middle.blocks);
  assert.notDeepEqual(middle.blocks, final.blocks);
  assert.notDeepEqual(baby.blocks, final.blocks);
});
