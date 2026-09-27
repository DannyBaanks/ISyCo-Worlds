'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const root = process.cwd();
const Scenario = loadTs('src/renderer/src/worlds/monster/StarterVillageScenario.ts');
const AtlasFrames = loadTs('src/renderer/src/worlds/monster/StarterVillageAtlasFrames.ts');

test('Starter Village keeps semantic anchor identities independent from in-bounds placements', () => {
  assert.equal(Scenario.STARTER_VILLAGE_SCENARIO.id, 'starter-village');
  assert.deepEqual(Scenario.STARTER_VILLAGE_ANCHOR_IDS, [
    'professor', 'stable', 'training-grass', 'village-idle', 'route-exit'
  ]);
  assert.deepEqual(Scenario.STARTER_VILLAGE_SCENARIO.semanticAnchors, Scenario.STARTER_VILLAGE_ANCHOR_IDS);
  assert.equal(Scenario.STARTER_VILLAGE_SCENARIO.map.columns, 24);
  assert.equal(Scenario.STARTER_VILLAGE_SCENARIO.map.rows, 24);
  assert.deepEqual(
    Scenario.STARTER_VILLAGE_SCENARIO.map.layers.map((layer) => layer.id),
    ['backdrop', 'terrain', 'roads', 'structures', 'foreground']
  );

  for (const id of Scenario.STARTER_VILLAGE_ANCHOR_IDS) {
    const placement = Scenario.STARTER_VILLAGE_SCENARIO.anchorPlacements[id];
    assert.ok(placement, `${id} needs a replaceable visual placement`);
    assert.ok(placement.x >= 0 && placement.x < 24, `${id} x stays inside the scenario`);
    assert.ok(placement.y >= 0 && placement.y < 24, `${id} y stays inside the scenario`);
  }
});

test('Starter Village selects only integral scales and preserves 1x below map size', () => {
  assert.equal(Scenario.integerScaleForViewport(2000, 1600), 4);
  assert.equal(Scenario.integerScaleForViewport(1200, 1200), 3);
  assert.equal(Scenario.integerScaleForViewport(800, 800), 2);
  assert.equal(Scenario.integerScaleForViewport(500, 300), 1);
  assert.equal(Scenario.integerScaleForViewport(200, 200), 1);
});

test('Starter Village fills the ground continuously and extends its south training strip', () => {
  const backdrop = Scenario.STARTER_VILLAGE_SCENARIO.map.layers.find((layer) => layer.id === 'backdrop');
  assert.equal(backdrop.fill, 'grass', 'the base ground should be one repeating fill, not isolated outlined tiles');
  assert.deepEqual(backdrop.tiles, []);
  const training = Scenario.STARTER_VILLAGE_SCENARIO.map.layers.find((layer) => layer.id === 'terrain').tiles
    .filter((tile) => tile.tile === 'training-grass');
  assert.equal(training.some((tile) => tile.y >= 18), true, 'the lower field extends into the expanded southern map');
});

test('Starter Village lake sits inside grass, feeds a narrow southern river, and leaves a grass foot', () => {
  const water = Scenario.STARTER_VILLAGE_SCENARIO.map.layers.find((layer) => layer.id === 'terrain').tiles
    .filter((tile) => tile.tile === 'water');
  assert.ok(water.length > 20, 'the lake and river should read as a meaningful water feature');
  assert.ok(water.every((tile) => tile.x > 0 && tile.x < 23), 'water must be surrounded by grass, not clipped at a map edge');
  assert.ok(water.some((tile) => tile.x >= 9 && tile.x <= 16 && tile.y >= 13 && tile.y <= 19), 'the broad lake sits within the village grass');
  assert.deepEqual(water.filter((tile) => tile.y === 22).map((tile) => tile.x), [12], 'a one-tile river reaches near the southern edge');
  assert.equal(water.some((tile) => tile.y === 23), false, 'the final map row stays grass');

  const coords = new Set(water.map(({ x, y }) => `${x},${y}`));
  const reached = new Set();
  const queue = [water.find((tile) => tile.y === 22)];
  while (queue.length) {
    const tile = queue.shift();
    const key = `${tile.x},${tile.y}`;
    if (reached.has(key)) continue;
    reached.add(key);
    for (const [x, y] of [[tile.x - 1, tile.y], [tile.x + 1, tile.y], [tile.x, tile.y - 1], [tile.x, tile.y + 1]]) {
      const neighbor = `${x},${y}`;
      if (coords.has(neighbor) && !reached.has(neighbor)) queue.push({ x, y });
    }
  }
  assert.equal(reached.size, water.length, 'the southern stream is connected to the lake as one feature');
});

