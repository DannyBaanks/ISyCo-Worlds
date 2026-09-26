'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'md-world-profiles-'));
const electron = require.resolve('electron');
require.cache[electron] = {
  id: electron,
  filename: electron,
  loaded: true,
  exports: { app: { getPath: () => userData } }
};

const Profiles = loadTs('src/shared/worldProfiles.ts');
const Repository = loadTs('src/main/worldProfiles.ts');
const profilesPath = path.join(userData, 'world-profiles.json');

test.after(() => fs.rmSync(userData, { recursive: true, force: true }));

test('visual identity validation rejects records that cannot safely identify an agent', () => {
  const valid = {
    version: 1,
    agentId: 'atlas',
    seed: 'munder-worlds:v1:atlas',
    appearances: { 'monster-trainer': { variant: 'moss' } },
    updatedAt: '2026-09-26T00:00:00.000Z'
  };
  assert.equal(Profiles.isVisualIdentityProfileV1(valid), true);
  assert.equal(Profiles.isVisualIdentityProfileV1({ ...valid, agentId: '' }), false);
  assert.equal(Profiles.isVisualIdentityProfileV1({ ...valid, version: 2 }), false);
  assert.equal(Profiles.isVisualIdentityProfileV1({ ...valid, appearances: [] }), false);
  assert.equal(Profiles.isVisualIdentityProfileV1({ ...valid, appearances: { tavern: {} } }), false);
});

test('a derived identity is stable and does not create persistent state', () => {
  const one = Repository.profileForAgent({}, 'atlas');
  const two = Repository.profileForAgent({}, 'atlas');
  assert.deepEqual(one, two);
  assert.equal(one.seed, 'munder-worlds:v1:atlas');
  assert.equal(fs.existsSync(profilesPath), false);
});

test('saved profiles round-trip and remain isolated by agent id', () => {
  const atlas = {
    version: 1,
    agentId: 'atlas',
    seed: 'atlas-seed',
    appearances: { 'monster-trainer': { variant: 'moss' } },
    updatedAt: '2026-09-26T01:00:00.000Z'
  };
  Repository.saveWorldProfile(atlas);
  const all = Repository.readWorldProfiles();
  assert.deepEqual(all.atlas, atlas);
  assert.equal(all.terra, undefined);
  assert.equal(Repository.profileForAgent(all, 'terra').seed, 'munder-worlds:v1:terra');
  assert.deepEqual(Repository.readWorldProfiles().atlas, atlas);
});

test('a malformed profile file is ignored without overwriting the original evidence', () => {
  const broken = '{ this is not json';
  fs.writeFileSync(profilesPath, broken, 'utf8');
  assert.deepEqual(Repository.readWorldProfiles(), {});
  assert.equal(fs.readFileSync(profilesPath, 'utf8'), broken);
});

test('repository rejects invalid profiles before any write', () => {
  assert.throws(
    () => Repository.saveWorldProfile({ version: 1, agentId: '', seed: 'x', appearances: {}, updatedAt: 'now' }),
    /invalid visual identity profile/
  );
});
