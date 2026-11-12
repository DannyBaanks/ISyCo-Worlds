import { Assets, Container, Graphics, Rectangle, Sprite, Texture, TilingSprite } from 'pixi.js';
import type { IdentityForAgent } from '../identityResolver';
import type { WorldAgent, WorldTask } from '../worldProjection';
import { stateMarker, visualStateFor, type EvolutionStage } from './monsterArt';
import type { WorkerDirection, WorkerMotionSnapshot } from './monsterMovement';
import { resolveMonsterCharacter, type IsycoRosterCharacter, type MonsterRosterCharacter } from './rosterCharacters';
import { MONSTER_ACTOR_PX, MONSTER_ROSTER_URLS, monsterRosterFrame, type MonsterRosterAction } from './monsterRosterSprites';
import { locationReactionFrame, type LocationReactionBurst } from './locationReactions';
import {
  resolveStarterVillageAnchor, STARTER_VILLAGE_ANCHOR_IDS, STARTER_VILLAGE_ATLAS_URL, STARTER_VILLAGE_BUILDINGS_ATLAS_URL,
  STARTER_VILLAGE_COMPOSITION_DEFINITION, STARTER_VILLAGE_PRESET, STARTER_VILLAGE_SCENARIO,
  STARTER_VILLAGE_TILE_SIZE, type StarterVillageTileId
} from './StarterVillageScenario';
import { STARTER_VILLAGE_ATLAS_FRAMES, STARTER_VILLAGE_BUILDING_FRAMES } from './StarterVillageAtlasFrames';
import { compositionSpan, type WorldCompositionV1 } from '@shared/worldComposition';
import { proceduralObjectTexture } from './villageProps';
import type { VillagePlaceId } from './villagePlaces';
import {
  borderForestCells, cellHash, CHIMNEYS, cloudShadowTexture, glowTexture, groundDressingTexture,
  PROP_VISUALS, vignetteTexture, villageGroundModel
} from './villageDressing';

export const STARTER_VILLAGE_WIDTH = STARTER_VILLAGE_SCENARIO.map.columns * STARTER_VILLAGE_TILE_SIZE;
export const STARTER_VILLAGE_HEIGHT = STARTER_VILLAGE_SCENARIO.map.rows * STARTER_VILLAGE_TILE_SIZE;
export const STARTER_VILLAGE_STRUCTURE_LAYER_ORDER = [
  'contact-shadow', 'foundation', 'side-plane', 'facade', 'roof'
] as const;
export interface StarterVillageStructureRenderBounds { x: number; y: number; width: number; height: number; depth: number; }
export function structureRenderBounds(placement: { x: number; y: number }, footprint: { width: number; height: number }): StarterVillageStructureRenderBounds {
  const x = Math.round(placement.x * STARTER_VILLAGE_TILE_SIZE);
  const y = Math.round(placement.y * STARTER_VILLAGE_TILE_SIZE);
  const width = Math.round(footprint.width * STARTER_VILLAGE_TILE_SIZE);
  const height = Math.round(footprint.height * STARTER_VILLAGE_TILE_SIZE);
  return { x, y, width, height, depth: y + height };
}
const FRAMES: Record<StarterVillageTileId, Rectangle> = Object.fromEntries(
  Object.entries(STARTER_VILLAGE_ATLAS_FRAMES).map(([id, frame]) => [
    id,
    new Rectangle(frame.x, frame.y, frame.width, frame.height)
  ])
) as Record<StarterVillageTileId, Rectangle>;
export interface StarterVillageSceneOptions {
  agents: readonly WorldAgent[];
  tasks: readonly WorldTask[];
  identityFor: IdentityForAgent;
  onAgentSelect: (agentId: string) => void;
  onTaskOpen: (taskId: string) => void;
  composition?: WorldCompositionV1;
  selectedPlacementId?: string | null;
  buildMode?: boolean;
  onPlacementSelect?: (placementId: string) => void;
  workerMotions?: readonly WorkerMotionSnapshot[];
  growthStageForAgent?: (agentId: string) => EvolutionStage;
  locationReactions?: readonly LocationReactionBurst[];
  playerPosition?: { x: number; y: number };
  /** Freezes ambient motion (water, smoke, butterflies, clouds) on its first frame. */
  reducedMotion?: boolean;
}
export interface AnimatedStarterVillageScene extends Container {
  updateWorkers(motions: readonly WorkerMotionSnapshot[]): void;
  updateLocationReactions(reactions: readonly LocationReactionBurst[]): void;
  updatePlayer(position: { x: number; y: number }): void;
  /** Advances purely decorative motion; `timeMs` is a wall clock so rebuilt scenes stay in phase. */
  updateAmbient(timeMs: number): void;
}
const INK = 0x2b2440;
const SHADOW = 0x12261a;
const FX_Z = 1_000_000;

/**
 * Status bubble above a worker; the tail tip is the local origin. Each state
 * keeps its own shape (dot, bar, triangle, diamond) so it never rides on color alone.
 */
