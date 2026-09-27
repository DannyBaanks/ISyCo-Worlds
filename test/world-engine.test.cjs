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
  assert.ok(candidate, `${worldId} should be staged`);
  assert.equal(engine.markReady(candidate.token), true);
  return candidate;
}

test('Office and Monster Trainer bootstrap through the same engine and swap only after candidate READY', async () => {
  const { engine } = engineFor();
  const first = await makeReady(engine, 'office');

  await engine.select('monster-trainer');
  const staged = engine.getState();
  assert.equal(staged.phase, 'MOUNTING');
  assert.equal(staged.active.worldId, 'office', 'the current READY world remains active while staging');
  assert.equal(staged.candidate.worldId, 'monster-trainer');

  const second = staged.candidate;
  assert.equal(engine.markReady(second.token), true);
  const committed = engine.getState();
  assert.equal(committed.phase, 'READY');
  assert.equal(committed.active.worldId, 'monster-trainer');
  assert.deepEqual(committed.pendingDisposals.map((mount) => mount.token), [first.token]);
  assert.equal(engine.markDisposed(first.token), true, 'old world disposes once after commit');
  assert.equal(engine.markDisposed(first.token), false, 'a repeated dispose cannot accumulate cleanup');
});

test('a missing target resource fails closed and retains the last READY world with structured cause', async () => {
  const { engine } = engineFor({ fail: new Set(['monster-trainer/monster-stage']) });
  await makeReady(engine, 'office');

  await engine.select('monster-trainer');
  const state = engine.getState();
  assert.equal(state.phase, 'READY');
  assert.equal(state.active.worldId, 'office');
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

test('a dev resource resolver can classify an unavailable external runtime without reviving it', async () => {
  const unavailable = Object.assign(new Error('Vite origin unavailable'), { category: 'external-resource' });
  const { engine } = engineFor({
    resources: {
      runtime: 'dev',
      async resolve() { throw unavailable; }
    }
  });

  await engine.select('office');
  const state = engine.getState();
  assert.equal(state.phase, 'RECOVERY');
  assert.equal(state.error.category, 'external-resource');
  assert.equal(state.error.runtime, 'dev');
  assert.equal(state.error.cause, unavailable);
});

test('a failed Office replacement retains the previously READY Office mount', async () => {
  const { engine } = engineFor();
  const readyOffice = await makeReady(engine, 'office');

  await engine.select('office');
  const replacement = engine.getState().candidate;
  assert.notEqual(replacement.token, readyOffice.token);
  assert.equal(await engine.markFailed(replacement.token, new Error('Office reload failed')), true);

  const state = engine.getState();
  assert.equal(state.phase, 'READY');
  assert.equal(state.active.token, readyOffice.token);
  assert.deepEqual(state.pendingDisposals.map((mount) => mount.token), [replacement.token]);
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
  await Promise.resolve();
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

test('an async renderer failure stages Office while the failed mount remains visible until fallback READY', async () => {
  const { engine } = engineFor();
  const officeMount = await makeReady(engine, 'office');
  const monsterMount = await makeReady(engine, 'monster-trainer');
  engine.markDisposed(officeMount.token);

  assert.equal(await engine.markFailed(monsterMount.token, new Error('ticker exploded')), true);
  const recovering = engine.getState();
  assert.equal(recovering.phase, 'MOUNTING');
  assert.equal(recovering.active.worldId, 'monster-trainer');
  assert.equal(recovering.candidate.worldId, 'office');
  assert.equal(recovering.error.phase, 'READY');
  assert.equal(engine.markReady(recovering.candidate.token), true);
  assert.equal(engine.getState().active.worldId, 'office');
});

test('an async renderer failure whose Office fallback also fails enters Recovery without retaining the broken world', async () => {
  const fail = new Set();
  const { engine } = engineFor({ fail });
  const officeMount = await makeReady(engine, 'office');
  const monsterMount = await makeReady(engine, 'monster-trainer');
  engine.markDisposed(officeMount.token);
  fail.add('office/office-tiles');

  await engine.markFailed(monsterMount.token, new Error('renderer lost'));
  const state = engine.getState();
  assert.equal(state.phase, 'RECOVERY');
  assert.equal(state.active, undefined);
  assert.equal(state.error.worldId, 'office');
  assert.deepEqual(state.pendingDisposals.map((mount) => mount.token), [monsterMount.token]);
});

test('consecutive failed staged switches retain READY Office and release every staged mount once', async () => {
  const { engine } = engineFor();
  await makeReady(engine, 'office');

  for (let attempt = 0; attempt < 3; attempt++) {
    await engine.select('monster-trainer');
    const candidate = engine.getState().candidate;
    assert.equal(await engine.markFailed(candidate.token, new Error(`renderer failure ${attempt}`)), true);
    assert.equal(engine.getState().active.worldId, 'office');
    assert.deepEqual(engine.getState().pendingDisposals.map((mount) => mount.token), [candidate.token]);
    assert.equal(engine.markDisposed(candidate.token), true);
    assert.deepEqual(engine.getState().pendingDisposals, []);
  }
});
