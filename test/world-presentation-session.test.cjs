'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const root = path.resolve(__dirname, '..');
const source = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const { WorldEngine } = loadTs('src/renderer/src/worlds/WorldEngine.ts');

test('visual supervisor has no dependency on Harness stores, PTYs, Hive, or session lifecycle', () => {
  const supervisor = source('src/main/worldPresentationSupervisor.ts');
  const child = source('src/renderer/src/worlds/WorldPresentationHost.tsx');
  assert.doesNotMatch(supervisor, /from ['"].*(?:pty|hive|roster|session|config)/i);
  assert.doesNotMatch(child, /useStore|hiveTasks|pty:|world-profile:confirmActivation/);
  assert.match(supervisor, /onIntent\(event\.intent\)/);
});

test('missing dev and packaged resources report different causes while a primary Office remains READY', async () => {
  for (const runtime of ['dev', 'packaged']) {
    const cause = Object.assign(new Error(`${runtime} atlas unavailable`), {
      category: runtime === 'dev' ? 'external-resource' : 'resource'
    });
    const engine = new WorldEngine({
      worlds: [
        { id: 'office', resources: [{ id: 'office-map', url: 'office-map' }] },
        { id: 'monster-trainer', resources: [{ id: 'monster-atlas', url: 'monster-atlas' }] }
      ],
      fallbackWorldId: 'office',
      resolver: {
        runtime,
        async resolve(world, resource) {
          if (world.id === 'monster-trainer') throw cause;
          assert.equal(resource.id, 'office-map');
        }
      }
    });
    await engine.select('office');
    const office = engine.getState().candidate;
    engine.markReady(office.token);
    await engine.select('monster-trainer');
    const result = engine.getState();
    assert.equal(result.phase, 'READY');
    assert.equal(result.active.token, office.token);
    assert.equal(result.active.worldId, 'office');
    assert.equal(result.error.category, runtime === 'dev' ? 'external-resource' : 'resource');
    assert.equal(result.error.worldId, 'monster-trainer');
  }
});

test('profile restart handlers never reset PTYs or re-bootstrap Harness services', () => {
  const main = source('src/main/index.ts');
  const start = main.slice(main.indexOf("ipcMain.handle('world-presentation:start'"), main.indexOf("ipcMain.handle('world-presentation:updateProjection'"));
  const restart = main.slice(main.indexOf("ipcMain.handle('world-presentation:restart'"), main.indexOf("ipcMain.handle('world-presentation:dispose'"));
  assert.doesNotMatch(start, /activateWorldProfile|bootstrapHiveServices|ptyManager\.(?:kill|restart)|app\.relaunch/);
  assert.doesNotMatch(restart, /activateWorldProfile|bootstrapHiveServices|ptyManager\.(?:kill|restart)|app\.relaunch/);
  assert.match(restart, /restartVisual/);
});