function drawStateBubble(graphics: Graphics, state: ReturnType<typeof visualStateFor>, place?: VillagePlaceId): void {
  const marker = stateMarker(state);
  graphics.clear();
  if (marker.shape === 'circle') {
    graphics.circle(0, -5, 3.5).fill({ color: INK, alpha: 0.85 });
    graphics.circle(0, -5, 2.5).fill({ color: marker.color });
    return;
  }
  graphics.roundRect(-8, -18, 16, 13, 3).fill({ color: INK });
  graphics.poly([-3, -6, 3, -6, 0, -1]).fill({ color: INK });
  graphics.roundRect(-7, -17, 14, 11, 2).fill({ color: 0xfff8e6 });
  graphics.poly([-1.5, -7, 1.5, -7, 0, -3]).fill({ color: 0xfff8e6 });
  if (marker.shape === 'bar' && place && drawActivityIcon(graphics, place)) {
    // The working bar stays as an underline so the state still has its own shape.
    graphics.rect(-5, -8, 10, 1).fill({ color: marker.color });
  } else if (marker.shape === 'bar') {
    graphics.rect(-5, -13, 10, 3).fill({ color: marker.color });
    graphics.rect(-5, -13, 3, 3).fill({ color: 0x2f8a3c });
  } else if (marker.shape === 'triangle') {
    graphics.poly([0, -16, 5, -8, -5, -8]).fill({ color: marker.color });
    graphics.rect(-0.5, -13.5, 1, 3).fill({ color: 0xfff8e6 });
    graphics.rect(-0.5, -9.8, 1, 1).fill({ color: 0xfff8e6 });
  } else {
    graphics.poly([0, -16.5, 5, -11.5, 0, -6.5, -5, -11.5]).fill({ color: marker.color });
    graphics.poly([0, -14, 2.5, -11.5, 0, -9, -2.5, -11.5]).fill({ color: 0xfff2bb });
  }
}

/** What the worker is doing right now, drawn from the place its station maps to. Icons sit in a 10×7 box. */
function drawActivityIcon(g: Graphics, place: VillagePlaceId): boolean {
  const px = (x: number, y: number, w: number, h: number, color: number): void => { g.rect(x, y, w, h).fill({ color }); };
  switch (place) {
    case 'library': // open book
      px(-5, -15, 10, 6, INK); px(-4, -15, 4, 5, 0xffffff); px(1, -15, 3, 5, 0xffffff); px(-3, -13, 2, 1, 0x9aa0b4); px(2, -13, 2, 1, 0x9aa0b4);
      return true;
    case 'workshop': // hammer
      px(-1, -14, 2, 5, 0x8a5a2c); px(-4, -16, 8, 3, 0x5f636b); px(-4, -16, 8, 1, 0xc9ccd0);
      return true;
    case 'stable': // terminal prompt
      px(-5, -16, 10, 7, INK); px(-4, -14, 1, 1, 0x63c76a); px(-3, -13, 1, 1, 0x63c76a); px(-4, -12, 1, 1, 0x63c76a); px(-1, -11, 4, 1, 0x63c76a);
      return true;
    case 'observatory': // globe
      g.circle(0, -12.5, 3.6).fill({ color: INK }); g.circle(0, -12.5, 2.8).fill({ color: 0x4aa3e0 });
      px(-2, -14, 2, 2, 0x63c76a); px(0, -12, 2, 2, 0x63c76a);
      return true;
    case 'notice-board': // checklist
      px(-4, -16, 8, 7, INK); px(-3, -15, 6, 5, 0xffffff); px(-2, -14, 1, 1, 0x63c76a); px(0, -14, 2, 1, 0x9aa0b4); px(-2, -12, 1, 1, 0x63c76a); px(0, -12, 2, 1, 0x9aa0b4);
      return true;
    case 'post-office': // envelope
      px(-5, -15, 10, 6, INK); px(-4, -14, 8, 4, 0xffffff); px(-3, -13, 1, 1, INK); px(-2, -12, 1, 1, INK); px(-1, -11, 2, 1, INK); px(1, -12, 1, 1, INK); px(2, -13, 1, 1, INK);
      return true;
    case 'portal': // crystal
      g.poly([0, -16.5, 3.5, -12.5, 0, -8.5, -3.5, -12.5]).fill({ color: INK });
      g.poly([0, -15.5, 2.5, -12.5, 0, -9.5, -2.5, -12.5]).fill({ color: 0x9a7cff }); px(-1, -14, 1, 2, 0xe6dcff);
      return true;
    default:
      return false;
  }
}

function contactShadowFor(width: number): Graphics {
  const shadow = new Graphics();
  shadow.ellipse(0, 0, width, Math.max(2, width / 3)).fill({ color: SHADOW, alpha: 0.26 });
  shadow.ellipse(0, 0, width * 0.62, Math.max(1.5, width / 5)).fill({ color: SHADOW, alpha: 0.2 });
  shadow.eventMode = 'none';
  return shadow;
}

