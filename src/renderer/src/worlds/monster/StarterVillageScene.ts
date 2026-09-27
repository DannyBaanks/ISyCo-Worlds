import { Assets, Container, Graphics, Rectangle, Sprite, Text, Texture, TilingSprite } from 'pixi.js';
import type { IdentityForAgent } from '../identityResolver';
import type { WorldAgent, WorldTask } from '../worldProjection';
import { creaturePlan, stateMarker, visualStateFor } from './monsterArt';
import {
  resolveStarterVillageAnchor, STARTER_VILLAGE_ATLAS_URL, STARTER_VILLAGE_BUILDINGS_ATLAS_URL,
  STARTER_VILLAGE_COMPOSITION_DEFINITION, STARTER_VILLAGE_PRESET, STARTER_VILLAGE_SCENARIO,
  STARTER_VILLAGE_TILE_SIZE, type ScenarioAnchorId, type StarterVillageTileId
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
}
function anchor(id: ScenarioAnchorId, composition: WorldCompositionV1) { return STARTER_VILLAGE_SCENARIO.anchorPlacements[id]; }
function markerFor(state: ReturnType<typeof visualStateFor>, x: number, y: number): Graphics { const marker = stateMarker(state); const graphics = new Graphics().setFillStyle({ color: marker.color }); if (marker.shape === 'circle') graphics.circle(x + 4, y + 4, 4).fill(); else if (marker.shape === 'bar') graphics.rect(x, y + 2, 8, 4).fill(); else if (marker.shape === 'triangle') graphics.poly([x + 4, y, x + 8, y + 8, x, y + 8]).fill(); else graphics.poly([x + 4, y, x + 8, y + 4, x + 4, y + 8, x, y + 4]).fill(); return graphics; }
function drawGuide(root: Container, composition: WorldCompositionV1): void {
  const position = resolveStarterVillageAnchor(composition, 'professor');
  const guide = new Graphics(); const x = position.x * STARTER_VILLAGE_TILE_SIZE + 4; const y = position.y * STARTER_VILLAGE_TILE_SIZE;
  guide.setFillStyle({ color: 0x2c3045 }).rect(x, y + 5, 8, 10).fill();
  guide.setFillStyle({ color: 0xf0c8a0 }).rect(x + 2, y + 1, 4, 5).fill();
  guide.setFillStyle({ color: 0xb76b45 }).rect(x + 1, y, 6, 2).fill();
  guide.zIndex = y + 16; root.addChild(guide);
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
export function buildStarterVillageScene(options: StarterVillageSceneOptions): Container {
  const atlas = Assets.get<Texture>(STARTER_VILLAGE_ATLAS_URL); if (!atlas) throw new Error('Starter Village atlas was not bootstrapped'); atlas.source.scaleMode = 'nearest';
  const buildingsAtlas = Assets.get<Texture>(STARTER_VILLAGE_BUILDINGS_ATLAS_URL); if (!buildingsAtlas) throw new Error('Starter Village buildings atlas was not bootstrapped'); buildingsAtlas.source.scaleMode = 'nearest';
  const composition = options.composition ?? STARTER_VILLAGE_PRESET;
  const root = new Container({ sortableChildren: true }); root.sortableChildren = true;
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
  const workerAnchors: readonly ScenarioAnchorId[] = ['stable', 'village-idle'];
  options.agents.forEach((agent, index) => {
    const anchorId = workerAnchors[index % workerAnchors.length];
    const point = anchorId === 'stable' ? resolveStarterVillageAnchor(composition, anchorId) : anchor(anchorId, composition);
    const task = options.tasks.find((candidate) => candidate.assignee === agent.id);
    const creature = new Graphics();
    for (const block of creaturePlan(options.identityFor(agent.id)).blocks) creature.setFillStyle({ color: block.color }).rect(block.x, block.y, block.w, block.h).fill();
    creature.x = point.x * STARTER_VILLAGE_TILE_SIZE; creature.y = point.y * STARTER_VILLAGE_TILE_SIZE;
    creature.zIndex = creature.y + STARTER_VILLAGE_TILE_SIZE; creature.eventMode = 'static'; creature.cursor = 'pointer';
    creature.on('pointertap', () => options.onAgentSelect(agent.id)); root.addChild(creature);
    const marker = markerFor(visualStateFor(agent, options.tasks), creature.x + 4, creature.y - 5);
    marker.zIndex = creature.zIndex + 1; marker.eventMode = 'static'; marker.cursor = 'pointer';
    marker.on('pointertap', () => task ? options.onTaskOpen(task.id) : options.onAgentSelect(agent.id)); root.addChild(marker);
  });
  const title = new Text({ text: STARTER_VILLAGE_SCENARIO.ambient.title, style: { fill: 0xf1db9d, fontSize: 7, fontFamily: 'monospace' } }); title.x = 8; title.y = 236; title.zIndex = STARTER_VILLAGE_HEIGHT + 20; root.addChild(title); return root;
}