test('Starter Village adds a lower village home and distributes path-side props', () => {
  const layers = Scenario.STARTER_VILLAGE_SCENARIO.map.layers;
  const structures = layers.find((layer) => layer.id === 'structures').tiles;
  const foreground = layers.find((layer) => layer.id === 'foreground').tiles;
  assert.ok(structures.some((tile) => tile.tile === 'guide-house' && tile.y >= 18), 'a village home occupies the new lower space');
  assert.ok(structures.some((tile) => tile.tile === 'sign' && tile.y >= 17), 'a sign marks the lower path');
  assert.ok(foreground.some((tile) => tile.tile === 'flowers' && tile.y >= 18), 'flowers add life near the lower path');
  assert.ok(foreground.some((tile) => tile.tile === 'rock' && tile.y >= 18), 'a rock prop is distributed through the lower village');
});

test('Starter Village closes a reusable-fence corral directly below the stable', () => {
  const layers = Scenario.STARTER_VILLAGE_SCENARIO.map.layers;
  const fences = layers.find((layer) => layer.id === 'structures').tiles;
  const paddock = layers.find((layer) => layer.id === 'terrain').tiles;
  const at = (x, y) => fences.find((tile) => tile.x === x && tile.y === y)?.tile;
  for (let x = 16; x <= 19; x += 1) {
    assert.equal(at(x, 9), 'fence-horizontal', `north rail at ${x},9`);
    assert.equal(at(x, 14), 'fence-horizontal', `south rail at ${x},14`);
  }
  assert.equal(at(15, 9), 'fence-post');
  assert.equal(at(20, 9), 'fence-post');
  assert.equal(at(15, 14), 'fence-post');
  assert.equal(at(20, 14), 'fence-post');
  for (let y = 10; y <= 13; y += 1) {
    assert.equal(at(15, y), 'fence-vertical', `west rail at 15,${y}`);
    assert.equal(at(20, y), 'fence-vertical', `east rail at 20,${y}`);
  }
  for (let y = 10; y <= 13; y += 1) {
    for (let x = 16; x <= 19; x += 1) {
      assert.ok(paddock.some((tile) => tile.tile === 'training-grass' && tile.x === x && tile.y === y), `corral floor at ${x},${y}`);
    }
  }
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

test('Starter Village keeps a validated original PNG atlas alongside legacy art', () => {
  const atlasPath = path.join(root, 'src/renderer/src/assets/worlds/starter-village/starter-village-atlas.png');
  const attributionPath = path.join(root, 'src/renderer/src/assets/ATTRIBUTION.md');
  assert.equal(fs.existsSync(atlasPath), true, 'the replacement PNG atlas must be available to the manifest');
  const png = fs.readFileSync(atlasPath);
  assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a', 'replacement art must be a real PNG');
  assert.equal(png.readUInt32BE(16), 1448, 'generated atlas width is part of the validated frame layout');
  assert.equal(png.readUInt32BE(20), 1086, 'generated atlas height is part of the validated frame layout');
  const attribution = fs.readFileSync(attributionPath, 'utf8');
  assert.match(attribution, /starter-village-atlas\.png/);
  assert.match(attribution, /original.*pixel.art/i);
  assert.match(attribution, /starter-village-atlas\.svg/);
  assert.equal(Scenario.STARTER_VILLAGE_ATLAS_URL, atlasPath, 'the scenario manifest must resolve the PNG atlas');
  assert.deepEqual(Scenario.STARTER_VILLAGE_SCENARIO.resources.map((resource) => resource.id), ['starter-village-atlas']);
  assert.match(Scenario.STARTER_VILLAGE_SCENARIO.resources[0].url, /starter-village-atlas\.png$/);
  assert.deepEqual(Object.keys(AtlasFrames.STARTER_VILLAGE_ATLAS_FRAMES), [
    'grass', 'training-grass', 'dirt', 'road', 'water', 'tree', 'shrub', 'flowers',
    'guide-house', 'stable', 'fence-horizontal', 'fence-vertical', 'fence-post', 'rock', 'lantern', 'crate', 'sign'
  ]);
  for (const [id, frame] of Object.entries(AtlasFrames.STARTER_VILLAGE_ATLAS_FRAMES)) {
    assert.ok(frame.x >= 0 && frame.y >= 0, `${id} frame origin must be non-negative`);
    assert.ok(frame.width > 0 && frame.height > 0, `${id} frame must have area`);
    assert.ok(frame.x + frame.width <= png.readUInt32BE(16), `${id} frame must fit atlas width`);
    assert.ok(frame.y + frame.height <= png.readUInt32BE(20), `${id} frame must fit atlas height`);
    assert.deepEqual([frame.renderWidth, frame.renderHeight], id === 'guide-house' || id === 'stable' ? [64, 48] : [16, 16]);
  }
});
