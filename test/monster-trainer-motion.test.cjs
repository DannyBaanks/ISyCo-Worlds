'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');
const Scenario = loadTs('src/renderer/src/worlds/monster/StarterVillageScenario.ts');

let motion;
try {
  motion = loadTs('src/renderer/src/worlds/monster/monsterMovement.ts');
} catch (cause) {
  if (cause?.code !== 'ENOENT' && cause?.code !== 'MODULE_NOT_FOUND') throw cause;
  motion = {};
}
const art = loadTs('src/renderer/src/worlds/monster/monsterArt.ts');

test('Monster Trainer navigation routes around water and structure footprints using tile steps', () => {
  assert.equal(typeof motion.createStarterVillageNavigation, 'function', 'the world needs a composition-aware walk grid');
  assert.equal(typeof motion.findTilePath, 'function', 'workers need a deterministic tile route');
  const grid = motion.createStarterVillageNavigation(Scenario.STARTER_VILLAGE_PRESET);
  const route = motion.findTilePath(grid, { x: 30, y: 38 }, { x: 50, y: 38 });
  assert.ok(route && route.length > 2, 'a worker west of the lake can reach the east bank');
  assert.deepEqual(route[0], { x: 30, y: 38 });
  assert.deepEqual(route.at(-1), { x: 50, y: 38 });
  for (let index = 1; index < route.length; index += 1) {
    assert.equal(Math.abs(route[index].x - route[index - 1].x) + Math.abs(route[index].y - route[index - 1].y), 1,
      'movement never cuts diagonally across the pixel grid');
  }
  assert.ok(route.every((point) => !grid.blocked.has(`${point.x},${point.y}`)), 'the route never crosses water or solid props');
});

test('worker destinations are projections of semantic state, not Hive mutations', () => {
  assert.equal(typeof motion.destinationForWorker, 'function', 'world state needs an explicit visual destination mapping');
  assert.equal(motion.destinationForWorker({ id: 'a', state: 'working' }, []), 'training-grass');
  assert.equal(motion.destinationForWorker({ id: 'a', state: 'blocked' }, []), 'professor');
  assert.equal(motion.destinationForWorker({ id: 'a', state: 'working' }, [
    { id: 'question', assignee: 'a', awaitsHuman: true }
  ]), 'professor');
  assert.equal(motion.destinationForWorker({ id: 'a', state: 'waiting' }, []), 'village-idle');
});

test('pixel walker advances in bounded steps and stops at its semantic destination', () => {
  assert.equal(typeof motion.createTileWalker, 'function', 'a route must become a persistent pixel-space walker');
  assert.equal(typeof motion.advanceTileWalker, 'function');
  let walker = motion.createTileWalker([{ x: 0, y: 0 }, { x: 1, y: 0 }], 16);
  walker = motion.advanceTileWalker(walker, 125, 32);
  assert.equal(walker.x, 4, '125 ms at 32 px/s advances exactly four logical pixels');
  assert.equal(walker.finished, false);
  walker = motion.advanceTileWalker(walker, 500, 32);
  assert.equal(walker.x, 16);
  assert.equal(walker.y, 0);
  assert.equal(walker.finished, true);
  const settled = motion.advanceTileWalker(walker, 500, 32);
  assert.deepEqual(settled, walker, 'completed routes do not overshoot or keep accumulating motion');
});

test('pathfinding fails closed when no semantic route exists', () => {
  assert.equal(typeof motion.findTilePath, 'function');
  const grid = { columns: 3, rows: 3, blocked: new Set(['1,0', '1,1', '1,2']) };
  assert.equal(motion.findTilePath(grid, { x: 0, y: 1 }, { x: 2, y: 1 }), null);
  assert.equal(motion.findTilePath(grid, { x: -1, y: 0 }, { x: 2, y: 1 }), null);
});

test('worker state drives an end-to-end walk, work pose, and all three visual evolutions', () => {
  assert.equal(typeof motion.MonsterWorkerMotion, 'function');
  const actorMotion = new motion.MonsterWorkerMotion();
  const agent = { id: 'trainer-worker', name: 'Willow', state: 'working', archived: false };
  const tasks = [{ id: 'task-1', title: 'Gather field notes', assignee: agent.id, status: 'running', awaitsHuman: false }];
  actorMotion.updateProjection([agent], tasks, Scenario.STARTER_VILLAGE_PRESET);
  let [snapshot] = actorMotion.snapshot();
  assert.equal(snapshot.destination, 'training-grass');
  assert.equal(snapshot.action, 'walk', 'workers begin walking along the map rather than snapping to an anchor');
  const start = { x: snapshot.x, y: snapshot.y };
  for (let index = 0; index < 800 && !snapshot.arrived; index += 1) [snapshot] = actorMotion.tick(125);
  assert.equal(snapshot.arrived, true, 'the semantic route reaches its destination');
  assert.notDeepEqual({ x: snapshot.x, y: snapshot.y }, start);
  assert.equal(snapshot.action, 'work', 'arrival changes the visual pose without writing task state');

  const identity = { version: 1, agentId: agent.id, seed: `munder-worlds:v1:${agent.id}`, appearances: {}, updatedAt: 'derived' };
  const forms = ['baby', 'middle', 'final'].map((stage) => art.creatureFramePlan(identity, {
    stage, action: snapshot.action, direction: snapshot.direction, frame: snapshot.frame
  }));
  assert.equal(new Set(forms.map((form) => JSON.stringify([form.variant, form.palette]))).size, 1,
    'evolution preserves the worker identity');
  assert.equal(new Set(forms.map((form) => JSON.stringify(form.blocks))).size, 3,
    'all evolution stages have distinct authored silhouettes');
});