/** The player's trainer: whole-pixel blocks with a one-pixel ink outline, feet at the local origin. */
function buildPlayerAvatar(): { avatar: Container; pointer: Graphics } {
  const avatar = new Container();
  avatar.label = 'monster-village-player';
  avatar.eventMode = 'none';
  avatar.addChild(contactShadowFor(7));
  const body = new Graphics();
  const parts: readonly (readonly [number, number, number, number, number])[] = [
    [-3, -5, 2, 5, 0x34457a], [1, -5, 2, 5, 0x34457a],
    [-3, -1, 2, 1, 0x4a2f1c], [1, -1, 2, 1, 0x4a2f1c],
    [-4, -11, 8, 6, 0xe0503c], [-1, -11, 2, 6, 0xfff2d8],
    [-5, -10, 1, 4, 0xe0503c], [4, -10, 1, 4, 0xe0503c],
    [-5, -6, 1, 1, 0xf2c79a], [4, -6, 1, 1, 0xf2c79a],
    [-3, -16, 6, 5, 0xf2c79a],
    [-4, -18, 8, 3, 0xfff2d8], [-4, -16, 9, 1, 0xe0503c], [-3, -19, 6, 1, 0xfff2d8]
  ];
  for (const [x, y, w, h] of parts) body.rect(x - 1, y - 1, w + 2, h + 2).fill({ color: INK });
  for (const [x, y, w, h, color] of parts) body.rect(x, y, w, h).fill({ color });
  body.rect(-2, -14, 1, 2).fill({ color: INK }).rect(1, -14, 1, 2).fill({ color: INK });
  body.rect(-4, -6, 8, 1).fill({ color: 0x4a2f1c });
  avatar.addChild(body);
  const pointer = new Graphics();
  pointer.poly([-4, -5, 4, -5, 0, 0]).fill({ color: INK });
  pointer.poly([-2.5, -4.5, 2.5, -4.5, 0, -1.5]).fill({ color: 0xffdf70 });
  avatar.addChild(pointer);
  return { avatar, pointer };
}
function requireRoster(character: IsycoRosterCharacter): Texture {
  const roster = Assets.get<Texture>(MONSTER_ROSTER_URLS[character]);
  if (!roster) throw new Error(`Monster Village roster for ${character} was not bootstrapped`);
  roster.source.scaleMode = 'nearest';
  return roster;
}

/** Feet stay on the cell baseline. A leftward step mirrors the right-facing walk. */
function applyActorPose(body: Sprite, source: Texture['source'], action: MonsterRosterAction, frame: number, direction: WorkerDirection): void {
  const rect = monsterRosterFrame(action, frame);
  body.texture = new Texture({ source, frame: new Rectangle(rect.x, rect.y, rect.width, rect.height) });
  body.width = MONSTER_ACTOR_PX;
  body.height = MONSTER_ACTOR_PX;
  body.scale.x = (direction === 'left' ? -1 : 1) * Math.abs(body.scale.x);
}

function drawGuide(root: Container, composition: WorldCompositionV1): void {
  const roster = requireRoster('professor');
  const position = resolveStarterVillageAnchor(composition, 'professor');
  const frame = monsterRosterFrame('idle', 0);
  const guide = new Sprite(new Texture({ source: roster.source, frame: new Rectangle(frame.x, frame.y, frame.width, frame.height) }));
  guide.label = 'monster-village-professor';
  guide.anchor.set(0.5, 1);
  guide.width = MONSTER_ACTOR_PX;
  guide.height = MONSTER_ACTOR_PX;
  guide.x = position.x * STARTER_VILLAGE_TILE_SIZE + STARTER_VILLAGE_TILE_SIZE / 2;
  guide.y = (position.y + 1) * STARTER_VILLAGE_TILE_SIZE;
  guide.zIndex = guide.y + 1;
  const shadow = contactShadowFor(9);
  shadow.x = guide.x; shadow.y = guide.y - 3; shadow.zIndex = guide.y - 0.5;
  root.addChild(shadow, guide);
}

function createCreatureSprite(roster: Texture, character: IsycoRosterCharacter): Sprite {
  const frame = monsterRosterFrame('idle', 0);
  const sprite = new Sprite(new Texture({ source: roster.source, frame: new Rectangle(frame.x, frame.y, frame.width, frame.height) }));
  sprite.label = character === 'professor' ? 'monster-village-professor' : `monster-village-worker-${character}`;
  sprite.width = MONSTER_ACTOR_PX;
  sprite.height = MONSTER_ACTOR_PX;
  sprite.anchor.set(0.5, 1);
  return sprite;
}

const FOLIAGE_TINTS = [0xffffff, 0xeaf6e0, 0xd6ecd0, 0xfff6dc] as const;

