'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const Protocol = loadTs('src/shared/worldPresentationProtocol.ts');
const { WorldPresentationSupervisor } = loadTs('src/main/worldPresentationSupervisor.ts');
const root = path.resolve(__dirname, '..');
const layout = {
  version: 1,
  scenarioId: 'starter-village',
  placements: [{ id: 'lab-nw', definitionId: 'laboratory', x: 3, y: 2 }],
  terrain: [{ x: 1, y: 2, terrainId: 'water' }]
};
const projection = { agents: [], tasks: [] };

function fixture(profileId = 'monster-trainer') {
  const hosts = [];
  const intents = [];
  const supervisor = new WorldPresentationSupervisor({
    createHost: async (generation, emit) => {
      const host = { id: `world-${generation}`, commands: [], send(command) { this.commands.push(command); }, destroy() {}, emit };
      hosts.push(host);
      return host;
    },
    onStatus() {},
    onIntent: (intent) => intents.push(intent)
  });
  return { supervisor, hosts, intents, profileId };
}

test('composition bootstrap and save commands reject malformed versioned documents and arbitrary resource fields', () => {
  const bootstrap = { type: 'bootstrap', profileId: 'monster-trainer', generation: 1, projection, composition: { layout, source: 'preset' } };
  assert.equal(Protocol.isWorldPresentationCommand(bootstrap), true);
  assert.equal(Protocol.isWorldPresentationCommand({ ...bootstrap, composition: { layout: { ...layout, version: 9 }, source: 'preset' } }), false);
  assert.equal(Protocol.isWorldPresentationCommand({ ...bootstrap, composition: { layout, source: 'file:///tmp/layout.json' } }), false);
  assert.equal(Protocol.isWorldPresentationEvent({ type: 'intent', profileId: 'monster-trainer', generation: 1,
    intent: { type: 'save-composition', requestId: 'save-1', layout: { ...layout, placements: [{ ...layout.placements[0], url: 'file:///tmp/x' }] } } }), false);
  assert.equal(Protocol.isWorldPresentationEvent({ type: 'intent', profileId: 'monster-trainer', generation: 1,
    intent: { type: 'save-composition', requestId: 'save-1', layout } }), true);
});

test('save intents require the current READY Monster Trainer generation and return explicit save status', async () => {
  const { supervisor, hosts, intents } = fixture();
  await supervisor.start('monster-trainer', projection, { layout, source: 'preset' });
  const host = hosts[0];
  const intent = { type: 'save-composition', requestId: 'save-1', layout };
  assert.equal(host.emit({ type: 'intent', profileId: 'monster-trainer', generation: 1, intent }), false, 'not READY yet');
  host.emit({ type: 'ready', profileId: 'monster-trainer', generation: 1 });
  assert.equal(host.emit({ type: 'intent', profileId: 'monster-trainer', generation: 0, intent }), false, 'stale generation');
  assert.equal(host.emit({ type: 'intent', profileId: 'office', generation: 1, intent }), false, 'wrong profile');
  assert.equal(host.emit({ type: 'intent', profileId: 'monster-trainer', generation: 1, intent }), true);
  assert.deepEqual(intents, [intent]);
  assert.equal(supervisor.respondCompositionSave(0, 'save-1', true), false, 'stale acknowledgement rejected');
  assert.equal(supervisor.respondCompositionSave(1, 'save-1', true, layout), true);
  assert.deepEqual(host.commands.at(-1), {
    type: 'update-composition', profileId: 'monster-trainer', generation: 1,
    requestId: 'save-1', saveStatus: 'accepted', layout
  });
  assert.equal(host.emit({ type: 'intent', profileId: 'monster-trainer', generation: 1,
    intent: { type: 'save-composition', requestId: 'save-2', layout } }), true);
  assert.equal(supervisor.respondCompositionSave(1, 'save-2', false), true);
  assert.equal(host.commands.at(-1).saveStatus, 'rejected');
});

test('Office never accepts composition save intents', async () => {
  const { supervisor, hosts, intents } = fixture('office');
  await supervisor.start('office', projection);
  hosts[0].emit({ type: 'ready', profileId: 'office', generation: 1 });
  assert.equal(hosts[0].emit({ type: 'intent', profileId: 'office', generation: 1,
    intent: { type: 'save-composition', requestId: 'save-1', layout } }), false);
  assert.deepEqual(intents, []);
});

test('free-build controls are generic and cannot write Hive, agents, tasks, or arbitrary paths', () => {
  const toolbar = fs.readFileSync(path.join(root, 'src/renderer/src/worlds/composition/FreeBuildToolbar.tsx'), 'utf8');
  assert.match(toolbar, /Explore/);
  assert.match(toolbar, /Build/);
  assert.match(toolbar, /paint-terrain/);
  assert.match(toolbar, /resize-map/);
  assert.match(toolbar, /undo|Undo/i);
  assert.doesNotMatch(toolbar, /Grid X|Grid Y/);
  assert.doesNotMatch(toolbar, /window\.cth|hive|agent|spawn|task|file:|path/i);
});

test('parent hydrates and validates composition separately from semantic projection and child preload stays narrow', () => {
  const rootHost = fs.readFileSync(path.join(root, 'src/renderer/src/worlds/WorldHost.tsx'), 'utf8');
  const childPreload = fs.readFileSync(path.join(root, 'src/preload/worldHost.ts'), 'utf8');
  assert.match(rootHost, /getWorldComposition/);
  assert.match(rootHost, /validateComposition/);
  assert.match(rootHost, /saveWorldComposition/);
  assert.doesNotMatch(childPreload, /getWorldComposition|saveWorldComposition|world-composition:get|world-composition:save/);
});

test('layout edits render from composition data without recreating the Pixi application or touching semantic projection', () => {
  const world = fs.readFileSync(path.join(root, 'src/renderer/src/worlds/monster/MonsterTrainerWorld.tsx'), 'utf8');
  const scene = fs.readFileSync(path.join(root, 'src/renderer/src/worlds/monster/StarterVillageScene.ts'), 'utf8');
  assert.match(world, /buildStarterVillageScene\(\{ \.\.\.ctx, composition: ctx\.layout, workerMotions: motion\.snapshot\(\), locationReactions \}\)/);
  assert.match(world, /useEffect\([\s\S]*new Application\([\s\S]*\}, \[mapWidth, mapHeight\]\)/, 'composition and roster changes stay inside the visual renderer lifecycle');
  assert.match(scene, /for \(const cell of composition\.terrain\)/);
  assert.match(scene, /composition\.placements/);
  assert.match(scene, /selectedPlacementId/);
  assert.match(scene, /resolveStarterVillageAnchor/);
  assert.match(scene, /root\.updateWorkers/);
});
