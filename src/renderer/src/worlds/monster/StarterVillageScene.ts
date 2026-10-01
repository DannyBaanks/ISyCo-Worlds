import { Assets, Container, Graphics, Rectangle, Sprite, Text, Texture, TilingSprite } from 'pixi.js';
import type { IdentityForAgent } from '../identityResolver';
import type { WorldAgent, WorldTask } from '../worldProjection';
import { creatureFramePlan, stateMarker, visualStateFor, type EvolutionStage } from './monsterArt';
import type { WorkerMotionSnapshot } from './monsterMovement';
import { locationReactionFrame, type LocationReactionBurst } from './locationReactions';
import {
  resolveStarterVillageAnchor, STARTER_VILLAGE_ANCHOR_IDS, STARTER_VILLAGE_ATLAS_URL, STARTER_VILLAGE_BUILDINGS_ATLAS_URL,
  MONSTER_PROFESSOR_ROSTER_URL, STARTER_VILLAGE_COMPOSITION_DEFINITION, STARTER_VILLAGE_PRESET, STARTER_VILLAGE_SCENARIO,
  STARTER_VILLAGE_TILE_SIZE, type StarterVillageTileId
} from './StarterVillageScenario';
import { STARTER_VILLAGE_ATLAS_FRAMES, STARTER_VILLAGE_BUILDING_FRAMES } from './StarterVillageAtlasFrames';
import type { WorldCompositionV1 } from '@shared/worldComposition';

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
}
export interface AnimatedStarterVillageScene extends Container {
  updateWorkers(motions: readonly WorkerMotionSnapshot[]): void;
  updateLocationReactions(reactions: readonly LocationReactionBurst[]): void;
}
function markerFor(state: ReturnType<typeof visualStateFor>, x: number, y: number): Graphics { const marker = stateMarker(state); const graphics = new Graphics().setFillStyle({ color: marker.color }); if (marker.shape === 'circle') graphics.circle(x + 4, y + 4, 4).fill(); else if (marker.shape === 'bar') graphics.rect(x, y + 2, 8, 4).fill(); else if (marker.shape === 'triangle') graphics.poly([x + 4, y, x + 8, y + 8, x, y + 8]).fill(); else graphics.poly([x + 4, y, x + 8, y + 4, x + 4, y + 8, x, y + 4]).fill(); return graphics; }
function drawGuide(root: Container, composition: WorldCompositionV1): void {
  const roster = Assets.get<Texture>(MONSTER_PROFESSOR_ROSTER_URL);
  if (!roster) throw new Error('Monster Village professor art was not bootstrapped');
  roster.source.scaleMode = 'nearest';
  const position = resolveStarterVillageAnchor(composition, 'professor');
  const frame = new Rectangle(roster.source.width * 4 / 5, 0, roster.source.width / 5, roster.source.height);
  const guide = new Sprite(new Texture({ source: roster.source, frame }));
  const width = 32;
  const height = 48;
  guide.label = 'monster-village-professor';
  guide.width = width;
  guide.height = height;
  guide.x = Math.round(position.x * STARTER_VILLAGE_TILE_SIZE + (STARTER_VILLAGE_TILE_SIZE - width) / 2);
  guide.y = Math.round(position.y * STARTER_VILLAGE_TILE_SIZE + STARTER_VILLAGE_TILE_SIZE - height);
  guide.zIndex = position.y * STARTER_VILLAGE_TILE_SIZE + STARTER_VILLAGE_TILE_SIZE + 1;
  root.addChild(guide);
}

