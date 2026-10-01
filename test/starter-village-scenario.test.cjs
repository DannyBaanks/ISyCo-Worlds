'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');
const { applyCompositionCommand, resolveRelativePoint, validateComposition } = loadTs('src/shared/worldComposition.ts');

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
  assert.equal(Scenario.integerScaleForViewport(800, 600), 2, 'a taller map must scroll vertically instead of shrinking when its width still fits at 2x');
  assert.equal(Scenario.integerScaleForViewport(2000, 700), 4, 'the available width determines the crisp display scale');
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
  assert.deepEqual(Scenario.STARTER_VILLAGE_SCENARIO.resources.map((resource) => resource.id), ['starter-village-atlas', 'starter-village-buildings', 'monster-professor-roster']);
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

test('Monster Trainer has a manifest-backed original building atlas and semantic structure catalog', () => {
  const buildingAtlasPath = path.join(root, 'src/renderer/src/assets/worlds/starter-village/starter-village-buildings.png');
  const attribution = fs.readFileSync(path.join(root, 'src/renderer/src/assets/ATTRIBUTION.md'), 'utf8');
  assert.equal(fs.existsSync(buildingAtlasPath), true, 'the building sprite atlas is a required world resource');
  const png = fs.readFileSync(buildingAtlasPath);
  assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a');
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  assert.equal(width, 512);
  assert.equal(height, 256);

  const frames = AtlasFrames.STARTER_VILLAGE_BUILDING_FRAMES;
  assert.deepEqual(Object.keys(frames), ['laboratory', 'stable-building', 'village-home']);
  for (const [id, frame] of Object.entries(frames)) {
    assert.ok(frame.x >= 0 && frame.y >= 0 && frame.width > 0 && frame.height > 0, `${id} frame has valid dimensions`);
    assert.ok(frame.x + frame.width <= width && frame.y + frame.height <= height, `${id} frame fits the PNG`);
  }
  assert.deepEqual([frames.laboratory.renderWidth, frames.laboratory.renderHeight], [96, 80]);
  assert.deepEqual([frames['stable-building'].renderWidth, frames['stable-building'].renderHeight], [96, 80]);
  assert.deepEqual([frames['village-home'].renderWidth, frames['village-home'].renderHeight], [64, 64]);

  const definition = Scenario.STARTER_VILLAGE_COMPOSITION_DEFINITION;
  assert.equal(definition.scenarioId, 'starter-village');
  assert.deepEqual(definition.terrainIds, ['grass', 'training-grass', 'dirt', 'road', 'water']);
  assert.equal(validateComposition({ version: 1, scenarioId: 'starter-village', placements: [], terrain: [] }, definition).ok, true);
  assert.equal(definition.objects.laboratory.footprint.width, 6);
  assert.equal(definition.objects.stable.footprint.width, 6);
  assert.equal(definition.objects['village-home'].footprint.width, 4);
  for (const [definitionId, assetId] of [['laboratory', 'laboratory'], ['stable', 'stable-building'], ['village-home', 'village-home']]) {
    const object = definition.objects[definitionId];
    const frame = frames[assetId];
    assert.deepEqual(
      [frame.renderWidth, frame.renderHeight],
      [object.footprint.width * Scenario.STARTER_VILLAGE_TILE_SIZE, object.footprint.height * Scenario.STARTER_VILLAGE_TILE_SIZE],
      `${definitionId} raster frame stays aligned with its logical multi-tile footprint`
    );
  }
  assert.equal(definition.objects.laboratory.stationKind, 'research');
  assert.ok(definition.objects.laboratory.interactionPoints.entrance);
  assert.equal(definition.objects.laboratory.interactionSlots[0].capacity, 1);
  assert.deepEqual(definition.objects.stable.affinities, ['care', 'training']);
  assert.ok(definition.objects.stable.interactionPoints.work);
  assert.deepEqual(Object.keys(Scenario.STARTER_VILLAGE_ASSET_CATALOG).sort(), Object.keys(definition.objects).sort());
  assert.ok(Scenario.STARTER_VILLAGE_SCENARIO.resources.some((resource) =>
    resource.id === 'starter-village-buildings' && resource.url.endsWith('starter-village-buildings.png')));
  assert.match(attribution, /starter-village-buildings\.png/);
  assert.match(attribution, /original.*pixel.art/i);
  assert.match(fs.readFileSync(path.join(root, 'src/renderer/src/worlds/worldRegistry.ts'), 'utf8'), /resources: STARTER_VILLAGE_SCENARIO\.resources/);
});

test('Starter Village preset is immutable, valid, and binds stable semantic anchors to building identities', () => {
  const preset = Scenario.STARTER_VILLAGE_PRESET;
  assert.equal(preset.version, 1);
  assert.equal(preset.scenarioId, 'starter-village');
  assert.ok(Array.isArray(preset.terrain), 'the persisted composition includes editable terrain');
  assert.equal(validateComposition(preset, Scenario.STARTER_VILLAGE_COMPOSITION_DEFINITION).ok, true);
  assert.ok(Object.isFrozen(preset) && Object.isFrozen(preset.placements) && Object.isFrozen(preset.terrain));
  assert.deepEqual(
    preset.placements.filter((placement) => ['laboratory', 'stable'].includes(placement.definitionId)).map((placement) => placement.id),
    ['lab-nw', 'stable-east']
  );
  assert.equal(Scenario.resolveStarterVillageAnchor(preset, 'professor').x, 6);
  assert.equal(Scenario.resolveStarterVillageAnchor(preset, 'stable').x, 18);
});

