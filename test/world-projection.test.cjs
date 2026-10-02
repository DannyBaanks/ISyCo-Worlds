'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');

const Projection = loadTs('src/renderer/src/worlds/worldProjection.ts');

test('normalizes real agent-like records into stable, sortable visual agents', () => {
  const snapshot = Projection.normalizeWorldSnapshot([
    { id: 'zeta', name: 'Zeta', status: 'waiting', archived: true, monsterCharacter: 'water' },
    { id: 'atlas', name: 'Atlas', status: 'running' },
    { id: 'terra', name: 'Terra', status: 'blocked' },
    { id: 'moss', name: 'Moss', status: 'idle' },
    { id: 'other', name: 'Other', status: 'mystery' },
    { id: '', name: 'not an agent' },
    null
  ], []);

  assert.deepEqual(snapshot.agents.map((agent) => [agent.id, agent.state, agent.archived]), [
    ['atlas', 'working', false],
    ['moss', 'idle', false],
    ['other', 'other', false],
    ['terra', 'blocked', false],
    ['zeta', 'waiting', true]
  ]);
  assert.equal(snapshot.agents.find((agent) => agent.id === 'zeta').monsterCharacter, 'agua', 'a legacy water id resolves to the agua sheet');
  assert.deepEqual(snapshot.tasks, []);
});

test('uses only a blocked, unanswered human question as awaitsHuman evidence', () => {
  const snapshot = Projection.normalizeWorldSnapshot([], [
    { id: 'safe', title: 'Safe', status: 'blocked', humanQA: [{ q: 'Need a choice?' }] },
    { id: 'answered', title: 'Answered', status: 'blocked', humanQA: [{ q: 'Need a choice?', a: 'yes' }] },
    { id: 'dismissed', title: 'Dismissed', status: 'blocked', humanQA: [{ q: 'Need a choice?', dismissedAt: 'now' }] },
    { id: 'done', title: 'Done', status: 'done', humanQA: [{ q: 'Need a choice?' }] },
    { id: 'junk', status: 'doing', humanQA: 'not an array' },
    { title: 'missing id', status: 'blocked' },
    null
  ]);

  assert.deepEqual(snapshot.tasks.map((task) => [task.id, task.status, task.awaitsHuman]), [
    ['answered', 'blocked', false],
    ['dismissed', 'blocked', false],
    ['done', 'done', false],
    ['junk', 'doing', false],
    ['safe', 'blocked', true]
  ]);
});

test('equal snapshots have no effects; only evidenced state changes produce transitions', () => {
  const before = Projection.normalizeWorldSnapshot(
    [{ id: 'atlas', name: 'Atlas', status: 'idle' }],
    [{ id: 'task-1', title: 'Ship it', assignee: 'atlas', status: 'blocked', humanQA: [{ q: 'Approve?' }] }]
  );
  const equal = Projection.normalizeWorldSnapshot(
    [{ id: 'atlas', name: 'Atlas', status: 'idle' }],
    [{ id: 'task-1', title: 'Ship it', assignee: 'atlas', status: 'blocked', humanQA: [{ q: 'Approve?' }] }]
  );
  const after = Projection.normalizeWorldSnapshot(
    [{ id: 'atlas', name: 'Atlas', status: 'working' }, { id: 'terra', name: 'Terra', status: 'waiting' }],
    [{ id: 'task-1', title: 'Ship it', assignee: 'terra', status: 'doing', humanQA: [{ q: 'Approve?' }] }]
  );

  assert.deepEqual(Projection.deriveVisualTransitions(before, equal), []);
  assert.deepEqual(Projection.deriveVisualTransitions(before, after), [
    { kind: 'agent-added', agentId: 'terra' },
    { kind: 'agent-state-changed', agentId: 'atlas', from: 'idle', to: 'working' },
    { kind: 'task-status-changed', taskId: 'task-1', from: 'blocked', to: 'doing' },
    { kind: 'task-assignee-changed', taskId: 'task-1', from: 'atlas', to: 'terra' },
    { kind: 'task-awaits-human-changed', taskId: 'task-1', from: true, to: false }
  ]);
});
