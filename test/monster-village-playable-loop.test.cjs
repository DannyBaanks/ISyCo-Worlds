'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');
const demo = loadTs('src/shared/monsterVillageDemo.ts');
const { HiveManager } = loadTs('src/main/hive.ts');

function readTasks(home) {
  return JSON.parse(fs.readFileSync(path.join(home, 'hive', 'tasks.json'), 'utf8')).tasks;
}

test('E2E persistence path completes the Monster Village demo expedition and survives a reload', (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'isyco-monster-demo-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const hive = new HiveManager(() => home);
  const seed = demo.createMonsterVillageDemoTask('2026-10-19T07:00:00.000Z');

  assert.equal(hive.addTask(seed), true, 'the fixture enters the real Hive task ledger');
  let task = readTasks(home).find((candidate) => candidate.id === seed.id);
  assert.equal(task.status, 'todo');
  assert.equal(task.worldDemo.completedObjectiveIds.length, 0);

  let state = demo.addDemoObjective(task.worldDemo, 'meet-professor');
  assert.equal(demo.isNearDemoObjective('meet-professor', { x: 9, y: 11 }), true);
  hive.patchTask(task.id, { status: 'doing', worldDemo: { ...state, acceptedAt: '2026-10-19T07:01:00.000Z' } });

  for (const [objectiveId, position] of [
    ['collect-meadow-leaf', { x: 8, y: 14 }],
    ['collect-stable-leaf', { x: 49, y: 21 }]
  ]) {
    task = readTasks(home).find((candidate) => candidate.id === seed.id);
    assert.equal(demo.isNearDemoObjective(objectiveId, position), true);
    state = demo.addDemoObjective(task.worldDemo, objectiveId);
    hive.patchTask(task.id, { worldDemo: state });
  }

  task = readTasks(home).find((candidate) => candidate.id === seed.id);
  state = demo.addDemoObjective(task.worldDemo, 'return-professor');
  assert.equal(demo.demoObjectivesComplete(state), true);
  hive.patchTask(task.id, {
    status: 'done',
    result: 'Monster Village demo expedition completed through the authored field route.',
    worldDemo: state
  });

  // Simulate a renderer/app reload: a fresh HiveManager reads the same durable card.
  const reloadedHive = new HiveManager(() => home);
  const reloaded = readTasks(home).find((candidate) => candidate.id === seed.id);
  assert.equal(reloadedHive.tasks().tasks.find((candidate) => candidate.id === seed.id)?.status, 'done');
  assert.equal(reloaded.status, 'done');
  assert.deepEqual(reloaded.worldDemo.completedObjectiveIds, seed.worldDemo.objectiveIds);
  assert.equal(reloaded.result.includes('completed'), true);
});

test('demo objective interactions fail closed outside their authored anchors', () => {
  assert.equal(demo.isNearDemoObjective('collect-meadow-leaf', { x: 40, y: 40 }), false);
  assert.equal(demo.isNearDemoObjective('missing-objective', { x: 8, y: 14 }), false);
});
