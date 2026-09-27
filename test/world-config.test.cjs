'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'md-world-config-'));
const electron = require.resolve('electron');
require.cache[electron] = {
  id: electron,
  filename: electron,
  loaded: true,
  exports: { app: { getPath: () => userData } }
};

const W = loadTs('src/shared/worlds.ts');
const { readConfig, writeConfig } = loadTs('src/main/config.ts');

test.after(() => fs.rmSync(userData, { recursive: true, force: true }));

test('World IDs admit only the renderers that config can select', () => {
  assert.deepEqual(W.WORLD_IDS, ['office', 'monster-trainer']);
  assert.equal(W.isWorldId('office'), true);
  assert.equal(W.isWorldId('monster-trainer'), true);
  assert.equal(W.isWorldId('tavern'), false);
  assert.equal(W.isWorldId(''), false);
  assert.equal(W.isWorldId(null), false);
});

test('World preferences default safely, persist, and reject an unknown renderer', () => {
  const fresh = readConfig();
  assert.equal(fresh.worldsEnabled, false);
  assert.equal(fresh.selectedWorld, 'office');

  writeConfig({ worldsEnabled: true, selectedWorld: 'monster-trainer' });
  const saved = readConfig();
  assert.equal(saved.worldsEnabled, true);
  assert.equal(saved.selectedWorld, 'monster-trainer');

  fs.writeFileSync(
    path.join(userData, 'config.json'),
    JSON.stringify({ ...saved, selectedWorld: 'not-a-world' }),
    'utf8'
  );
  assert.equal(readConfig().selectedWorld, 'office');
});
