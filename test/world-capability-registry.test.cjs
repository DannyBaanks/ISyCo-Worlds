'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');

const { resolveWorldProfile } = loadTs('src/main/worldCapabilityRegistry.ts');

const profiles = [
  {
    id: 'office', labelKey: 'world.office',
    requiredCapabilities: ['core.office'], optionalCapabilities: ['mcp.calendar'],
    sharedCapabilities: ['core.shared'], presentationId: 'office'
  },
  {
    id: 'monster-trainer', labelKey: 'world.monsterTrainer',
    requiredCapabilities: ['core.trainer'], optionalCapabilities: [],
    sharedCapabilities: ['core.shared'], presentationId: 'monster-trainer'
  }
];

const capabilities = [
  { id: 'core.office', kind: 'action', profiles: ['office'], shared: false, requires: [], conflicts: [], required: true, activation: 'harness-restart', adapterId: 'office' },
  { id: 'core.trainer', kind: 'action', profiles: ['monster-trainer'], shared: false, requires: [], conflicts: [], required: true, activation: 'harness-restart', adapterId: 'trainer' },
  { id: 'core.shared', kind: 'mcp', profiles: ['office', 'monster-trainer'], shared: true, requires: [], conflicts: [], required: false, activation: 'harness-restart', adapterId: 'shared' },
  { id: 'mcp.calendar', kind: 'mcp', profiles: ['office'], shared: false, requires: ['core.shared'], conflicts: [], required: false, activation: 'harness-restart', adapterId: 'calendar' },
  { id: 'foreign', kind: 'skill', profiles: ['monster-trainer'], shared: false, requires: [], conflicts: [], required: false, activation: 'harness-restart', adapterId: 'foreign' }
];

test('resolves built-in profiles independently and includes only declared shared capabilities', () => {
  const office = resolveWorldProfile('office', profiles, capabilities);
  const monster = resolveWorldProfile('monster-trainer', profiles, capabilities);
  assert.equal(office.profile.id, 'office');
  assert.equal(monster.profile.id, 'monster-trainer');
  assert.deepEqual(office.capabilities.map((item) => item.id), ['core.office', 'core.shared', 'mcp.calendar']);
  assert.deepEqual(monster.capabilities.map((item) => item.id), ['core.trainer', 'core.shared']);
  assert.equal(monster.capabilities.some((item) => item.id === 'foreign'), false);
});

test('rejects duplicate profile and capability identities', () => {
  assert.throws(() => resolveWorldProfile('office', [...profiles, profiles[0]], capabilities), { code: 'duplicate-profile' });
  assert.throws(() => resolveWorldProfile('office', profiles, [...capabilities, capabilities[0]]), { code: 'duplicate-capability' });
});

test('rejects unknown dependencies before activation', () => {
  const broken = capabilities.map((item) => item.id === 'core.office' ? { ...item, requires: ['missing'] } : item);
  assert.throws(() => resolveWorldProfile('office', profiles, broken), { code: 'unknown-dependency' });
});

test('rejects capability dependency cycles', () => {
  const cyclic = capabilities.map((item) => {
    if (item.id === 'core.office') return { ...item, requires: ['mcp.calendar'] };
    if (item.id === 'mcp.calendar') return { ...item, requires: ['core.office'] };
    return item;
  });
  assert.throws(() => resolveWorldProfile('office', profiles, cyclic), { code: 'dependency-cycle' });
});

test('rejects conflicts in the selected capability set', () => {
  const conflict = capabilities.map((item) => item.id === 'mcp.calendar'
    ? { ...item, conflicts: ['core.office'] }
    : item);
  assert.throws(() => resolveWorldProfile('office', profiles, conflict), { code: 'capability-conflict' });
});

test('override selection cannot activate a capability owned by a different profile', () => {
  assert.throws(
    () => resolveWorldProfile('office', profiles, capabilities, { enabled: ['foreign'] }),
    { code: 'profile-capability-mismatch' }
  );
});
