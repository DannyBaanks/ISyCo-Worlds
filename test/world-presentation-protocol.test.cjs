'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');

const P = loadTs('src/shared/worldPresentationProtocol.ts');

const projection = { agents: [{ id: 'atlas', name: 'Atlas', state: 'working', archived: false }], tasks: [] };

test('accepts only well-formed bootstrap/restart/dispose/update commands', () => {
  assert.equal(P.isWorldPresentationCommand({ type: 'bootstrap', profileId: 'office', generation: 1, projection }), true);
  assert.equal(P.isWorldPresentationCommand({ type: 'update-projection', profileId: 'office', generation: 1, projection }), true);
  assert.equal(P.isWorldPresentationCommand({ type: 'restart', generation: 2 }), true);
  assert.equal(P.isWorldPresentationCommand({ type: 'dispose', generation: 2 }), true);
  assert.equal(P.isWorldPresentationCommand({ type: 'bootstrap', profileId: '../office', generation: 1, projection }), false);
  assert.equal(P.isWorldPresentationCommand({ type: 'bootstrap', profileId: 'office', generation: 0, projection }), false);
  assert.equal(P.isWorldPresentationCommand({ type: 'restart', generation: -1 }), false);
  assert.equal(P.isWorldPresentationCommand({ type: 'bootstrap', profileId: 'office', generation: 1, projection: { agents: [{ id: '', name: 'x', state: 'hacking', archived: false }], tasks: [] } }), false);
  const identityProjection = {
    agents: [], tasks: [],
    visualIdentities: { atlas: { version: 1, agentId: 'atlas', seed: 'stable-seed', appearances: {}, updatedAt: 'now' } }
  };
  assert.equal(P.isWorldPresentationCommand({ type: 'bootstrap', profileId: 'monster-trainer', generation: 1, projection: identityProjection }), true);
  assert.equal(P.isWorldPresentationCommand({ type: 'bootstrap', profileId: 'monster-trainer', generation: 1, projection: { agents: [{ id: 'atlas', name: 'Atlas', state: 'idle', archived: false, monsterCharacter: 'fire' }], tasks: [] } }), true);
  assert.equal(P.isWorldPresentationCommand({ type: 'bootstrap', profileId: 'monster-trainer', generation: 1, projection: { agents: [{ id: 'atlas', name: 'Atlas', state: 'idle', archived: false, monsterCharacter: 'pikachu' }], tasks: [] } }), false);
  assert.equal(P.isWorldPresentationCommand({ type: 'bootstrap', profileId: 'monster-trainer', generation: 1, projection: { ...identityProjection, visualIdentities: { atlas: { ...identityProjection.visualIdentities.atlas, agentId: 'other' } } } }), false);
});

test('validates host events and prevents stale or foreign renderer messages from becoming current', () => {
  const event = { type: 'ready', profileId: 'monster-trainer', generation: 4 };
  assert.equal(P.isWorldPresentationEvent(event), true);
  assert.equal(P.isWorldPresentationEvent({ ...event, generation: 0 }), false);
  assert.equal(P.isWorldPresentationEvent({ type: 'failed', profileId: 'monster-trainer', generation: 4, error: { phase: 'BOOTSTRAPPING', category: 'resource', cause: { name: 'Error', message: 'missing' } } }), true);
  assert.equal(P.isWorldPresentationEvent({ type: 'intent', profileId: 'monster-trainer', generation: 4, intent: { type: 'select-agent', agentId: 'atlas' } }), true);
  assert.equal(P.isWorldPresentationEvent({ type: 'intent', profileId: 'monster-trainer', generation: 4, intent: { type: 'spawn-agent', command: '...' } }), false);
  assert.equal(P.isCurrentWorldPresentationEvent(event, 'monster-trainer', 4), true);
  assert.equal(P.isCurrentWorldPresentationEvent({ ...event, generation: 3 }, 'monster-trainer', 4), false);
  assert.equal(P.isCurrentWorldPresentationEvent({ ...event, profileId: 'office' }, 'monster-trainer', 4), false);
});
