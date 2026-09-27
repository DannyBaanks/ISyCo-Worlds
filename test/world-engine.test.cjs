'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');

const { WorldEngine } = loadTs('src/renderer/src/worlds/WorldEngine.ts');

const office = { id: 'office', resources: [{ id: 'office-tiles', url: 'office://tiles' }] };
const monster = { id: 'monster-trainer', resources: [{ id: 'monster-stage', url: 'monster://stage' }] };
const starterVillageAtlas = { id: 'starter-village-atlas', url: 'monster://starter-village-atlas' };

function resolver({ runtime = 'dev', fail = new Set(), calls = [] } = {}) {
  return {
    runtime,
    async resolve(world, resource) {
      calls.push(`${runtime}:${world.id}/${resource.id}`);
      if (fail.has(`${world.id}/${resource.id}`)) throw new Error(`missing ${resource.url}`);
    }
  };
}

function engineFor(options = {}) {
  const calls = [];
  const states = [];
  const resources = options.resources || resolver({ calls, fail: options.fail });
  const engine = new WorldEngine({
    worlds: options.worlds || [office, monster],
    fallbackWorldId: 'office',
    resolver: resources,
    onStateChange: (state) => states.push(state)
  });
  return { engine, calls, states };
}

async function makeReady(engine, worldId) {
  await engine.select(worldId);
  const candidate = engine.getState().candidate;
  assert.ok(candidate, `${worldId} should be mountable`);
  assert.equal(engine.markReady(candidate.token), true);
  return candidate;
}

test('Office and Monster Trainer hand off serially: preload, dispose, mount, then READY', async () => {
  const { engine, calls } = engineFor();
  const officeMount = await makeReady(engine, 'office');

  await engine.select('monster-trainer');
  const preloaded = engine.getState();
  assert.deepEqual(calls, ['dev:office/office-tiles', 'dev:monster-trainer/monster-stage']);
  assert.equal(preloaded.phase, 'MOUNTING');
  assert.equal(preloaded.active, undefined, 'the old renderer is released before a new one can mount');
  assert.equal(preloaded.candidate, undefined, 'Monster never stages beside Office');
  assert.equal(preloaded.pendingMount.worldId, 'monster-trainer');
  assert.deepEqual(preloaded.pendingDisposals.map((mount) => mount.token), [officeMount.token]);

  assert.equal(engine.markDisposed(officeMount.token), true);
  const mounting = engine.getState();
  assert.equal(mounting.candidate.worldId, 'monster-trainer');
  assert.equal(mounting.pendingMount, undefined);
  assert.deepEqual(mounting.pendingDisposals, []);
  assert.equal(engine.markReady(mounting.candidate.token), true);
  assert.equal(engine.getState().active.worldId, 'monster-trainer');
  assert.equal(engine.markDisposed(officeMount.token), false, 'each released renderer is acknowledged once');
});

test('a missing target resource fails before disposal and preserves the current READY renderer', async () => {
  const { engine } = engineFor({ fail: new Set(['monster-trainer/monster-stage']) });
  const officeMount = await makeReady(engine, 'office');

  await engine.select('monster-trainer');
  const state = engine.getState();
  assert.equal(state.phase, 'READY');
  assert.equal(state.active.token, officeMount.token);
  assert.equal(state.candidate, undefined);
  assert.deepEqual(state.pendingDisposals, []);
  assert.equal(state.error.phase, 'BOOTSTRAPPING');
  assert.equal(state.error.worldId, 'monster-trainer');
  assert.match(state.error.cause.message, /missing monster:\/\/stage/);
});

test('a missing required Starter Village atlas is a BOOTSTRAPPING failure that retains READY Office', async () => {
  const { engine } = engineFor({
    worlds: [office, { id: 'monster-trainer', resources: [starterVillageAtlas] }],
    fail: new Set(['monster-trainer/starter-village-atlas'])
  });
  await makeReady(engine, 'office');

  await engine.select('monster-trainer');
  const state = engine.getState();
  assert.equal(state.phase, 'READY');
  assert.equal(state.active.worldId, 'office');
  assert.equal(state.error.phase, 'BOOTSTRAPPING');
  assert.equal(state.error.worldId, 'monster-trainer');
  assert.match(state.error.cause.message, /starter-village-atlas/);
});

test('a dev resource resolver classifies an unavailable external runtime without trying to revive it', async () => {
  const unavailable = Object.assign(new Error('Vite origin unavailable'), { category: 'external-resource' });
  const { engine } = engineFor({
    resources: { runtime: 'dev', async resolve() { throw unavailable; } }
  });

  await engine.select('office');
  const state = engine.getState();
  assert.equal(state.phase, 'RECOVERY');
  assert.equal(state.error.category, 'external-resource');
  assert.equal(state.error.runtime, 'dev');
  assert.equal(state.error.cause, unavailable);
});

