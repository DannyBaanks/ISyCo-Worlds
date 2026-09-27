'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const root = path.resolve(__dirname, '..');
const source = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const { WorldEngine } = loadTs('src/renderer/src/worlds/WorldEngine.ts');
const { WorldPresentationSupervisor } = loadTs('src/main/worldPresentationSupervisor.ts');

function createEngine({ fail = new Set() } = {}) {
  const manifests = [
    { id: 'office', resources: [{ id: 'office-tiles', url: '/assets/office-tileset.png' }] },
    { id: 'monster-trainer', resources: [{ id: 'starter-village-atlas', url: '/assets/starter-village-atlas.png' }] }
  ];
  const states = [];
  const engine = new WorldEngine({
    worlds: manifests,
    fallbackWorldId: 'office',
    resolver: { runtime: 'test', async resolve(world, resource) {
      if (fail.has(`${world.id}/${resource.id}`)) throw new Error(`missing ${resource.url}`);
    } },
    onStateChange: (state) => states.push(state)
  });
  return { engine, states };
}

test('Office and Monster Trainer keep required resources in the allowlisted world manifest', () => {
  const registry = source('src/renderer/src/worlds/worldRegistry.ts');
  const scenario = source('src/renderer/src/worlds/monster/StarterVillageScenario.ts');
  const officeTheme = source('src/renderer/src/scene/office/themeRegistry.ts');
  assert.match(registry, /id: 'office'/);
  assert.match(registry, /id: 'monster-trainer'/);
  assert.match(registry, /OFFICE_THEME\.tilesets/);
  assert.match(registry, /STARTER_VILLAGE_SCENARIO\.resources/);
  assert.match(scenario, /starter-village-atlas/);
  assert.match(officeTheme, /tileset/);
});

test('a mounted world is not reported READY until its renderer reports a complete first frame', async () => {
  const { engine, states } = createEngine();
  await engine.select('monster-trainer');
  const candidate = engine.getState().candidate;
  assert.equal(engine.getState().phase, 'MOUNTING');
  assert.equal(states.some((state) => state.phase === 'READY'), false);
  assert.equal(engine.markReady(candidate.token), true);
  assert.equal(engine.getState().phase, 'READY');
});

test('a missing required atlas keeps a structured resource failure for the main Recovery surface', async () => {
  const { engine } = createEngine({ fail: new Set(['monster-trainer/starter-village-atlas']) });
  await engine.select('monster-trainer');
  const state = engine.getState();
  assert.equal(state.phase, 'MOUNTING', 'Office is attempted once when there is no current READY world');
  assert.equal(state.candidate.worldId, 'office');
  assert.equal(state.error.phase, 'BOOTSTRAPPING');
  assert.equal(state.error.worldId, 'monster-trainer');
  assert.match(state.error.cause.message, /starter-village-atlas/);
});

test('the standalone child entry consumes only the narrow world bridge, never the Harness renderer or store', () => {
  const config = source('electron.vite.config.ts');
  const html = source('src/renderer/world-host.html');
  const entry = source('src/renderer/src/worldHost.tsx');
  const host = source('src/renderer/src/worlds/WorldPresentationHost.tsx');
  assert.match(config, /world-host\.html/);
  assert.match(html, /worldHost\.tsx/);
  assert.match(entry, /WorldPresentationHost/);
  assert.match(host, /window\.worldPresentation/);
  assert.doesNotMatch(host, /useStore|hiveTasks|WorldsView|App/);
});

test('the main renderer routes only a snapshot and geometry; profile start is not a Harness restart', () => {
  const primary = source('src/renderer/src/worlds/WorldHost.tsx');
  const main = source('src/main/index.ts');
  assert.match(primary, /startWorldPresentation/);
  assert.match(primary, /updateWorldPresentation/);
  assert.match(primary, /setWorldPresentationBounds/);
  assert.match(main, /world-presentation:start/);
  assert.match(main, /new WebContentsView/);
  assert.doesNotMatch(main.slice(main.indexOf("ipcMain.handle('world-presentation:start'"), main.indexOf("ipcMain.handle('world-presentation:updateProjection'")), /activateWorldProfile|bootstrapHiveServices|ptyManager\.kill/);
});

test('three consecutive child restarts return renderer ownership to one live host with one disposal per retired host', async () => {
  const hosts = [];
  const supervisor = new WorldPresentationSupervisor({
    createHost: async (generation, emit) => {
      const host = { id: generation, destroyed: 0, emit, send() {}, async destroy() { this.destroyed += 1; } };
      hosts.push(host);
      return host;
    },
    onStatus: () => {},
    onIntent: () => {}
  });
  await supervisor.start('monster-trainer', { agents: [], tasks: [] });
  for (let count = 0; count < 3; count += 1) {
    const retired = hosts.at(-1);
    await supervisor.restartVisual();
    assert.equal(retired.destroyed, 1);
    assert.equal(hosts.filter((host) => host.destroyed === 0).length, 1);
    assert.equal(retired.emit({ type: 'ready', profileId: 'monster-trainer', generation: count + 1 }), false);
  }
  await supervisor.dispose();
  assert.equal(hosts.length, 4);
  assert.deepEqual(hosts.map((host) => host.destroyed), [1, 1, 1, 1]);
  assert.equal(supervisor.getStatus().phase, 'IDLE');
});
