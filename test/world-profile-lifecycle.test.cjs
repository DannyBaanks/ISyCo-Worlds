'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');

const { WorldProfileLifecycle } = loadTs('src/main/worldProfileLifecycle.ts');

function fixture(overrides = {}) {
  const events = [];
  const coordinator = new WorldProfileLifecycle({
    initialProfileId: 'office',
    resolve: async (id) => {
      events.push(`resolve:${id}`);
      if (overrides.resolveError) throw overrides.resolveError;
      return { id, capabilities: [{ id: `${id}.core`, required: true }] };
    },
    prepare: async (profile) => { events.push(`prepare:${profile.id}`); if (overrides.prepareError) throw overrides.prepareError; },
    stop: async (id) => { events.push(`stop:${id}`); if (overrides.stopError) throw overrides.stopError; },
    bind: (id) => events.push(`bind:${id}`),
    start: async (profile) => { events.push(`start:${profile.id}`); if (overrides.startError) throw overrides.startError; },
    createSessionId: () => 'session-next'
  });
  return { coordinator, events };
}

test('profile change requires explicit confirmation before any lifecycle work', async () => {
  const { coordinator, events } = fixture();
  const result = await coordinator.activate('monster-trainer');
  assert.equal(result.ok, false);
  assert.equal(result.error.category, 'confirmation-required');
  assert.deepEqual(events, []);
  assert.equal(coordinator.getStatus().activeProfileId, 'office');
});

test('successful activation stops old services before binding and starting the new profile', async () => {
  const { coordinator, events } = fixture();
  const result = await coordinator.activate('monster-trainer', { confirmed: true });
  assert.deepEqual(events, [
    'resolve:monster-trainer', 'prepare:monster-trainer', 'stop:office',
    'bind:monster-trainer', 'start:monster-trainer'
  ]);
  assert.deepEqual(result, { ok: true, activeProfileId: 'monster-trainer' });
  assert.equal(coordinator.getStatus().activeProfileId, 'monster-trainer');
  assert.equal(coordinator.getStatus().sessionId, 'session-next');
});

test('preparation failure preserves the previously READY profile and never binds the target', async () => {
  const { coordinator, events } = fixture({ prepareError: new Error('profile storage unavailable') });
  const result = await coordinator.activate('monster-trainer', { confirmed: true });
  assert.equal(result.ok, false);
  assert.equal(result.error.phase, 'PREPARING');
  assert.equal(coordinator.getStatus().activeProfileId, 'office');
  assert.equal(events.some((event) => event.startsWith('stop:') || event.startsWith('bind:')), false);
});

test('required capability validation failure is structured and preserves the active profile', async () => {
  const error = Object.assign(new Error('required provider missing'), { capabilityId: 'trainer.mcp', category: 'required-capability' });
  const { coordinator } = fixture({ resolveError: error });
  const result = await coordinator.activate('monster-trainer', { confirmed: true });
  assert.equal(result.ok, false);
  assert.equal(result.error.phase, 'VALIDATING');
  assert.equal(result.error.profileId, 'monster-trainer');
  assert.equal(result.error.capabilityId, 'trainer.mcp');
  assert.equal(result.error.category, 'required-capability');
  assert.equal(coordinator.getStatus().activeProfileId, 'office');
});

test('stop failure does not start the target or claim either profile READY', async () => {
  const { coordinator, events } = fixture({ stopError: new Error('old runtime would not stop') });
  const result = await coordinator.activate('monster-trainer', { confirmed: true });
  assert.equal(result.ok, false);
  assert.equal(result.error.phase, 'STOPPING');
  assert.equal(coordinator.getStatus().state, 'ERROR');
  assert.equal(coordinator.getStatus().activeProfileId, null);
  assert.equal(events.some((event) => event === 'start:monster-trainer'), false);
});

test('target startup failure cleans partial services and does not silently fall back to Office', async () => {
  const { coordinator, events } = fixture({ startError: new Error('profile failed to start') });
  const result = await coordinator.activate('monster-trainer', { confirmed: true });
  assert.equal(result.ok, false);
  assert.equal(result.error.phase, 'STARTING');
  assert.equal(coordinator.getStatus().activeProfileId, null);
  assert.equal(events.filter((event) => event === 'start:office').length, 0);
  assert.equal(events.filter((event) => event === 'stop:monster-trainer').length, 1);
});

test('repeated profile switches never overlap active profile services', async () => {
  const live = new Set(['office']);
  const coordinator = new WorldProfileLifecycle({
    initialProfileId: 'office', resolve: async (id) => ({ id, capabilities: [] }),
    prepare: async () => {},
    stop: async (id) => { assert.equal(live.delete(id), true); },
    bind: () => {},
    start: async (profile) => { assert.equal(live.size, 0); live.add(profile.id); }
  });
  for (const id of ['monster-trainer', 'office', 'monster-trainer', 'office']) {
    const result = await coordinator.activate(id, { confirmed: true });
    assert.equal(result.ok, true);
    assert.deepEqual([...live], [id]);
  }
});
