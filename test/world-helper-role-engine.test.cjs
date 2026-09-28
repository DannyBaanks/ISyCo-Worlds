'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');
const { resolveGusRole, buildGusSystemPrompt } = loadTs('src/main/worldHelperRoleEngine.ts');

test('GUS role is declared as a World specialist with least-privilege capabilities', () => {
  const role = resolveGusRole();
  assert.equal(role.id, 'gus');
  assert.equal(role.displayName, 'GUS');
  assert.deepEqual(role.capabilities, {
    observeWorld: true,
    proposeWorkforce: true,
    suggestWorld: true,
    launchWorker: false,
    executeShell: false,
    modifyWorldConfig: false
  });
  assert.match(role.instructions, /ISyCo Worlds/);
});

test('GUS system prompt composes World contract, role procedure and live allowlists', () => {
  const prompt = buildGusSystemPrompt({
    world: 'monster-trainer',
    availableRoles: ['Monster researcher'],
    installedProviders: ['codex']
  });
  assert.match(prompt, /Monster Trainer/);
  assert.match(prompt, /Office/);
  assert.match(prompt, /Monster researcher/);
  assert.match(prompt, /codex/);
  assert.match(prompt, /explicit human approval/i);
  assert.match(prompt, /Return only valid JSON/i);
  assert.match(prompt, /ISyCo Worlds/);
  assert.doesNotMatch(prompt, /Isymotron/);
});