function tileSprite(atlas: Texture, tile: StarterVillageTileId, x: number, y: number): Sprite {
  const frame = STARTER_VILLAGE_ATLAS_FRAMES[tile];
  const sprite = new Sprite(new Texture({ source: atlas.source, frame: FRAMES[tile] }));
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
  const groundFrame = STARTER_VILLAGE_ATLAS_FRAMES.grass;
  const groundTexture = new Texture({ source: atlas.source, frame: FRAMES.grass });
  const terrainLayer = new Container();
  terrainLayer.label = 'base-terrain';
  terrainLayer.zIndex = 0;
  const ground = new TilingSprite({ texture: groundTexture, width: STARTER_VILLAGE_WIDTH, height: STARTER_VILLAGE_HEIGHT });
  ground.tileScale.set(groundFrame.renderWidth / groundFrame.width, groundFrame.renderHeight / groundFrame.height);
  ground.zIndex = 0; terrainLayer.addChild(ground);

  for (const cell of composition.terrain) {
    const tile = cell.terrainId as StarterVillageTileId;
    const sprite = tileSprite(atlas, tile, cell.x, cell.y);
    sprite.zIndex = 1;
    terrainLayer.addChild(sprite);
  }
  root.addChild(terrainLayer);

  for (const placement of composition.placements) {
    const object = STARTER_VILLAGE_COMPOSITION_DEFINITION.objects[placement.definitionId];
    if (!object) continue;
    const bounds = structureRenderBounds(placement, object.footprint);
    const z = bounds.depth;
    const buildingFrame = STARTER_VILLAGE_BUILDING_FRAMES[object.assetId as keyof typeof STARTER_VILLAGE_BUILDING_FRAMES];
    let sprite: Sprite | Container;
    if (object.kind === 'structure' && buildingFrame) {
      sprite = buildStructureLayers(buildingsAtlas, buildingFrame);
      sprite.x = placement.x * STARTER_VILLAGE_TILE_SIZE;
      sprite.y = placement.y * STARTER_VILLAGE_TILE_SIZE;
    } else {
      sprite = tileSprite(atlas, object.assetId as StarterVillageTileId, placement.x, placement.y);
    }
    sprite.zIndex = z;
    if (options.buildMode) {
      sprite.eventMode = 'static';
      sprite.cursor = 'pointer';
      sprite.on('pointertap', () => options.onPlacementSelect?.(placement.id));
    }
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

  drawGuide(root, composition);
  const agentById = new Map(options.agents.map((agent) => [agent.id, agent]));
  const actorVisuals = new Map<string, { body: Graphics; marker: Graphics; stage: EvolutionStage; action: string; direction: string; frame: number; visualState: string }>();
  const actorScale = 1.5;
  root.updateWorkers = (motions) => {
    for (const motion of motions) {
      const agent = agentById.get(motion.id);
      const visual = actorVisuals.get(motion.id);
      if (!agent || !visual) continue;
      const stage = options.growthStageForAgent?.(motion.id) ?? 'baby';
      const plan = creatureFramePlan(options.identityFor(motion.id), { stage, action: motion.action, direction: motion.direction, frame: motion.frame as 0 | 1 });
      if (visual.stage !== stage || visual.action !== motion.action || visual.direction !== motion.direction || visual.frame !== motion.frame || visual.visualState !== motion.visualState) {
        visual.body.clear();
        for (const block of plan.blocks) visual.body.setFillStyle({ color: block.color }).rect(block.x, block.y, block.w, block.h).fill();
        visual.marker.clear();
        const marker = stateMarker(motion.visualState);
        visual.marker.setFillStyle({ color: marker.color });
        if (marker.shape === 'circle') visual.marker.circle(12, 1, 3).fill();
        else if (marker.shape === 'bar') visual.marker.rect(8, 0, 8, 3).fill();
        else if (marker.shape === 'triangle') visual.marker.poly([12, -3, 16, 4, 8, 4]).fill();
        else visual.marker.poly([12, -3, 16, 1, 12, 5, 8, 1]).fill();
        visual.stage = stage; visual.action = motion.action; visual.direction = motion.direction; visual.frame = motion.frame; visual.visualState = motion.visualState;
      }
      const footX = motion.x + STARTER_VILLAGE_TILE_SIZE / 2;
      const footY = motion.y + STARTER_VILLAGE_TILE_SIZE;
      visual.body.x = Math.round(footX - plan.width * actorScale / 2);
      visual.body.y = Math.round(footY - plan.height * actorScale);
      visual.marker.x = Math.round(footX - 8);
      visual.marker.y = visual.body.y - 4;
      visual.body.zIndex = footY;
      visual.marker.zIndex = footY + 1;
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
    const body = new Graphics();
    const marker = new Graphics();
    body.scale.set(actorScale);
    body.hitArea = new Rectangle(0, 0, 24 * actorScale, 24 * actorScale);
    body.eventMode = 'static'; body.cursor = 'pointer';
    body.on('pointertap', () => options.onAgentSelect(agent.id));
    marker.eventMode = 'static'; marker.cursor = 'pointer';
    marker.on('pointertap', () => task ? options.onTaskOpen(task.id) : options.onAgentSelect(agent.id));
    root.addChild(body, marker);
    actorVisuals.set(agent.id, { body, marker, stage: 'baby', action: '', direction: '', frame: -1, visualState: '' });
  });
  root.updateWorkers(options.workerMotions ?? []);
  root.updateLocationReactions(options.locationReactions ?? []);
  const title = new Text({ text: STARTER_VILLAGE_SCENARIO.ambient.title, style: { fill: 0xf1db9d, fontSize: 7, fontFamily: 'monospace' } }); title.x = 8; title.y = 236; title.zIndex = STARTER_VILLAGE_HEIGHT + 20; root.addChild(title); return root;
}
