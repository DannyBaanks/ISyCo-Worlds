'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const source = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('App makes Office and Worlds mutually exclusive canvas surfaces while preserving operations', () => {
  const app = source('src/renderer/src/App.tsx');
  assert.match(app, /globalView === 'worlds' && <WorldsView/);
  assert.match(app, /globalView !== 'worlds' && <WorldHost/);
  assert.match(app, /<MemoryPanel\s*\/>/);
  assert.match(app, /<AgentStrip\s+config=\{config\}\s*\/>/);
  assert.doesNotMatch(app, /<OfficeFloor\s*\/>/);
});

test('Worlds owns the catalog; it contains no Office card and returns through its callback', () => {
  assert.equal(fs.existsSync(path.join(root, 'src/renderer/src/components/WorldSelector.tsx')), false);
  const worlds = source('src/renderer/src/worlds/WorldsView.tsx');
  const settings = source('src/renderer/src/components/WorldsSettings.tsx');
  for (const control of [worlds, settings]) {
    assert.match(control, /updateConfig\(/);
    assert.doesNotMatch(control, /hiveTasks|setAgent|archiveAgent|saveWorldProfile/);
  }
  assert.match(worlds, /WORLD_REGISTRY\.filter\(\(world\) => world\.id !== 'office'\)/);
  assert.match(worlds, /onClick=\{onReturnToOffice\}/);
  assert.match(worlds, /<WorldHost config=\{config\} \/>/);
  assert.match(settings, /worldsEnabled/);
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

test('WorldHost delegates selection to transactional lifecycle layers instead of branching by world id', () => {
  const host = source('src/renderer/src/worlds/WorldHost.tsx');
  const runtime = source('src/renderer/src/worlds/WorldRuntimeSurface.tsx');
  assert.match(host, /WorldEngine/);
  assert.match(host, /FALLBACK_WORLD_ID/);
  assert.doesNotMatch(host, /world\.id\s*===/);
  assert.match(runtime, /data-world-layer/);
  assert.match(runtime, /RECOVERY/);
  assert.match(host, /markDisposed/);
  assert.match(host, /setRetiredTokens[\s\S]*filter\(/, 'retired token bookkeeping is pruned after disposal');
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