test('without a READY world, a failed target attempts Office exactly once', async () => {
  const calls = [];
  const { engine } = engineFor({
    resources: resolver({ calls, fail: new Set(['monster-trainer/monster-stage']) })
  });

  await engine.select('monster-trainer');
  const fallback = engine.getState();
  assert.equal(fallback.phase, 'MOUNTING');
  assert.equal(fallback.candidate.worldId, 'office');
  assert.equal(calls.filter((call) => call.endsWith('office/office-tiles')).length, 1);
  assert.equal(engine.markReady(fallback.candidate.token), true);
  assert.equal(engine.getState().active.worldId, 'office');
});

test('a failed Office fallback reaches Recovery Surface without Office retry loops', async () => {
  const calls = [];
  const { engine } = engineFor({
    resources: resolver({
      calls,
      fail: new Set(['monster-trainer/monster-stage', 'office/office-tiles'])
    })
  });

  await engine.select('monster-trainer');
  const state = engine.getState();
  assert.equal(state.phase, 'RECOVERY');
  assert.equal(state.error.worldId, 'office');
  assert.equal(calls.filter((call) => call.endsWith('office/office-tiles')).length, 1);
});

test('a post-disposal renderer failure releases Monster then attempts Office exactly once', async () => {
  const { engine, calls } = engineFor();
  const officeMount = await makeReady(engine, 'office');
  await engine.select('monster-trainer');
  engine.markDisposed(officeMount.token);
  const monsterMount = engine.getState().candidate;
  engine.markReady(monsterMount.token);

  assert.equal(await engine.markFailed(monsterMount.token, new Error('ticker exploded')), true);
  const recovering = engine.getState();
  assert.equal(recovering.active, undefined, 'post-disposal cannot claim to preserve the prior READY mount');
  assert.equal(recovering.candidate, undefined);
  assert.equal(recovering.pendingMount.worldId, 'office');
  assert.deepEqual(recovering.pendingDisposals.map((mount) => mount.token), [monsterMount.token]);
  assert.equal(calls.filter((call) => call.endsWith('office/office-tiles')).length, 2);

  engine.markDisposed(monsterMount.token);
  const fallback = engine.getState().candidate;
  assert.equal(fallback.worldId, 'office');
  engine.markReady(fallback.token);
  assert.equal(engine.getState().active.worldId, 'office');
});

test('a post-disposal Office fallback failure enters Recovery without retaining the broken world', async () => {
  const fail = new Set();
  const { engine } = engineFor({ fail });
  const officeMount = await makeReady(engine, 'office');
  await engine.select('monster-trainer');
  engine.markDisposed(officeMount.token);
  const monsterMount = engine.getState().candidate;
  engine.markReady(monsterMount.token);
  fail.add('office/office-tiles');

  await engine.markFailed(monsterMount.token, new Error('renderer lost'));
  const state = engine.getState();
  assert.equal(state.phase, 'RECOVERY');
  assert.equal(state.active, undefined);
  assert.equal(state.error.worldId, 'office');
  assert.deepEqual(state.pendingDisposals.map((mount) => mount.token), [monsterMount.token]);
});

test('three consecutive failed target selections retain one READY Office and accumulate no mount disposal', async () => {
  const { engine, states } = engineFor({ fail: new Set(['monster-trainer/monster-stage']) });
  const officeMount = await makeReady(engine, 'office');
  const stateCount = states.length;

  for (let attempt = 0; attempt < 3; attempt++) {
    await engine.select('monster-trainer');
    const state = engine.getState();
    assert.equal(state.active.token, officeMount.token);
    assert.equal(state.candidate, undefined);
    assert.equal(state.pendingMount, undefined);
    assert.deepEqual(state.pendingDisposals, []);
  }
  assert.ok(states.length > stateCount, 'each failure is reported, but no renderer mount is added');
  assert.equal(engine.markDisposed(officeMount.token), false, 'no disposal listener was armed for failed preloads');
});

test('dev and packaged resolvers exercise an identical WorldEngine lifecycle', async () => {
  async function trace(runtime) {
    const calls = [];
    const { engine, states } = engineFor({ resources: resolver({ runtime, calls }) });
    await engine.select('office');
    const candidate = engine.getState().candidate;
    engine.markReady(candidate.token);
    return { phases: states.map((state) => state.phase), calls };
  }

  const dev = await trace('dev');
  const packaged = await trace('packaged');
  assert.deepEqual(dev.phases, packaged.phases);
  assert.deepEqual(
    dev.calls.map((call) => call.replace('dev:', '')),
    packaged.calls.map((call) => call.replace('packaged:', ''))
  );
});