test('moving an authored building carries its semantic anchor and local interaction points', () => {
  const preset = Scenario.STARTER_VILLAGE_PRESET;
  const definition = Scenario.STARTER_VILLAGE_COMPOSITION_DEFINITION;
  const before = preset.placements.find((placement) => placement.id === 'lab-nw');
  const afterEdit = applyCompositionCommand({ present: preset, past: [] }, {
    type: 'move-object', placementId: 'lab-nw', x: 4, y: 2
  }, definition);
  assert.equal(afterEdit.ok, true);
  const after = afterEdit.state.present.placements.find((placement) => placement.id === 'lab-nw');
  assert.deepEqual(Scenario.resolveStarterVillageAnchor(afterEdit.state.present, 'professor'), { x: 7, y: 7 });
  assert.deepEqual(resolveRelativePoint(after, definition.objects.laboratory.interactionPoints.entrance), { x: 7, y: 7 });
  assert.deepEqual(resolveRelativePoint(after, definition.objects.laboratory.interactionPoints.work), { x: 8, y: 5 });
  assert.equal(before.x, 3, 'the immutable preset and the previous placement remain unchanged');
});

test('ORGANIC COMPOSITION witness rejects blocky, corner-clamped, or disconnected authored layouts', () => {
  const preset = Scenario.STARTER_VILLAGE_PRESET;
  const definition = Scenario.STARTER_VILLAGE_COMPOSITION_DEFINITION;
  const cells = new Map(preset.terrain.map((cell) => [`${cell.x},${cell.y}`, cell.terrainId]));
  const byType = (terrainId) => preset.terrain.filter((cell) => cell.terrainId === terrainId);
  const training = byType('training-grass');
  const rowWidths = new Set();
  for (let y = 0; y < definition.rows; y += 1) {
    const width = training.filter((cell) => cell.y === y).length;
    if (width) rowWidths.add(width);
  }
  assert.ok(rowWidths.size >= 3, 'the training grass outline has irregular row widths');

  // Supporting numeric gate: find the largest solid same-brush rectangle.
  let largestBrushRectangle = 0;
  for (const terrainId of definition.terrainIds) {
    for (let top = 0; top < definition.rows; top += 1) {
      const columnRuns = Array(definition.columns).fill(0);
      for (let bottom = top; bottom < definition.rows; bottom += 1) {
        for (let x = 0; x < definition.columns; x += 1) {
          columnRuns[x] = cells.get(`${x},${bottom}`) === terrainId ? columnRuns[x] + 1 : 0;
        }
        const height = bottom - top + 1;
        let width = 0;
        for (const current of columnRuns) {
          width = current === height ? width + 1 : 0;
          largestBrushRectangle = Math.max(largestBrushRectangle, width * height);
        }
      }
    }
  }
  assert.ok(largestBrushRectangle <= Math.floor(definition.columns * definition.rows * 0.1));

  const structures = preset.placements.filter((placement) => definition.objects[placement.definitionId].kind === 'structure');
  for (const placement of structures) {
    const { width, height } = definition.objects[placement.definitionId].footprint;
    assert.ok(placement.x >= 2 && placement.y >= 2, `${placement.id} is not clamped to the northwest map corner`);
    assert.ok(placement.x + width <= definition.columns - 2 && placement.y + height <= definition.rows - 2, `${placement.id} has environmental margin`);
  }

  const occupied = new Set();
  for (const placement of preset.placements) {
    const footprint = definition.objects[placement.definitionId].footprint;
    for (let y = placement.y; y < placement.y + footprint.height; y += 1) {
      for (let x = placement.x; x < placement.x + footprint.width; x += 1) occupied.add(`${x},${y}`);
    }
  }
  assert.ok(definition.columns * definition.rows - occupied.size >= definition.columns * definition.rows * 0.2, 'negative space remains available');

  const pathCells = new Set(preset.terrain.filter((cell) => cell.terrainId === 'dirt' || cell.terrainId === 'road').map(({ x, y }) => `${x},${y}`));
  for (const placement of structures) {
    const definitionForPlacement = definition.objects[placement.definitionId];
    const entrance = resolveRelativePoint(placement, definitionForPlacement.interactionPoints.entrance);
    const touchesPath = [[0, 0], [0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => pathCells.has(`${entrance.x + dx},${entrance.y + dy}`));
    assert.equal(touchesPath, true, `${placement.id} entrance connects naturally to the path network`);
  }
  assert.ok(training.some(({ x, y }) => [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => pathCells.has(`${x + dx},${y + dy}`))));
  const water = byType('water');
  assert.ok(water.length >= 20 && water.every(({ x, y }) => x > 0 && x < 23 && y < 23));
  assert.equal(water.some(({ y }) => y === 23), false, 'the southernmost edge remains grassy');

  const props = preset.placements.filter((placement) => definition.objects[placement.definitionId].kind === 'prop');
  const clusters = props.filter((center) => props.filter((item) => Math.abs(item.x - center.x) <= 2 && Math.abs(item.y - center.y) <= 2).length >= 3);
  const distinctClusterCenters = clusters.filter((center, index) => clusters.findIndex((item) => Math.abs(item.x - center.x) <= 2 && Math.abs(item.y - center.y) <= 2) === index);
  assert.ok(distinctClusterCenters.length >= 2, 'props form deliberate clusters rather than uniform scatter');

  const distances = new Set();
  for (let i = 0; i < structures.length; i += 1) {
    for (let j = i + 1; j < structures.length; j += 1) {
      distances.add(Math.abs(structures[i].x - structures[j].x) + Math.abs(structures[i].y - structures[j].y));
    }
  }
  assert.ok(distances.size >= 3, 'structure spacing has deliberate variety');
});
