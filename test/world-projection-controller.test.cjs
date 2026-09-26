'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const Resolver = loadTs('src/renderer/src/worlds/identityResolver.ts');
const hookPath = path.join(process.cwd(), 'src/renderer/src/worlds/useWorldProjection.ts');

test('stored identities win while absent and mismatched ids derive independently', () => {
  const stored = {
    version: 1,
    agentId: 'atlas',
    seed: 'atlas-custom',
    appearances: { 'monster-trainer': { variant: 'moss' } },
    updatedAt: '2026-09-26T01:00:00.000Z'
  };
  const identityFor = Resolver.createIdentityResolver({ atlas: stored, terra: { ...stored, agentId: 'atlas' } });

  assert.deepEqual(identityFor('atlas'), stored);
  assert.equal(identityFor('terra').seed, 'munder-worlds:v1:terra');
  assert.equal(identityFor('moss').seed, 'munder-worlds:v1:moss');
  assert.notDeepEqual(identityFor('terra'), identityFor('moss'));
});

test('live controller polls only tasks, subscribes to the agent store, and never persists', () => {
  const source = fs.readFileSync(hookPath, 'utf8');
  assert.match(source, /window\.cth\.hiveTasks\(\)/);
  assert.match(source, /setInterval\([^,]+,\s*5_000\)/);
  assert.match(source, /clearInterval\(/);
  assert.match(source, /useStore\(/);
  assert.match(source, /window\.cth\.worldProfiles\(\)/);
  assert.doesNotMatch(source, /saveWorldProfile|worldProfiles\.save|updateConfig|hiveTasks\s*[:=].*save/s);
});
