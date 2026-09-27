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
  rotation?: 90;
}>> = {
  grass: { x: 42, y: 82, width: 128, height: 128, renderWidth: 16, renderHeight: 16 },
  'training-grass': { x: 216, y: 72, width: 128, height: 128, renderWidth: 16, renderHeight: 16 },
  dirt: { x: 388, y: 70, width: 128, height: 128, renderWidth: 16, renderHeight: 16 },
  road: { x: 560, y: 70, width: 128, height: 128, renderWidth: 16, renderHeight: 16 },
  water: { x: 744, y: 70, width: 128, height: 128, renderWidth: 16, renderHeight: 16 },
  tree: { x: 910, y: 50, width: 148, height: 170, renderWidth: 16, renderHeight: 16 },
  shrub: { x: 1080, y: 78, width: 150, height: 136, renderWidth: 16, renderHeight: 16 },
  flowers: { x: 1272, y: 60, width: 148, height: 148, renderWidth: 16, renderHeight: 16 },
  'guide-house': { x: 14, y: 234, width: 710, height: 539, renderWidth: 64, renderHeight: 48 },
  stable: { x: 729, y: 234, width: 706, height: 539, renderWidth: 64, renderHeight: 48 },
  'fence-horizontal': { x: 55, y: 842, width: 111, height: 62, renderWidth: 16, renderHeight: 16 },
  'fence-vertical': { x: 55, y: 842, width: 111, height: 62, renderWidth: 16, renderHeight: 16, rotation: 90 },
  'fence-post': { x: 28, y: 817, width: 43, height: 143, renderWidth: 16, renderHeight: 16 },
  rock: { x: 205, y: 828, width: 162, height: 132, renderWidth: 16, renderHeight: 16 },
  lantern: { x: 350, y: 790, width: 119, height: 170, renderWidth: 16, renderHeight: 16 },
  crate: { x: 470, y: 804, width: 150, height: 156, renderWidth: 16, renderHeight: 16 },
  sign: { x: 630, y: 800, width: 140, height: 160, renderWidth: 16, renderHeight: 16 }
};

/** Original multi-tile structures, packed as separate frames in the building atlas. */
export const STARTER_VILLAGE_BUILDING_FRAMES = {
  laboratory: { x: 8, y: 8, width: 96, height: 80, renderWidth: 96, renderHeight: 80 },
  'stable-building': { x: 120, y: 8, width: 96, height: 80, renderWidth: 96, renderHeight: 80 },
  'village-home': { x: 232, y: 8, width: 64, height: 64, renderWidth: 64, renderHeight: 64 }
} as const;
