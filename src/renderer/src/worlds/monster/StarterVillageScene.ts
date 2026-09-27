import { Assets, Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import type { IdentityForAgent } from '../identityResolver';
import type { WorldAgent, WorldTask } from '../worldProjection';
import { MONSTER_CATALOG_ATLAS_URL, monsterSpeciesFor, stateMarker, visualStateFor } from './monsterArt';
import { STARTER_VILLAGE_ATLAS_URL, STARTER_VILLAGE_SCENARIO, STARTER_VILLAGE_TILE_SIZE, type ScenarioAnchorId, type StarterVillageTileId } from './StarterVillageScenario';

export const STARTER_VILLAGE_WIDTH = STARTER_VILLAGE_SCENARIO.map.columns * STARTER_VILLAGE_TILE_SIZE;
export const STARTER_VILLAGE_HEIGHT = STARTER_VILLAGE_SCENARIO.map.rows * STARTER_VILLAGE_TILE_SIZE;
const FRAMES: Record<StarterVillageTileId, Rectangle> = {
  grass: new Rectangle(0, 0, 16, 16), 'training-grass': new Rectangle(16, 0, 16, 16), dirt: new Rectangle(32, 0, 16, 16), road: new Rectangle(48, 0, 16, 16), water: new Rectangle(64, 0, 16, 16), tree: new Rectangle(80, 0, 16, 16), shrub: new Rectangle(96, 0, 16, 16), flowers: new Rectangle(112, 0, 16, 16), 'guide-house': new Rectangle(0, 16, 64, 48), stable: new Rectangle(64, 16, 64, 48), fence: new Rectangle(0, 64, 16, 16), rock: new Rectangle(16, 64, 16, 16), lantern: new Rectangle(32, 64, 16, 16), crate: new Rectangle(48, 64, 16, 16), sign: new Rectangle(64, 64, 16, 16)
};
export interface StarterVillageSceneOptions { agents: readonly WorldAgent[]; tasks: readonly WorldTask[]; identityFor: IdentityForAgent; onAgentSelect: (agentId: string) => void; onTaskOpen: (taskId: string) => void; }
function anchor(id: ScenarioAnchorId) { return STARTER_VILLAGE_SCENARIO.anchorPlacements[id]; }
function monsterFrame(profile: Parameters<typeof monsterSpeciesFor>[0]): Rectangle {
  const frame = monsterSpeciesFor(profile).frame;
  return new Rectangle(frame.x, frame.y, frame.w, frame.h);
}
function markerFor(state: ReturnType<typeof visualStateFor>, x: number, y: number): Graphics { const marker = stateMarker(state); const graphics = new Graphics().setFillStyle({ color: marker.color }); if (marker.shape === 'circle') graphics.circle(x + 4, y + 4, 4).fill(); else if (marker.shape === 'bar') graphics.rect(x, y + 2, 8, 4).fill(); else if (marker.shape === 'triangle') graphics.poly([x + 4, y, x + 8, y + 8, x, y + 8]).fill(); else graphics.poly([x + 4, y, x + 8, y + 4, x + 4, y + 8, x, y + 4]).fill(); return graphics; }
function drawGuide(root: Container): void { const placement = anchor('professor'); const guide = new Graphics(); const x = placement.x * 16 + 4; const y = placement.y * 16; guide.setFillStyle({ color: 0x2c3045 }).rect(x, y + 5, 8, 10).fill(); guide.setFillStyle({ color: 0xf0c8a0 }).rect(x + 2, y + 1, 4, 5).fill(); guide.setFillStyle({ color: 0xb76b45 }).rect(x + 1, y, 6, 2).fill(); guide.zIndex = placement.zIndex; root.addChild(guide); }
/** Builds the static scene only; the caller owns the Pixi application lifecycle. */
export function buildStarterVillageScene(options: StarterVillageSceneOptions): Container {
  const atlas = Assets.get<Texture>(STARTER_VILLAGE_ATLAS_URL); if (!atlas) throw new Error('Starter Village atlas was not bootstrapped'); atlas.source.scaleMode = 'nearest';
  const monsterAtlas = Assets.get<Texture>(MONSTER_CATALOG_ATLAS_URL); if (!monsterAtlas) throw new Error('Monster catalog atlas was not bootstrapped'); monsterAtlas.source.scaleMode = 'nearest';
  const root = new Container({ sortableChildren: true }); root.sortableChildren = true;
  for (const layerData of STARTER_VILLAGE_SCENARIO.map.layers) { const layer = new Container({ zIndex: layerData.zIndex }); for (const placement of layerData.tiles) { const sprite = new Sprite(new Texture({ source: atlas.source, frame: FRAMES[placement.tile] })); sprite.x = placement.x * 16; sprite.y = placement.y * 16; layer.addChild(sprite); } root.addChild(layer); }
  drawGuide(root); const workerAnchors: readonly ScenarioAnchorId[] = ['stable', 'village-idle'];
  options.agents.forEach((agent, index) => { const placement = anchor(workerAnchors[index % workerAnchors.length]); const task = options.tasks.find((candidate) => candidate.assignee === agent.id); const creature = new Sprite(new Texture({ source: monsterAtlas.source, frame: monsterFrame(options.identityFor(agent.id)) })); creature.x = placement.x * 16; creature.y = placement.y * 16; creature.zIndex = placement.zIndex; creature.eventMode = 'static'; creature.cursor = 'pointer'; creature.on('pointertap', () => options.onAgentSelect(agent.id)); root.addChild(creature); const marker = markerFor(visualStateFor(agent, options.tasks), creature.x + 4, creature.y - 5); marker.zIndex = placement.zIndex + 1; marker.eventMode = 'static'; marker.cursor = 'pointer'; marker.on('pointertap', () => task ? options.onTaskOpen(task.id) : options.onAgentSelect(agent.id)); root.addChild(marker); });
  const title = new Text({ text: STARTER_VILLAGE_SCENARIO.ambient.title, style: { fill: 0xf1db9d, fontSize: 7, fontFamily: 'monospace' } }); title.x = 8; title.y = 236; title.zIndex = 90; root.addChild(title); return root;
}