function tileSprite(atlas: Texture, tile: StarterVillageTileId, x: number, y: number): Sprite {
  const frame = STARTER_VILLAGE_ATLAS_FRAMES[tile];
  const sprite = new Sprite(new Texture({ source: atlas.source, frame: FRAMES[tile] }));
  const visual = PROP_VISUALS[tile];
  if (visual) {
    // Aspect-correct prop standing on the bottom edge of its logical tile.
    const grow = tile === 'tree' || tile === 'shrub' ? 0.9 + cellHash(x, y, 7) * 0.25 : 1;
    sprite.anchor.set(0.5, 1);
    sprite.width = Math.round(visual.width * grow);
    sprite.height = Math.round(visual.height * grow);
    sprite.x = x * STARTER_VILLAGE_TILE_SIZE + STARTER_VILLAGE_TILE_SIZE / 2;
    sprite.y = (y + 1) * STARTER_VILLAGE_TILE_SIZE + (visual.sink ?? 0);
    if (tile === 'tree') sprite.tint = FOLIAGE_TINTS[Math.floor(cellHash(x, y, 8) * FOLIAGE_TINTS.length)];
    return sprite;
  }
  sprite.width = frame.renderWidth;
  sprite.height = frame.renderHeight;
  if (frame.rotation) {
    sprite.anchor.set(0.5);
    sprite.angle = frame.rotation;
    sprite.x = x * STARTER_VILLAGE_TILE_SIZE + 8;
    sprite.y = y * STARTER_VILLAGE_TILE_SIZE + 8;
  } else {
    sprite.x = x * STARTER_VILLAGE_TILE_SIZE;
    sprite.y = y * STARTER_VILLAGE_TILE_SIZE;
  }
  return sprite;
}

function buildStructureLayers(atlas: Texture, frame: typeof STARTER_VILLAGE_BUILDING_FRAMES[keyof typeof STARTER_VILLAGE_BUILDING_FRAMES]): Container {
  const stack = new Container({ sortableChildren: true });
  stack.sortableChildren = true;

  const contactShadow = new Graphics();
  contactShadow.label = 'contact-shadow';

  const foundation = new Graphics();
  foundation.label = 'foundation';

  const sidePlane = new Graphics();
  sidePlane.label = 'side-plane';

  // The original raster already authors its own ground contact, foundation,
  // and side perspective. Keep those semantic slots empty rather than drawing
  // guessed geometry that appears detached from the house. Split the original
  // pixels with a four-pixel overlap so roof/facade can be depth-addressable
  // without resampling or seams; later artwork can supply real authored layers.
  const roofHeight = Math.min(42, frame.height);
  const split = Math.max(1, roofHeight - 4);
  const roofFrame = new Rectangle(frame.x, frame.y, frame.width, roofHeight);
  const facade = new Sprite(new Texture({
    source: atlas.source,
    frame: new Rectangle(frame.x, frame.y + split, frame.width, frame.height - split)
  }));
  facade.label = 'facade';
  facade.x = 0;
  facade.y = split;
  facade.width = frame.renderWidth;
  facade.height = frame.renderHeight - split;

  const roof = new Sprite(new Texture({
    source: atlas.source,
    frame: roofFrame
  }));
  roof.label = 'roof';
  roof.x = 0;
  roof.y = 0;
  roof.width = frame.renderWidth;
  roof.height = roofHeight;

  const layers = [contactShadow, foundation, sidePlane, facade, roof];
  layers.forEach((layer, index) => {
    layer.zIndex = index;
    stack.addChild(layer);
  });
  return stack;
}

