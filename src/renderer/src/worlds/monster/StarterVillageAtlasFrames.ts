import type { StarterVillageTileId } from './StarterVillageScenario';

/**
 * Source rectangles in the generated 1448×1086 atlas and their logical
 * 16px-tile render sizes. Keeping source pixels separate from scene placements
 * lets the atlas be replaced without moving semantic anchors or changing map data.
 */
export const STARTER_VILLAGE_ATLAS_FRAMES: Readonly<Record<StarterVillageTileId, {
  x: number;
  y: number;
  width: number;
  height: number;
  renderWidth: number;
  renderHeight: number;
}>> = {
  grass: { x: 14, y: 46, width: 180, height: 184, renderWidth: 16, renderHeight: 16 },
  'training-grass': { x: 200, y: 44, width: 162, height: 185, renderWidth: 16, renderHeight: 16 },
  dirt: { x: 363, y: 44, width: 176, height: 185, renderWidth: 16, renderHeight: 16 },
  road: { x: 536, y: 44, width: 178, height: 185, renderWidth: 16, renderHeight: 16 },
  water: { x: 715, y: 42, width: 180, height: 188, renderWidth: 16, renderHeight: 16 },
  tree: { x: 891, y: 33, width: 180, height: 198, renderWidth: 16, renderHeight: 16 },
  shrub: { x: 1064, y: 64, width: 183, height: 166, renderWidth: 16, renderHeight: 16 },
  flowers: { x: 1250, y: 46, width: 184, height: 185, renderWidth: 16, renderHeight: 16 },
  'guide-house': { x: 14, y: 234, width: 710, height: 539, renderWidth: 64, renderHeight: 48 },
  stable: { x: 729, y: 234, width: 706, height: 539, renderWidth: 64, renderHeight: 48 },
  fence: { x: 16, y: 810, width: 185, height: 150, renderWidth: 16, renderHeight: 16 },
  rock: { x: 205, y: 828, width: 162, height: 132, renderWidth: 16, renderHeight: 16 },
  lantern: { x: 350, y: 790, width: 119, height: 170, renderWidth: 16, renderHeight: 16 },
  crate: { x: 470, y: 804, width: 150, height: 156, renderWidth: 16, renderHeight: 16 },
  sign: { x: 630, y: 800, width: 140, height: 160, renderWidth: 16, renderHeight: 16 }
};
