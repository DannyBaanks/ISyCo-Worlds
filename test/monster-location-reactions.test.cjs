'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');
let reactions;
try {
  reactions = loadTs('src/renderer/src/worlds/monster/locationReactions.ts');
} catch (cause) {
  if (cause?.code !== 'ENOENT') throw cause;
  reactions = {};
}

test('a completed task triggers one reaction at its worker location, coalescing a location crowd', () => {
  assert.equal(typeof reactions.deriveLocationReactionBursts, 'function', 'task completion needs a semantic location reaction projection');
  const bursts = reactions.deriveLocationReactionBursts([
    { kind: 'task-status-changed', taskId: 'task-1', from: 'doing', to: 'done' },
    { kind: 'task-status-changed', taskId: 'task-2', from: 'doing', to: 'done' },
    { kind: 'task-status-changed', taskId: 'task-3', from: 'todo', to: 'doing' }
  ], [
    { id: 'task-1', title: 'One', assignee: 'worker-a', status: 'done', awaitsHuman: false },
    { id: 'task-2', title: 'Two', assignee: 'worker-b', status: 'done', awaitsHuman: false },
    { id: 'task-3', title: 'Three', assignee: 'worker-a', status: 'doing', awaitsHuman: false }
  ], new Map([['worker-a', 'training-grass'], ['worker-b', 'training-grass']]));

  assert.deepEqual(bursts, [{
    locationId: 'training-grass',
    kind: 'task-completed',
    taskIds: ['task-1', 'task-2'],
    agentIds: ['worker-a', 'worker-b'],
    elapsedMs: 0
  }]);
});

test('non-completion, stale, unassigned, or unmapped transitions cannot make a location react', () => {
  const bursts = reactions.deriveLocationReactionBursts([
    { kind: 'task-status-changed', taskId: 'still-running', from: 'todo', to: 'doing' },
    { kind: 'task-status-changed', taskId: 'missing-task', from: 'doing', to: 'done' },
    { kind: 'task-status-changed', taskId: 'unassigned', from: 'doing', to: 'done' },
    { kind: 'task-status-changed', taskId: 'not-at-a-place', from: 'doing', to: 'done' }
  ], [
    { id: 'still-running', title: 'Still running', assignee: 'a', status: 'doing', awaitsHuman: false },
    { id: 'unassigned', title: 'Unassigned', assignee: null, status: 'done', awaitsHuman: false },
    { id: 'not-at-a-place', title: 'No location', assignee: 'b', status: 'done', awaitsHuman: false }
  ], new Map());

  assert.deepEqual(bursts, []);
});

test('location light bursts expand as whole-pixel sparkles and expire after a finite duration', () => {
  let [active] = reactions.deriveLocationReactionBursts([
    { kind: 'task-status-changed', taskId: 'task-1', from: 'doing', to: 'done' }
  ], [{ id: 'task-1', title: 'One', assignee: 'worker-a', status: 'done', awaitsHuman: false }],
  new Map([['worker-a', 'stable']]));

  const startFrame = reactions.locationReactionFrame(active.elapsedMs);
  assert.ok(startFrame.sparkles.length >= 4);
  assert.ok(startFrame.sparkles.every(({ x, y }) => Number.isInteger(x) && Number.isInteger(y)));
  active = reactions.advanceLocationReaction(active, 700);
  const expandedFrame = reactions.locationReactionFrame(active.elapsedMs);
  assert.ok(expandedFrame.radius > startFrame.radius);
  assert.ok(expandedFrame.alpha < startFrame.alpha);
  assert.deepEqual(reactions.advanceLocationReaction(active, 800), null,
    'the ambient event stops instead of accumulating a permanent ticker effect');
});