/** Builds a scene from semantic layout data; the caller owns the Pixi application lifecycle. */
export function buildStarterVillageScene(options: StarterVillageSceneOptions): AnimatedStarterVillageScene {
  const atlas = Assets.get<Texture>(STARTER_VILLAGE_ATLAS_URL); if (!atlas) throw new Error('Starter Village atlas was not bootstrapped'); atlas.source.scaleMode = 'nearest';
  const buildingsAtlas = Assets.get<Texture>(STARTER_VILLAGE_BUILDINGS_ATLAS_URL); if (!buildingsAtlas) throw new Error('Starter Village buildings atlas was not bootstrapped'); buildingsAtlas.source.scaleMode = 'nearest';
  const composition = options.composition ?? STARTER_VILLAGE_PRESET;
  const root = new Container({ sortableChildren: true }) as AnimatedStarterVillageScene; root.sortableChildren = true;
  const reactionOverlay = new Graphics();
  reactionOverlay.label = 'location-reactions';
  reactionOverlay.zIndex = Number.MAX_SAFE_INTEGER;
  root.addChild(reactionOverlay);
  const { avatar: playerMarker, pointer: playerPointer } = buildPlayerAvatar();
  playerPointer.y = -24;
  root.addChild(playerMarker);
  root.updatePlayer = (position) => {
    playerMarker.x = position.x * STARTER_VILLAGE_TILE_SIZE + STARTER_VILLAGE_TILE_SIZE / 2;
    playerMarker.y = (position.y + 1) * STARTER_VILLAGE_TILE_SIZE - 1;
    playerMarker.zIndex = playerMarker.y + 0.25;
  };
  const groundFrame = STARTER_VILLAGE_ATLAS_FRAMES.grass;
  const groundTexture = new Texture({ source: atlas.source, frame: FRAMES.grass });
  const terrainLayer = new Container();
  terrainLayer.label = 'base-terrain';
  terrainLayer.zIndex = 0;
  const citySpan = compositionSpan(composition, STARTER_VILLAGE_SCENARIO.map.columns, STARTER_VILLAGE_SCENARIO.map.rows);
  const ground = new TilingSprite({
    texture: groundTexture,
    width: citySpan.columns * STARTER_VILLAGE_TILE_SIZE,
    height: citySpan.rows * STARTER_VILLAGE_TILE_SIZE
  });
  ground.tileScale.set(groundFrame.renderWidth / groundFrame.width, groundFrame.renderHeight / groundFrame.height);
  ground.zIndex = 0; terrainLayer.addChild(ground);

  for (const cell of composition.terrain) {
    const tile = cell.terrainId as StarterVillageTileId;
    const sprite = tileSprite(atlas, tile, cell.x, cell.y);
    sprite.zIndex = 1;
    terrainLayer.addChild(sprite);
  }
  const mapWidth = citySpan.columns * STARTER_VILLAGE_TILE_SIZE;
  const mapHeight = citySpan.rows * STARTER_VILLAGE_TILE_SIZE;
  const groundModel = villageGroundModel(composition, STARTER_VILLAGE_COMPOSITION_DEFINITION, citySpan.columns, citySpan.rows);
  // Painted once per layout: grass variation, path and shore edges, meadow details, cast shadows.
  const dressing = new Sprite(groundDressingTexture(composition, STARTER_VILLAGE_COMPOSITION_DEFINITION, citySpan.columns, citySpan.rows));
  dressing.label = 'ground-dressing';
  dressing.zIndex = 2;
  terrainLayer.addChild(dressing);
  const waterFx = new Graphics();
  waterFx.label = 'water-shimmer';
  waterFx.zIndex = 3;
  terrainLayer.addChild(waterFx);
  terrainLayer.sortableChildren = true;
  root.addChild(terrainLayer);

  // A decorative forest ring closes the map edge. It only stands on free grass, so it never fights the layout.
  for (const cell of borderForestCells(groundModel)) {
    const rows: readonly (readonly [number, number, number])[] = [
      [0, 0, 1],
      [cell.x === 0 ? -9 : cell.x === citySpan.columns - 1 ? 9 : 8, cell.y === 0 ? -9 : cell.y === citySpan.rows - 1 ? 7 : -7, 2]
    ];
    for (const [dx, dy, salt] of rows) {
      const tree = new Sprite(new Texture({ source: atlas.source, frame: FRAMES.tree }));
      const grow = 1 + cellHash(cell.x, cell.y, 20 + salt) * 0.3;
      tree.anchor.set(0.5, 1);
      tree.width = Math.round(PROP_VISUALS.tree.width * grow);
      tree.height = Math.round(PROP_VISUALS.tree.height * grow);
      tree.x = cell.x * STARTER_VILLAGE_TILE_SIZE + 8 + dx + Math.round((cellHash(cell.x, cell.y, 30 + salt) - 0.5) * 6);
      tree.y = (cell.y + 1) * STARTER_VILLAGE_TILE_SIZE + 3 + dy + Math.round((cellHash(cell.x, cell.y, 40 + salt) - 0.5) * 4);
      tree.tint = [0xd6ecd0, 0xc2e0c4, 0xeaf6e0][Math.floor(cellHash(cell.x, cell.y, 50 + salt) * 3)];
      tree.zIndex = tree.y;
      tree.eventMode = 'none';
      root.addChild(tree);
    }
  }
  const glows: Sprite[] = [];
  const addGlow = (x: number, y: number, size: number, alpha: number, tint = 0xffc070): void => {
    const glow = new Sprite(glowTexture());
    glow.anchor.set(0.5);
    glow.x = x; glow.y = y; glow.width = size; glow.height = size;
    glow.tint = tint;
    glow.alpha = alpha; glow.blendMode = 'add'; glow.zIndex = FX_Z; glow.eventMode = 'none';
    glow.label = `glow:${alpha}`;
    glows.push(glow);
    root.addChild(glow);
  };
  const chimneys: { x: number; y: number; seed: number }[] = [];
  const smokeFx = new Graphics();
  smokeFx.label = 'chimney-smoke';
  smokeFx.zIndex = FX_Z + 1;
  smokeFx.eventMode = 'none';
  root.addChild(smokeFx);

  const campfires: { x: number; y: number; seed: number }[] = [];
  const noticeBoards: { x: number; y: number; z: number }[] = [];
  const fireFx = new Graphics();
  fireFx.label = 'campfire-flames';
  fireFx.zIndex = FX_Z + 1;
  fireFx.eventMode = 'none';
  root.addChild(fireFx);

  for (const placement of composition.placements) {
    const object = STARTER_VILLAGE_COMPOSITION_DEFINITION.objects[placement.definitionId];
    if (!object) continue;
    const bounds = structureRenderBounds(placement, object.footprint);
    const z = bounds.depth;
    const buildingFrame = STARTER_VILLAGE_BUILDING_FRAMES[object.assetId as keyof typeof STARTER_VILLAGE_BUILDING_FRAMES];
    const painted = proceduralObjectTexture(object.assetId, buildingsAtlas);
    let sprite: Sprite | Container;
    if (object.kind === 'structure' && buildingFrame) {
      sprite = buildStructureLayers(buildingsAtlas, buildingFrame);
      sprite.x = placement.x * STARTER_VILLAGE_TILE_SIZE;
      sprite.y = placement.y * STARTER_VILLAGE_TILE_SIZE;
      const chimney = CHIMNEYS[object.assetId];
      if (chimney) chimneys.push({ x: sprite.x + chimney.x, y: sprite.y + chimney.y, seed: cellHash(placement.x, placement.y, 3) });
      addGlow(bounds.x + bounds.width / 2, bounds.y + bounds.height * 0.66, bounds.width * 0.9, 0.2);
    } else if (painted) {
      // Code-painted object: stands on the bottom edge of its footprint, centred.
      sprite = new Sprite(painted.texture);
      sprite.width = painted.width;
      sprite.height = painted.height;
      sprite.x = bounds.x + Math.round((bounds.width - painted.width) / 2);
      sprite.y = bounds.y + bounds.height - painted.height;
      const chimney = CHIMNEYS[object.assetId];
      if (chimney) chimneys.push({ x: sprite.x + chimney.x, y: sprite.y + chimney.y, seed: cellHash(placement.x, placement.y, 3) });
      if (object.assetId === 'library' || object.assetId === 'workshop') addGlow(bounds.x + bounds.width / 2, bounds.y + bounds.height * 0.66, bounds.width * 0.9, 0.2);
      else if (object.assetId === 'observatory') addGlow(bounds.x + 24, bounds.y + bounds.height - 34, 40, 0.3);
      else if (object.assetId === 'portal') addGlow(bounds.x + 16, bounds.y + bounds.height - 20, 58, 0.6, 0xa080ff);
      else if (object.assetId === 'campfire') { addGlow(bounds.x + 8, bounds.y + 6, 60, 0.6, 0xffa040); campfires.push({ x: bounds.x + 8, y: bounds.y + 9, seed: cellHash(placement.x, placement.y, 4) }); }
      else if (object.assetId === 'notice-board') noticeBoards.push({ x: sprite.x, y: sprite.y, z });
    } else {
      sprite = tileSprite(atlas, object.assetId as StarterVillageTileId, placement.x, placement.y);
      if (object.assetId === 'lantern') addGlow(bounds.x + 8, bounds.y + 5, 46, 0.55);
    }
    sprite.zIndex = z;
    root.addChild(sprite);
    if (options.buildMode && options.selectedPlacementId === placement.id) {
      const highlight = new Graphics();
      const x = placement.x * STARTER_VILLAGE_TILE_SIZE;
      const y = placement.y * STARTER_VILLAGE_TILE_SIZE;
      const width = object.footprint.width * STARTER_VILLAGE_TILE_SIZE;
      const height = object.footprint.height * STARTER_VILLAGE_TILE_SIZE;
      highlight.setFillStyle({ color: 0x82e3d3, alpha: 0.12 }).rect(x, y, width, height).fill();
      highlight.setStrokeStyle({ color: 0xbdfcf0, width: 1 }).rect(x, y, width, height).stroke();
      highlight.zIndex = z + 2;
      root.addChild(highlight);
    }
  }

  // Open work is pinned to the notice board: one note per task that nobody has finished yet.
  const openTasks = options.tasks.filter((task) => task.status !== 'done').length;
  for (const board of noticeBoards) {
    const notes = new Graphics();
    notes.eventMode = 'none';
    for (let index = 0; index < Math.min(openTasks, 8); index += 1) {
      const nx = board.x + 4 + (index % 4) * 6 + (index > 3 ? 1 : 0);
      const ny = board.y + 9 + Math.floor(index / 4) * 6;
      notes.rect(nx, ny, 4, 5).fill({ color: index % 3 === 1 ? 0xffe9a8 : 0xfff8e6 });
      notes.rect(nx + 1, ny, 2, 1).fill({ color: [0xe0503c, 0x4aa3e0, 0x63c76a][index % 3] });
      notes.rect(nx + 1, ny + 2, 2, 1).fill({ color: 0x9a8a70 });
    }
    notes.zIndex = board.z + 0.5;
    root.addChild(notes);
  }

  // The Professor is the coordinator. Without one in the snapshot a stand-in guide keeps the laboratory inhabited.
  if (!options.agents.some((agent) => agent.isGod)) drawGuide(root, composition);
  const agentById = new Map(options.agents.map((agent) => [agent.id, agent]));
  const actorVisuals = new Map<string, { body: Sprite; marker: Graphics; shadow: Graphics; source: Texture['source']; stage: EvolutionStage; action: string; direction: string; frame: number; visualState: string; place: string }>();
  let markerBob = 0;
  root.updateWorkers = (motions) => {
    for (const motion of motions) {
      const agent = agentById.get(motion.id);
      const visual = actorVisuals.get(motion.id);
      if (!agent || !visual) continue;
      const stage = options.growthStageForAgent?.(motion.id) ?? 'baby';
      if (visual.stage !== stage || visual.action !== motion.action || visual.direction !== motion.direction || visual.frame !== motion.frame || visual.visualState !== motion.visualState || visual.place !== (motion.arrived ? motion.destination : '')) {
        drawStateBubble(visual.marker, motion.visualState, motion.arrived ? motion.destination : undefined);
        applyActorPose(visual.body, visual.source, motion.action, motion.frame, motion.direction);
        visual.stage = stage; visual.action = motion.action; visual.direction = motion.direction; visual.frame = motion.frame; visual.visualState = motion.visualState; visual.place = motion.arrived ? motion.destination : '';
      }
      const footX = motion.x + STARTER_VILLAGE_TILE_SIZE / 2;
      const footY = motion.y + STARTER_VILLAGE_TILE_SIZE;
      visual.body.x = footX;
      visual.body.y = footY;
      const alert = motion.visualState === 'blocked' || motion.visualState === 'awaitsHuman';
      visual.marker.x = Math.round(footX);
      visual.marker.y = Math.round(visual.body.y - MONSTER_ACTOR_PX + 4 + (alert ? markerBob : 0));
      visual.shadow.x = footX;
      visual.shadow.y = footY - 3;
      visual.shadow.zIndex = footY - 0.5;
      visual.body.zIndex = footY;
      visual.marker.zIndex = FX_Z - 1;
    }
  };
  root.updateLocationReactions = (reactions) => {
    reactionOverlay.clear();
    for (const reaction of reactions) {
      if (!STARTER_VILLAGE_ANCHOR_IDS.includes(reaction.locationId as typeof STARTER_VILLAGE_ANCHOR_IDS[number])) continue;
      const anchor = resolveStarterVillageAnchor(composition, reaction.locationId as typeof STARTER_VILLAGE_ANCHOR_IDS[number]);
      const centerX = anchor.x * STARTER_VILLAGE_TILE_SIZE + STARTER_VILLAGE_TILE_SIZE / 2;
      const centerY = anchor.y * STARTER_VILLAGE_TILE_SIZE + STARTER_VILLAGE_TILE_SIZE / 2;
      const frame = locationReactionFrame(reaction.elapsedMs);
      reactionOverlay.setFillStyle({ color: 0xffdf70, alpha: frame.alpha * 0.52 })
        .rect(centerX - 4, centerY - 4, 8, 8).fill();
      reactionOverlay.setFillStyle({ color: 0xfff2bb, alpha: frame.alpha });
      for (const sparkle of frame.sparkles) {
        reactionOverlay.rect(centerX + sparkle.x, centerY + sparkle.y, 2, 2).fill();
      }
    }
  };
  options.agents.forEach((agent) => {
    const task = options.tasks.find((candidate) => candidate.assignee === agent.id);
    const character = agent.isGod ? 'professor' : resolveMonsterCharacter(agent.monsterCharacter, agent.id);
    const roster = requireRoster(character);
    const body = createCreatureSprite(roster, character);
    const marker = new Graphics();
    if (!options.buildMode) {
      body.eventMode = 'static'; body.cursor = 'pointer';
      body.on('pointertap', () => options.onAgentSelect(agent.id));
      marker.eventMode = 'static'; marker.cursor = 'pointer';
      marker.on('pointertap', () => task ? options.onTaskOpen(task.id) : options.onAgentSelect(agent.id));
    }
    const shadow = contactShadowFor(9);
    root.addChild(shadow, body, marker);
    actorVisuals.set(agent.id, { body, marker, shadow, source: roster.source, stage: 'baby', action: '', direction: '', frame: -1, visualState: '', place: '' });
  });

  // Ambient life. Everything is a pure function of the clock, so a rebuilt scene continues in phase.
  const waterCells = composition.terrain.filter((cell) => cell.terrainId === 'water');
  const clouds = [0, 1, 2].map((index) => {
    const cloud = new Sprite(cloudShadowTexture());
    cloud.anchor.set(0.5);
    cloud.width = 300 + index * 70; cloud.height = 150 + index * 30;
    cloud.alpha = 0.3; cloud.zIndex = FX_Z + 3; cloud.eventMode = 'none';
    root.addChild(cloud);
    return cloud;
  });
  const butterflies = new Graphics();
  butterflies.label = 'butterflies';
  butterflies.zIndex = FX_Z + 2;
  butterflies.eventMode = 'none';
  root.addChild(butterflies);
  const vignette = new Sprite(vignetteTexture());
  vignette.label = 'vignette';
  vignette.width = mapWidth; vignette.height = mapHeight;
  vignette.zIndex = FX_Z + 4; vignette.eventMode = 'none';
  root.addChild(vignette);
  const BUTTERFLY_TONES = [0xfff6d8, 0xffd84a, 0xff9ec4, 0x9fe0ff, 0xff7a5c] as const;
  const butterflyCount = Math.max(6, Math.round((citySpan.columns * citySpan.rows) / 340));
  let ambientDrawn = false;
  let waterStep = -1;
  root.updateAmbient = (timeMs) => {
    if (options.reducedMotion && ambientDrawn) return;
    const t = options.reducedMotion ? 0 : timeMs;
    ambientDrawn = true;
    markerBob = Math.round(Math.sin(t / 240) * 1.4);
    playerPointer.y = -24 + Math.round(Math.sin(t / 260) * 1.5);

    const step = Math.floor(t / 170);
    if (step !== waterStep) {
      waterStep = step;
      waterFx.clear();
      for (const cell of waterCells) {
        for (let glint = 0; glint < 2; glint += 1) {
          const phase = (step + Math.floor(cellHash(cell.x, cell.y, 100 + glint) * 46)) % 46;
          if (phase > 5) continue;
          const alpha = [0.3, 0.6, 0.85, 0.85, 0.6, 0.3][phase];
          const gx = cell.x * STARTER_VILLAGE_TILE_SIZE + 1 + Math.floor(cellHash(cell.x, cell.y, 110 + glint) * 10);
          const gy = cell.y * STARTER_VILLAGE_TILE_SIZE + 5 + Math.floor(cellHash(cell.x, cell.y, 120 + glint) * 9);
          waterFx.rect(gx, gy, 4, 1).fill({ color: 0xe6f6ff, alpha });
          waterFx.rect(gx + 1, gy + 1, 2, 1).fill({ color: 0xe6f6ff, alpha: alpha * 0.5 });
        }
      }
    }

    glows.forEach((glow, index) => {
      const base = Number(glow.label.slice(5));
      glow.alpha = base * (0.86 + 0.1 * Math.sin(t / 340 + index * 1.7) + 0.04 * Math.sin(t / 73 + index));
    });

    smokeFx.clear();
    for (const chimney of chimneys) {
      for (let puff = 0; puff < 5; puff += 1) {
        const age = (t / 3600 + chimney.seed + puff / 5) % 1;
        const size = 2 + Math.floor(age * 4);
        const x = chimney.x + Math.round(Math.sin(age * 5 + puff * 1.3) * 2 + age * 9) - size / 2;
        const y = chimney.y - Math.round(age * 26) - size / 2;
        smokeFx.rect(Math.round(x), Math.round(y), size, size).fill({ color: 0xf4efe6, alpha: (1 - age) * 0.5 });
      }
    }

    fireFx.clear();
    for (const fire of campfires) {
      const beat = Math.floor(t / 110 + fire.seed * 9);
      const sway = (beat % 3) - 1;
      const tall = 6 + (beat % 4);
      fireFx.rect(fire.x - 3, fire.y - 4, 6, 4).fill({ color: 0xe0503c });
      fireFx.rect(fire.x - 2 + sway, fire.y - tall, 4, tall - 2).fill({ color: 0xf08a2c });
      fireFx.rect(fire.x - 1 + sway, fire.y - tall + 2, 2, tall - 4).fill({ color: 0xffd84a });
      fireFx.rect(fire.x - 1, fire.y - 3, 2, 2).fill({ color: 0xfff6c8 });
      for (let spark = 0; spark < 3; spark += 1) {
        const age = (t / 1400 + fire.seed + spark / 3) % 1;
        fireFx.rect(fire.x + Math.round(Math.sin(age * 9 + spark * 2) * 4), fire.y - 8 - Math.round(age * 14), 1, 1).fill({ color: 0xffd84a, alpha: 1 - age });
      }
    }

    clouds.forEach((cloud, index) => {
      const lane = mapWidth + 520;
      cloud.x = ((t * (0.007 + index * 0.002) + cellHash(index, 0, 130) * lane) % lane) - 260;
      cloud.y = mapHeight * (0.2 + index * 0.3) + Math.sin(t / 9000 + index) * 14;
    });

    butterflies.clear();
    for (let index = 0; index < butterflyCount; index += 1) {
      const homeX = 30 + cellHash(index, 1, 140) * (mapWidth - 60);
      const homeY = 30 + cellHash(index, 2, 141) * (mapHeight - 60);
      const x = Math.round(homeX + Math.sin(t / 1900 + index * 2.1) * 26 + Math.sin(t / 430 + index) * 3);
      const y = Math.round(homeY + Math.sin(t / 1300 + index * 1.3) * 14 + Math.cos(t / 370 + index) * 2);
      const color = BUTTERFLY_TONES[index % BUTTERFLY_TONES.length];
      const open = Math.floor(t / 130 + index) % 2 === 0;
      butterflies.rect(x - 2, y + 3, 5, 1).fill({ color: SHADOW, alpha: 0.2 });
      butterflies.rect(x, y - 3, 1, 2).fill({ color: INK });
      if (open) butterflies.rect(x - 2, y - 4, 2, 2).fill({ color }).rect(x + 1, y - 4, 2, 2).fill({ color });
      else butterflies.rect(x - 1, y - 5, 1, 3).fill({ color }).rect(x + 1, y - 5, 1, 3).fill({ color });
    }
  };
  root.updateAmbient(typeof performance === 'undefined' ? 0 : performance.now());
  root.updateWorkers(options.workerMotions ?? []);
  root.updateLocationReactions(options.locationReactions ?? []);
  root.updatePlayer(options.playerPosition ?? { x: 34, y: 13 });
  return root;
}
