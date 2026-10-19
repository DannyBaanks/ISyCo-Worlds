'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');
const game = loadTs('src/renderer/src/worlds/monster/worldSimulation.ts');

const base = () => ({
  version: 1,
  elapsedMs: 0,
  paused: false,
  speed: 1,
  rewardIds: [],
  rewardsByAgent: {}
});

test('only durable done tasks award a world reward, once per task id', () => {
  const tasks = [
    { id: 'research-1', title: 'Research', assignee: 'atlas', status: 'done', awaitsHuman: false },
    { id: 'working-1', title: 'Working', assignee: 'atlas', status: 'doing', awaitsHuman: false },
    { id: 'done-unassigned', title: 'Done', assignee: null, status: 'done', awaitsHuman: false }
  ];
  const first = game.reconcileDurableRewards(base(), tasks);
  assert.deepEqual(first.added, [
    { taskId: 'research-1', agentId: 'atlas' },
    { taskId: 'done-unassigned', agentId: null }
  ]);
  assert.equal(first.state.rewardsByAgent.atlas, 1);
  assert.equal(first.state.rewardIds.length, 2);

  const replay = game.reconcileDurableRewards(first.state, tasks);
  assert.deepEqual(replay.added, [], 'replaying the same Hive snapshot is idempotent');
  assert.strictEqual(replay.state, first.state);
});

test('pause and speed affect only the world clock', () => {
  const paused = { ...base(), paused: true, speed: 2 };
  assert.strictEqual(game.advanceSimulation(paused, 1000), paused, 'paused world does not advance');
  const fast = game.advanceSimulation({ ...base(), speed: 2 }, 1000);
  assert.equal(fast.elapsedMs, 2000);
  assert.equal(fast.rewardIds.length, 0, 'simulation controls do not touch Hive-derived rewards');
});

test('world-only reward count maps to authored evolution stages', () => {
  const state = { ...base(), rewardsByAgent: { atlas: 3 } };
  assert.equal(game.evolutionStageForAgent(state, 'atlas'), 'final');
  assert.equal(game.evolutionStageForAgent(state, 'terra'), 'baby');
});
