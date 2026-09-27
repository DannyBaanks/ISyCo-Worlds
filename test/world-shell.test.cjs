'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const source = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('App keeps the Office projection mounted and uses Worlds only for a missing runtime', () => {
  const app = source('src/renderer/src/App.tsx');
  assert.match(app, /if \(worldProfileStatus && !worldProfileStatus\.activeProfileId\)/);
  assert.match(app, /<WorldHost config=\{officeWorldConfig\} profileId=\{worldProfileStatus\?\.activeProfileId === 'monster-trainer' \? 'monster-trainer' : 'office'\} \/>/);
  assert.match(app, /<MemoryPanel\s*\/>/);
  assert.match(app, /<AgentStrip\s+config=\{config\}\s*\/>/);
  assert.doesNotMatch(app, /<OfficeFloor\s*\/>/);
});

test('Worlds owns the semantic profile selector and never mutates agent/task truth', () => {
  assert.equal(fs.existsSync(path.join(root, 'src/renderer/src/components/WorldSelector.tsx')), false);
  const worlds = source('src/renderer/src/worlds/WorldsView.tsx');
  const settings = source('src/renderer/src/components/WorldsSettings.tsx');
  for (const control of [worlds, settings]) {
    assert.match(control, /WorldsView/);
    assert.doesNotMatch(control, /hiveTasks|setAgent|archiveAgent|saveWorldProfile/);
  }
  assert.match(worlds, /WORLD_IDS\.map/);
  assert.match(worlds, /confirmWorldProfileActivation/);
  assert.doesNotMatch(worlds, /updateConfig\(\{\s*selectedWorld/);
});

test('global route restores only after async config hydration and persists user changes only', () => {
  const app = source('src/renderer/src/App.tsx');
  assert.match(app, /const globalViewHydrated = useRef\(false\)/);
  assert.match(app, /if \(!config \|\| globalViewHydrated\.current\) return/);
  assert.match(app, /globalViewHydrated\.current = true/);
  assert.match(app, /config\.lastGlobalView/);
  assert.match(app, /const onGlobalViewChange/);
  assert.match(app, /window\.cth\.updateConfig\(\{ lastGlobalView: nextView \}\)/);
  assert.match(app, /onView=\{onGlobalViewChange\}/);
});

test('WorldHost delegates scene lifecycle to WorldEngine and selects isolated presentation only at the host boundary', () => {
  const host = source('src/renderer/src/worlds/WorldHost.tsx');
  const runtime = source('src/renderer/src/worlds/WorldRuntimeSurface.tsx');
  assert.match(host, /WorldEngine/);
  assert.match(host, /FALLBACK_WORLD_ID/);
  assert.doesNotMatch(host, /world\.id\s*===/);
  assert.match(host, /startWorldPresentation/);
  assert.match(host, /WorldSceneHost/);
  assert.match(runtime, /data-world-layer/);
  assert.match(runtime, /RECOVERY/);
  assert.match(host, /markDisposed/);
  assert.match(host, /onDisposed=\{\(token\) => engine\.markDisposed\(token\)\}/, 'the renderer itself acknowledges disposal');
  assert.doesNotMatch(host, /queueMicrotask/, 'a scheduled callback is not proof Pixi has been destroyed');
  assert.match(runtime, /onDisposed: \(\) => onDisposed\(mount\.token\)/);
});

test('Monster Trainer keeps a scrollable integer-scale viewport for Starter Village', () => {
  const world = source('src/renderer/src/worlds/monster/MonsterTrainerWorld.tsx');
  assert.match(world, /overflow:\s*'auto'/);
  assert.match(world, /ResizeObserver/);
  assert.match(world, /observer\.disconnect\(\)/);
  assert.match(world, /integerScaleForViewport/);
});

test('World translations expose the same key set in every supported locale', () => {
  const locales = ['en.json', 'es.json', 'zh-CN.json', 'ar.json'].map((file) =>
    JSON.parse(fs.readFileSync(path.join(root, 'src/renderer/src/i18n/locales', file), 'utf8')).settings.general.worlds
  );
  const keys = Object.keys(locales[0]).sort();
  for (const entry of locales.slice(1)) assert.deepEqual(Object.keys(entry).sort(), keys);
});
