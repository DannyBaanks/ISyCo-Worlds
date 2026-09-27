'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const source = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Monster Trainer builds the complete Starter Village scene instead of agent cards', () => {
  const world = source('src/renderer/src/worlds/monster/MonsterTrainerWorld.tsx');
  const scene = source('src/renderer/src/worlds/monster/StarterVillageScene.ts');
  assert.doesNotMatch(world, /drawSlot|SLOT_W|SLOT_H/, 'the card-slot layout is not retained behind the scene');
  assert.match(world, /buildStarterVillageScene/);
  assert.match(scene, /STARTER_VILLAGE_SCENARIO/);
  assert.match(scene, /Assets\.get/);
  assert.match(scene, /semanticAnchors|anchorPlacements/);
  assert.match(world, /integerScaleForViewport/);
  assert.match(scene, /scaleMode\s*=\s*'nearest'/);
});

test('MonsterTrainerWorld owns exactly one Pixi lifecycle and destroys it', () => {
  const world = source('src/renderer/src/worlds/monster/MonsterTrainerWorld.tsx');
  assert.match(world, /new Application\(/);
  assert.match(world, /app\.destroy\(/, 'the Pixi app is destroyed on unmount');
  assert.match(world, /\.slice\(0,\s*2\)/, 'at most two non-archived agents render');
  assert.match(world, /archived/, 'archived agents are filtered out');
  assert.match(world, /roundPixels|roundPixels:\s*true|Math\.round/, 'nearest-pixel rendering');
  assert.match(world, /onReady\?\.\(\)/, 'first successful render marks the staged world ready');
  assert.match(world, /app\.renderer\.render\(app\.stage\)[\s\S]*onReady\?\.\(\)/, 'READY follows a complete first Pixi frame');
  assert.match(world, /catch \(cause\) \{[\s\S]*if \(!alive\) return;[\s\S]*reportFailure\(cause\)/, 'a discarded async init cannot fail a newer staged mount');
  assert.match(world, /catch \(cause\) \{[\s\S]*release\(\)[\s\S]*if \(!alive\) return;/, 'a rejected init releases its partially allocated Pixi application');
  assert.match(world, /onDisposed\?\.\(\)/, 'the old renderer acknowledges only after release');
});

test('Starter Village structures use authored layer order, footprint bounds and scene-depth sorting', () => {
  const scene = source('src/renderer/src/worlds/monster/StarterVillageScene.ts');
  assert.match(scene, /STARTER_VILLAGE_STRUCTURE_LAYER_ORDER\s*=\s*\[[^\]]*contact-shadow[^\]]*foundation[^\]]*side-plane[^\]]*facade[^\]]*roof/s);
  assert.match(scene, /structureRenderBounds\(/, 'render bounds derive from logical placement footprint');
  assert.match(scene, /footprint\.width\s*\*\s*STARTER_VILLAGE_TILE_SIZE/);
  assert.match(scene, /footprint\.height\s*\*\s*STARTER_VILLAGE_TILE_SIZE/);
  assert.match(scene, /sortableChildren\s*=\s*true/);
  assert.match(scene, /const z = bounds\.depth[\s\S]*?sprite\.zIndex = z/);
  assert.match(scene, /layer\.zIndex\s*=\s*index/);
  assert.match(scene, /roofFrame/);
  assert.match(scene, /sidePlane/);
  assert.match(scene, /contactShadow/);
  assert.doesNotMatch(scene, /(?:contactShadow|foundation|sidePlane)\.setFillStyle/, 'do not invent detached geometry over the authored building raster');
});

test('layout and selection updates redraw in the owned renderer without entering its lifecycle dependencies', () => {
  const world = source('src/renderer/src/worlds/monster/MonsterTrainerWorld.tsx');
  assert.match(world, /ctx\.layout, ctx\.selectedPlacementId, ctx\.buildMode/);
  assert.match(world, /\}, \[activeIds, scale\]\)/, 'only active agents and integer scale recreate the Pixi application');
  assert.match(world, /roundPixels:\s*true/);
  assert.match(world, /app\.renderer\.render\(app\.stage\)/);
});

test('MonsterTrainerWorld receives only props and callbacks, never operational state', () => {
  const world = source('src/renderer/src/worlds/monster/MonsterTrainerWorld.tsx');
  assert.doesNotMatch(world, /useWorldProjection|hiveTasks|worldProfiles|useStore/, 'no operational imports or hooks');
  assert.doesNotMatch(world, /updateConfig|saveWorldProfile/, 'no writes');
  assert.match(world, /onAgentSelect/);
  assert.match(world, /onTaskOpen/);
});

test('MonsterTrainerSurface is the only component that reads the live projection', () => {
  const surface = source('src/renderer/src/worlds/monster/MonsterTrainerSurface.tsx');
  assert.match(surface, /useWorldProjection\(\)/);
  assert.match(surface, /onAgentSelect|select\(/, 'surface supplies the selection callback');
  assert.match(surface, /openTaskDetail|onTaskOpen/, 'surface supplies the task-open callback');
});

test('WorldHost renders the registered Monster surface inside its error boundary', () => {
  const host = source('src/renderer/src/worlds/WorldHost.tsx');
  const registry = source('src/renderer/src/worlds/worldRegistry.ts');
  const surface = source('src/renderer/src/worlds/monster/MonsterTrainerSurface.tsx');
  const world = source('src/renderer/src/worlds/monster/MonsterTrainerWorld.tsx');
  assert.match(registry, /MonsterTrainerSurface/);
  assert.match(host, /WorldRuntimeSurface/);
  assert.match(host, /onRenderFailure/);
  assert.match(surface, /onRenderFailure/, 'the surface forwards the recovery callback');
  assert.match(world, /onRenderFailure\?\.\(cause\)/, 'failed Pixi initialization reports its cause to the host');
  assert.match(world, /function reportFailure\(cause: unknown\)/, 'one guarded recovery path covers async rendering too');
  assert.match(world, /catch \(cause\)\s*\{\s*reportFailure\(cause\);\s*\}/, 'ticker\/render exceptions trigger the Office fallback');
});

test('the host owns one visible renderer and never reloads the page to switch worlds', () => {
  const host = source('src/renderer/src/worlds/WorldHost.tsx');
  const runtime = source('src/renderer/src/worlds/WorldRuntimeSurface.tsx');
  assert.doesNotMatch(host, /window\.location\.reload/);
  assert.match(host, /const mounts = visibleMounts/);
  assert.match(runtime, /data-world-active="true"/);
  assert.doesNotMatch(runtime, /opacity: active|pointerEvents: active/);
});
