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
  tree: { x: 904, y: 42, width: 164, height: 188, renderWidth: 16, renderHeight: 16 },
  shrub: { x: 1078, y: 66, width: 168, height: 162, renderWidth: 16, renderHeight: 16 },
  flowers: { x: 1272, y: 60, width: 148, height: 148, renderWidth: 16, renderHeight: 16 },
  'guide-house': { x: 14, y: 234, width: 710, height: 539, renderWidth: 64, renderHeight: 48 },
  stable: { x: 729, y: 234, width: 706, height: 539, renderWidth: 64, renderHeight: 48 },
  'fence-horizontal': { x: 55, y: 842, width: 111, height: 62, renderWidth: 16, renderHeight: 16 },
  'fence-vertical': { x: 55, y: 842, width: 111, height: 62, renderWidth: 16, renderHeight: 16, rotation: 90 },
  'fence-post': { x: 28, y: 817, width: 43, height: 143, renderWidth: 16, renderHeight: 16 },
  rock: { x: 191, y: 832, width: 147, height: 124, renderWidth: 16, renderHeight: 16 },
  lantern: { x: 354, y: 788, width: 90, height: 168, renderWidth: 16, renderHeight: 16 },
  crate: { x: 475, y: 828, width: 123, height: 128, renderWidth: 16, renderHeight: 16 },
  sign: { x: 630, y: 804, width: 124, height: 152, renderWidth: 16, renderHeight: 16 }
};

/** Original multi-tile structures, packed as separate frames in the building atlas. */
export const STARTER_VILLAGE_BUILDING_FRAMES = {
  laboratory: { x: 8, y: 8, width: 96, height: 80, renderWidth: 96, renderHeight: 80 },
  'stable-building': { x: 120, y: 8, width: 96, height: 80, renderWidth: 96, renderHeight: 80 },
  'village-home': { x: 232, y: 8, width: 64, height: 64, renderWidth: 64, renderHeight: 64 }
} as const;
