'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

test('each Pixi application releases ticker and renderer exactly once across repeated cleanup paths', () => {
  const { disposeWorldRendererOnce } = loadTs('src/renderer/src/worlds/pixiOwnership.ts');
  const counts = { ticker: 0, destroy: 0 };
  const app = {};
  const release = () => disposeWorldRendererOnce(app, () => {
    counts.ticker++;
    counts.destroy++;
  });

  assert.equal(release(), true);
  assert.equal(release(), false);
  assert.deepEqual(counts, { ticker: 1, destroy: 1 });

  const nextApp = {};
  assert.equal(disposeWorldRendererOnce(nextApp, () => { counts.destroy++; }), true);
  assert.equal(counts.destroy, 2, 'the guard is per application, not global');
});

test('renderer initialization waits for the previous Pixi owner to release its lease', async () => {
  const { acquireWorldRendererLease } = loadTs('src/renderer/src/worlds/pixiOwnership.ts');
  const releaseOffice = await acquireWorldRendererLease();
  let monsterEntered = false;
  const monster = acquireWorldRendererLease().then((release) => {
    monsterEntered = true;
    return release;
  });
  await Promise.resolve();
  assert.equal(monsterEntered, false);
  assert.equal(releaseOffice(), true);
  assert.equal(releaseOffice(), false, 'a renderer may release its lease only once');
  const releaseMonster = await monster;
  assert.equal(monsterEntered, true);
  assert.equal(releaseMonster(), true);
});

test('Office and Monster use the shared release guard on every app.destroy path', () => {
  const root = process.cwd();
  const office = fs.readFileSync(path.join(root, 'src/renderer/src/scene/office/OfficeFloor.tsx'), 'utf8');
  const monster = fs.readFileSync(path.join(root, 'src/renderer/src/worlds/monster/MonsterTrainerWorld.tsx'), 'utf8');
  assert.match(office, /disposeWorldRendererOnce\(app,/);
  assert.match(monster, /disposeWorldRendererOnce\(app,/);
  assert.equal((monster.match(/app\.destroy\(true\)/g) || []).length, 1);
});
