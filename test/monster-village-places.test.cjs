'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const Places = loadTs('src/renderer/src/worlds/monster/villagePlaces.ts');
const Scenario = loadTs('src/renderer/src/worlds/monster/StarterVillageScenario.ts');
const Motion = loadTs('src/renderer/src/worlds/monster/monsterMovement.ts');
const { validateComposition } = loadTs('src/shared/worldComposition.ts');
const { normalizeWorldSnapshot } = loadTs('src/renderer/src/worlds/worldProjection.ts');

const working = (station, tool) => ({ id: 'a', state: 'working', station, tool });

test('every Hive station maps to one village place', () => {
  assert.equal(Places.placeForWorker(working('shelf', 'Read'), []), 'library');
  assert.equal(Places.placeForWorker(working('shelf', 'Grep'), []), 'library');
  assert.equal(Places.placeForWorker(working('desk', 'Edit'), []), 'workshop');
  assert.equal(Places.placeForWorker(working('desk', 'Write'), []), 'workshop');
  assert.equal(Places.placeForWorker(working('terminal', 'Bash'), []), 'stable');
  assert.equal(Places.placeForWorker(working('web', 'WebSearch'), []), 'observatory');
  assert.equal(Places.placeForWorker(working('board', 'TodoWrite'), []), 'notice-board');
  assert.equal(Places.placeForWorker(working('mailbox', 'TodoWrite'), []), 'post-office');
  assert.equal(Places.placeForWorker(working('mcp', 'MCP'), []), 'portal');
});

test('the resting desk default is not mistaken for crafting', () => {
  assert.equal(Places.placeForWorker(working('desk', undefined), []), 'training-grass');
  assert.equal(Places.placeForWorker(working(undefined, undefined), []), 'training-grass');
  assert.equal(Places.placeForWorker(working('constructor', undefined), []), 'training-grass', 'unknown stations never index the prototype');
});

test('stuck workers go to the Professor; resting workers use the plaza', () => {
  assert.equal(Places.placeForWorker({ id: 'a', state: 'blocked', station: 'terminal' }, []), 'professor');
  assert.equal(Places.placeForWorker(working('shelf', 'Read'), [{ assignee: 'a', awaitsHuman: true }]), 'professor');
  assert.equal(Places.placeForWorker({ id: 'a', state: 'waiting' }, []), 'well');
  assert.equal(Places.placeForWorker({ id: 'a', state: 'idle' }, []), 'village-idle');
});

test('the coordinator is the Professor: at the notice board when delegating, otherwise at the laboratory', () => {
  const god = (state, station) => ({ id: 'god', state, station, isGod: true });
  assert.equal(Places.placeForAgent(god('working', 'mailbox'), []), 'notice-board');
  assert.equal(Places.placeForAgent(god('working', 'board'), []), 'notice-board');
  assert.equal(Places.placeForAgent(god('working', 'shelf'), []), 'professor');
  assert.equal(Places.placeForAgent(god('idle', 'desk'), []), 'professor');
  assert.equal(Places.placeForAgent(god('blocked', 'desk'), []), 'professor');
  assert.equal(Motion.destinationForWorker(god('working', 'board'), []), 'notice-board');
});

test('the projection carries the coordinator flag and nothing else new', () => {
  const snapshot = normalizeWorldSnapshot([
    { id: 'god', name: 'Profesor', status: 'working', isGod: true },
    { id: 'w1', name: 'Agua', status: 'idle', isGod: 'yes' }
  ], []);
  assert.equal(snapshot.agents.find((agent) => agent.id === 'god').isGod, true);
  assert.equal('isGod' in snapshot.agents.find((agent) => agent.id === 'w1'), false);
});

test('every place has a label, an anchor inside the preset and a walkable route from the plaza', () => {
  const preset = Scenario.STARTER_VILLAGE_PRESET;
  assert.equal(validateComposition(preset, Scenario.STARTER_VILLAGE_COMPOSITION_DEFINITION).ok, true);
  assert.deepEqual(Scenario.STARTER_VILLAGE_ANCHOR_IDS, Places.VILLAGE_PLACE_IDS);
  const grid = Motion.createStarterVillageNavigation(preset);
  const plaza = Scenario.resolveStarterVillageAnchor(preset, 'village-idle');
  const locale = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/renderer/src/i18n/locales/en.json'), 'utf8'));
  for (const id of Places.VILLAGE_PLACE_IDS) {
    const anchor = Scenario.resolveStarterVillageAnchor(preset, id);
    assert.equal(grid.blocked.has(`${anchor.x},${anchor.y}`), false, `${id} anchor is walkable`);
    assert.ok(Motion.findTilePath(grid, plaza, anchor), `${id} is reachable from the plaza`);
    const key = Places.VILLAGE_PLACE_LABEL_KEYS[id].replace('worldsVisual.', '');
    assert.ok(locale.worldsVisual[key], `${id} has a label`);
  }
});

test('a station anchor follows a user-built object when the preset placement is absent', () => {
  const layout = { version: 1, scenarioId: 'starter-village', placements: [{ id: 'my-library', definitionId: 'library', x: 40, y: 30 }], terrain: [] };
  assert.deepEqual(Scenario.resolveStarterVillageAnchor(layout, 'library'), { x: 42, y: 34 });
  assert.deepEqual(Scenario.resolveStarterVillageAnchor({ ...layout, placements: [] }, 'library'), { x: 26, y: 17 });
});

test('the coordinator walks to the notice board and works there', () => {
  const motion = new Motion.MonsterWorkerMotion();
  const god = { id: 'god', name: 'Profesor', state: 'working', station: 'board', tool: 'TodoWrite', archived: false, isGod: true };
  motion.updateProjection([god], [], Scenario.STARTER_VILLAGE_PRESET);
  let [snapshot] = motion.snapshot();
  assert.equal(snapshot.destination, 'notice-board');
  for (let index = 0; index < 2000 && !snapshot.arrived; index += 1) [snapshot] = motion.tick(125);
  assert.equal(snapshot.arrived, true);
  assert.equal(snapshot.action, 'work');
});

test('the art spec lists every code-painted object and the drop-in folder exists', () => {
  const root = process.cwd();
  const spec = fs.readFileSync(path.join(root, 'docs/monster-village/ESPECIFICACIONES_ARTE.md'), 'utf8');
  const props = fs.readFileSync(path.join(root, 'src/renderer/src/worlds/monster/villageProps.ts'), 'utf8');
  const painted = ['library', 'workshop', 'observatory', 'portal', 'notice-board', 'mailbox', 'well', 'campfire',
    'bench', 'barrel', 'hay-bale', 'anvil', 'log-pile', 'training-dummy', 'market-stall'];
  for (const id of painted) {
    assert.ok(Scenario.STARTER_VILLAGE_ASSET_CATALOG[id], `${id} is in the build catalog`);
    assert.match(spec, new RegExp('\\| `' + id + '` \\| \\d+×\\d+ \\|'), `${id} has a size row in the art spec`);
  }
  assert.match(props, /VILLAGE_OBJECT_SPRITE_URLS\[assetId\]/, 'an authored PNG overrides the painter');
  assert.equal(fs.existsSync(path.join(root, 'src/renderer/src/assets/worlds/starter-village/objects/README.md')), true);
});
