import { Assets, Container, Graphics, Rectangle, Sprite, Text, Texture, TilingSprite } from 'pixi.js';
import type { IdentityForAgent } from '../identityResolver';
import type { WorldAgent, WorldTask } from '../worldProjection';
import { creaturePlan, stateMarker, visualStateFor } from './monsterArt';
import { STARTER_VILLAGE_ATLAS_URL, STARTER_VILLAGE_SCENARIO, STARTER_VILLAGE_TILE_SIZE, type ScenarioAnchorId, type StarterVillageTileId } from './StarterVillageScenario';
import { STARTER_VILLAGE_ATLAS_FRAMES } from './StarterVillageAtlasFrames';

export const STARTER_VILLAGE_WIDTH = STARTER_VILLAGE_SCENARIO.map.columns * STARTER_VILLAGE_TILE_SIZE;
export const STARTER_VILLAGE_HEIGHT = STARTER_VILLAGE_SCENARIO.map.rows * STARTER_VILLAGE_TILE_SIZE;
const FRAMES: Record<StarterVillageTileId, Rectangle> = Object.fromEntries(
  Object.entries(STARTER_VILLAGE_ATLAS_FRAMES).map(([id, frame]) => [
    id,
    new Rectangle(frame.x, frame.y, frame.width, frame.height)
  ])
) as Record<StarterVillageTileId, Rectangle>;
export interface StarterVillageSceneOptions { agents: readonly WorldAgent[]; tasks: readonly WorldTask[]; identityFor: IdentityForAgent; onAgentSelect: (agentId: string) => void; onTaskOpen: (taskId: string) => void; }
function anchor(id: ScenarioAnchorId) { return STARTER_VILLAGE_SCENARIO.anchorPlacements[id]; }
function markerFor(state: ReturnType<typeof visualStateFor>, x: number, y: number): Graphics { const marker = stateMarker(state); const graphics = new Graphics().setFillStyle({ color: marker.color }); if (marker.shape === 'circle') graphics.circle(x + 4, y + 4, 4).fill(); else if (marker.shape === 'bar') graphics.rect(x, y + 2, 8, 4).fill(); else if (marker.shape === 'triangle') graphics.poly([x + 4, y, x + 8, y + 8, x, y + 8]).fill(); else graphics.poly([x + 4, y, x + 8, y + 4, x + 4, y + 8, x, y + 4]).fill(); return graphics; }
function drawGuide(root: Container): void { const placement = anchor('professor'); const guide = new Graphics(); const x = placement.x * 16 + 4; const y = placement.y * 16; guide.setFillStyle({ color: 0x2c3045 }).rect(x, y + 5, 8, 10).fill(); guide.setFillStyle({ color: 0xf0c8a0 }).rect(x + 2, y + 1, 4, 5).fill(); guide.setFillStyle({ color: 0xb76b45 }).rect(x + 1, y, 6, 2).fill(); guide.zIndex = placement.zIndex; root.addChild(guide); }
/** Builds the static scene only; the caller owns the Pixi application lifecycle. */
export function buildStarterVillageScene(options: StarterVillageSceneOptions): Container {
  const atlas = Assets.get<Texture>(STARTER_VILLAGE_ATLAS_URL); if (!atlas) throw new Error('Starter Village atlas was not bootstrapped'); atlas.source.scaleMode = 'nearest';
  const root = new Container({ sortableChildren: true }); root.sortableChildren = true;
  for (const layerData of STARTER_VILLAGE_SCENARIO.map.layers) {
    const layer = new Container({ zIndex: layerData.zIndex });
    if (layerData.fill) {
      const frame = STARTER_VILLAGE_ATLAS_FRAMES[layerData.fill];
      const texture = new Texture({ source: atlas.source, frame: FRAMES[layerData.fill] });
      const ground = new TilingSprite({ texture, width: STARTER_VILLAGE_WIDTH, height: STARTER_VILLAGE_HEIGHT });
      ground.tileScale.set(frame.renderWidth / frame.width, frame.renderHeight / frame.height);
      layer.addChild(ground);
    }
    for (const placement of layerData.tiles) {
      const frame = STARTER_VILLAGE_ATLAS_FRAMES[placement.tile];
      const sprite = new Sprite(new Texture({ source: atlas.source, frame: FRAMES[placement.tile] }));
      sprite.width = frame.renderWidth;
      sprite.height = frame.renderHeight;
      if (frame.rotation) {
        sprite.anchor.set(0.5);
        sprite.angle = frame.rotation;
        sprite.x = placement.x * 16 + 8;
        sprite.y = placement.y * 16 + 8;
      } else {
        sprite.x = placement.x * 16;
        sprite.y = placement.y * 16;
      }
      layer.addChild(sprite);
    }
    root.addChild(layer);
  }
  drawGuide(root); const workerAnchors: readonly ScenarioAnchorId[] = ['stable', 'village-idle'];
  options.agents.forEach((agent, index) => { const placement = anchor(workerAnchors[index % workerAnchors.length]); const task = options.tasks.find((candidate) => candidate.assignee === agent.id); const creature = new Graphics(); for (const block of creaturePlan(options.identityFor(agent.id)).blocks) creature.setFillStyle({ color: block.color }).rect(block.x, block.y, block.w, block.h).fill(); creature.x = placement.x * 16; creature.y = placement.y * 16; creature.zIndex = placement.zIndex; creature.eventMode = 'static'; creature.cursor = 'pointer'; creature.on('pointertap', () => options.onAgentSelect(agent.id)); root.addChild(creature); const marker = markerFor(visualStateFor(agent, options.tasks), creature.x + 4, creature.y - 5); marker.zIndex = placement.zIndex + 1; marker.eventMode = 'static'; marker.cursor = 'pointer'; marker.on('pointertap', () => task ? options.onTaskOpen(task.id) : options.onAgentSelect(agent.id)); root.addChild(marker); });
  const title = new Text({ text: STARTER_VILLAGE_SCENARIO.ambient.title, style: { fill: 0xf1db9d, fontSize: 7, fontFamily: 'monospace' } }); title.x = 8; title.y = 236; title.zIndex = 90; root.addChild(title); return root;
}
