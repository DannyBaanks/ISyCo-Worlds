'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const root = process.cwd();
const Scenario = loadTs('src/renderer/src/worlds/monster/StarterVillageScenario.ts');

test('Starter Village keeps semantic anchor identities independent from in-bounds placements', () => {
  assert.equal(Scenario.STARTER_VILLAGE_SCENARIO.id, 'starter-village');
  assert.deepEqual(Scenario.STARTER_VILLAGE_ANCHOR_IDS, [
    'professor', 'stable', 'training-grass', 'village-idle', 'route-exit'
  ]);
  assert.deepEqual(Scenario.STARTER_VILLAGE_SCENARIO.semanticAnchors, Scenario.STARTER_VILLAGE_ANCHOR_IDS);
  assert.equal(Scenario.STARTER_VILLAGE_SCENARIO.map.columns, 24);
  assert.equal(Scenario.STARTER_VILLAGE_SCENARIO.map.rows, 16);
  assert.deepEqual(
    Scenario.STARTER_VILLAGE_SCENARIO.map.layers.map((layer) => layer.id),
    ['backdrop', 'terrain', 'roads', 'structures', 'foreground']
  );

  for (const id of Scenario.STARTER_VILLAGE_ANCHOR_IDS) {
    const placement = Scenario.STARTER_VILLAGE_SCENARIO.anchorPlacements[id];
    assert.ok(placement, `${id} needs a replaceable visual placement`);
    assert.ok(placement.x >= 0 && placement.x < 24, `${id} x stays inside the scenario`);
    assert.ok(placement.y >= 0 && placement.y < 16, `${id} y stays inside the scenario`);
  }
});

test('Starter Village selects only integral scales and preserves 1x below map size', () => {
  assert.equal(Scenario.integerScaleForViewport(2000, 1300), 4);
  assert.equal(Scenario.integerScaleForViewport(1200, 800), 3);
  assert.equal(Scenario.integerScaleForViewport(800, 600), 2);
  assert.equal(Scenario.integerScaleForViewport(500, 300), 1);
  assert.equal(Scenario.integerScaleForViewport(200, 200), 1);
});

test('Starter Village atlas is original project artwork with reusable source-pixel tiles', () => {
  const atlasPath = path.join(root, 'src/renderer/src/assets/worlds/starter-village/starter-village-atlas.svg');
  const attributionPath = path.join(root, 'src/renderer/src/assets/ATTRIBUTION.md');
  assert.equal(fs.existsSync(atlasPath), true, 'the scenario must ship its required atlas');
  const atlas = fs.readFileSync(atlasPath, 'utf8');
  assert.match(atlas, /Munder Worlds original artwork/);
  assert.match(atlas, /viewBox="0 0 128 96"/);
  assert.match(atlas, /shape-rendering="crispEdges"/);
  assert.match(atlas, /data-tile="terrain-grass"/);
  assert.match(atlas, /data-tile="guide-house"/);
  assert.match(atlas, /data-tile="stable"/);
  assert.match(fs.readFileSync(attributionPath, 'utf8'), /starter-village-atlas\.svg/);
});
