import { Texture } from 'pixi.js';
import type { CompositionScenarioDefinition, WorldCompositionV1 } from '@shared/worldComposition';

/**
 * Procedural dressing for Starter Village: everything here is derived from the
 * composition (terrain brushes + placements) and a deterministic hash, so it
 * adds depth without new map data, collisions or raster assets.
 *
 * Static dressing is painted once per layout into a 1:1 canvas and cached as a
 * texture; the scene is rebuilt on every projection change, so it must be cheap.
 */

export const TILE = 16;

/** Aspect-correct on-screen size of 1×1 props; feet stay centered on the tile's bottom edge. */
export const PROP_VISUALS: Readonly<Record<string, { width: number; height: number; sink?: number; shadow?: number }>> = {
  tree: { width: 30, height: 34, sink: 2, shadow: 22 },
  shrub: { width: 20, height: 19, sink: 1, shadow: 16 },
  rock: { width: 18, height: 15, sink: 1, shadow: 15 },
  lantern: { width: 10, height: 18, shadow: 9 },
  crate: { width: 15, height: 16, shadow: 14 },
  sign: { width: 14, height: 17, shadow: 9 },
  'fence-post': { width: 6, height: 18, shadow: 6 },
  'fence-horizontal': { width: 16, height: 10, sink: -2 }
};

/** Chimney mouths in building-frame pixels, for the smoke emitters. */
export const CHIMNEYS: Readonly<Record<string, { x: number; y: number }>> = {
  laboratory: { x: 65, y: 15 },
  'stable-building': { x: 36, y: 9 },
  'village-home': { x: 44, y: 11 }
};

/** Stable 0..1 hash for a cell; `salt` separates independent decisions. */
export function cellHash(x: number, y: number, salt = 0): number {
  let h = (Math.imul(x | 0, 0x1f1f1f1f) ^ Math.imul(y | 0, 0x2545f491) ^ Math.imul(salt | 0, 0x9e3779b1)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0;
  h ^= h >>> 15;
  return (h >>> 0) / 0x100000000;
}

function smooth(t: number): number { return t * t * (3 - 2 * t); }

/** Bilinear value noise; `scale` is the feature size in cells. */
export function valueNoise(x: number, y: number, scale: number, salt = 0): number {
  const fx = x / scale; const fy = y / scale;
  const x0 = Math.floor(fx); const y0 = Math.floor(fy);
  const tx = smooth(fx - x0); const ty = smooth(fy - y0);
  const a = cellHash(x0, y0, salt); const b = cellHash(x0 + 1, y0, salt);
  const c = cellHash(x0, y0 + 1, salt); const d = cellHash(x0 + 1, y0 + 1, salt);
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}

export interface VillageGroundModel {
  columns: number;
  rows: number;
  terrain: ReadonlyMap<string, string>;
  occupied: ReadonlySet<string>;
}

export function villageGroundModel(
  composition: WorldCompositionV1,
  definition: CompositionScenarioDefinition,
  columns: number,
  rows: number
): VillageGroundModel {
  const terrain = new Map<string, string>();
  for (const cell of composition.terrain) terrain.set(`${cell.x},${cell.y}`, cell.terrainId);
  const occupied = new Set<string>();
  for (const placement of composition.placements) {
    const object = definition.objects[placement.definitionId];
    if (!object) continue;
    for (let dy = 0; dy < object.footprint.height; dy += 1) {
      for (let dx = 0; dx < object.footprint.width; dx += 1) occupied.add(`${placement.x + dx},${placement.y + dy}`);
    }
  }
  return { columns, rows, terrain, occupied };
}

const isPath = (id: string | undefined): boolean => id === 'dirt' || id === 'road';

/** Cells where the decorative forest ring may stand: the outermost free grass ring. */
export function borderForestCells(model: VillageGroundModel): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < model.rows; y += 1) {
    for (let x = 0; x < model.columns; x += 1) {
      if (x !== 0 && y !== 0 && x !== model.columns - 1 && y !== model.rows - 1) continue;
      const key = `${x},${y}`;
      if (model.terrain.has(key) || model.occupied.has(key)) continue;
      // Leave the mouth of any path that runs off the map open.
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isPath(model.terrain.get(`${x + dx},${y + dy}`)));
      if (near) continue;
      cells.push({ x, y });
    }
  }
  return cells;
}

const GRASS_TONES = ['#5c9a2c', '#69a332', '#538f2a'] as const;
const FLOWER_TONES = ['#fff6d8', '#ffd84a', '#ff9ec4', '#b9a2ff', '#ff7a5c', '#9fe0ff'] as const;

function px(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w = 1, h = 1): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function softShadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, alpha = 0.26): void {
  ctx.fillStyle = `rgba(18, 38, 26, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(18, 38, 26, ${alpha * 0.7})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.66, ry * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
}

function paintGrassVariation(ctx: CanvasRenderingContext2D, model: VillageGroundModel): void {
  const sub = 4;
  for (let sy = 0; sy < model.rows * (TILE / sub); sy += 1) {
    for (let sx = 0; sx < model.columns * (TILE / sub); sx += 1) {
      const cellX = Math.floor((sx * sub) / TILE); const cellY = Math.floor((sy * sub) / TILE);
      const id = model.terrain.get(`${cellX},${cellY}`);
      if (id && id !== 'training-grass') continue;
      const n = valueNoise(sx, sy, 22, 11) * 0.65 + valueNoise(sx, sy, 7, 12) * 0.35
        + (cellHash(sx, sy, 13) - 0.5) * 0.06;
      if (n > 0.6) px(ctx, `rgba(206, 232, 110, ${n > 0.68 ? 0.2 : 0.11})`, sx * sub, sy * sub, sub, sub);
      else if (n < 0.42) px(ctx, `rgba(16, 70, 44, ${n < 0.34 ? 0.24 : 0.13})`, sx * sub, sy * sub, sub, sub);
    }
  }
}

function paintPathEdges(ctx: CanvasRenderingContext2D, model: VillageGroundModel): void {
  const at = (x: number, y: number): string | undefined => model.terrain.get(`${x},${y}`);
  for (const [key, id] of model.terrain) {
    if (!isPath(id)) continue;
    const [x, y] = key.split(',').map(Number);
    const ox = x * TILE; const oy = y * TILE;
    const open = { n: !isPath(at(x, y - 1)), s: !isPath(at(x, y + 1)), w: !isPath(at(x - 1, y)), e: !isPath(at(x + 1, y)) };
    const rim = id === 'road' ? 'rgba(70, 74, 70, 0.5)' : 'rgba(104, 62, 24, 0.5)';
    const lip = id === 'road' ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 226, 160, 0.3)';
    // Worn track: a faint lighter centre line breaks up the flat tile.
    if (id === 'dirt') {
      for (let i = 0; i < 3; i += 1) {
        const hx = Math.floor(cellHash(x, y, 40 + i) * 12) + 2; const hy = Math.floor(cellHash(x, y, 50 + i) * 12) + 2;
        px(ctx, i === 0 ? 'rgba(255, 232, 170, 0.35)' : 'rgba(96, 58, 22, 0.35)', ox + hx, oy + hy, i === 0 ? 2 : 1, 1);
      }
    }
    if (open.n) { px(ctx, rim, ox, oy, TILE, 2); px(ctx, 'rgba(60, 34, 12, 0.28)', ox, oy + 2, TILE, 1); }
    if (open.s) { px(ctx, lip, ox, oy + TILE - 3, TILE, 1); px(ctx, rim, ox, oy + TILE - 2, TILE, 2); }
    if (open.w) px(ctx, rim, ox, oy, 2, TILE);
    if (open.e) px(ctx, rim, ox + TILE - 2, oy, 2, TILE);
    // Grass creeping over each open edge in irregular bites.
    const bite = (bx: number, by: number, w: number, h: number, salt: number): void => {
      px(ctx, GRASS_TONES[Math.floor(cellHash(bx, by, salt) * GRASS_TONES.length)], bx, by, w, h);
    };
    for (let i = 0; i < TILE; i += 2) {
      if (open.n) { const d = Math.floor(cellHash(ox + i, oy, 21) * 3); if (d) bite(ox + i, oy, 2, d, 31); }
      if (open.s) { const d = Math.floor(cellHash(ox + i, oy, 22) * 3); if (d) bite(ox + i, oy + TILE - d, 2, d, 32); }
      if (open.w) { const d = Math.floor(cellHash(ox, oy + i, 23) * 3); if (d) bite(ox, oy + i, d, 2, 33); }
      if (open.e) { const d = Math.floor(cellHash(ox, oy + i, 24) * 3); if (d) bite(ox + TILE - d, oy + i, d, 2, 34); }
    }
    // Round the convex corners.
    const corner = (cx: number, cy: number, sx: number, sy: number): void => {
      const steps = [[0, 0, 4, 1], [0, 1, 2, 1], [0, 2, 1, 2]] as const;
      for (const [dx, dy, w, h] of steps) {
        px(ctx, GRASS_TONES[0], sx > 0 ? cx + dx : cx - dx - w + 1, sy > 0 ? cy + dy : cy - dy - h + 1, w, h);
      }
    };
    if (open.n && open.w) corner(ox, oy, 1, 1);
    if (open.n && open.e) corner(ox + TILE - 1, oy, -1, 1);
    if (open.s && open.w) corner(ox, oy + TILE - 1, 1, -1);
    if (open.s && open.e) corner(ox + TILE - 1, oy + TILE - 1, -1, -1);
  }
}

function paintShoreline(ctx: CanvasRenderingContext2D, model: VillageGroundModel): void {
  const water = (x: number, y: number): boolean => model.terrain.get(`${x},${y}`) === 'water';
  for (const [key, id] of model.terrain) {
    if (id !== 'water') continue;
    const [x, y] = key.split(',').map(Number);
    const ox = x * TILE; const oy = y * TILE;
    const open = { n: !water(x, y - 1), s: !water(x, y + 1), w: !water(x - 1, y), e: !water(x + 1, y) };
    const bank = '#3f7a2a'; const earth = '#6b4a26'; const foam = 'rgba(214, 240, 255, 0.6)'; const deep = 'rgba(6, 40, 110, 0.35)';
    // Depth: water darkens away from the shore.
    const landNear = open.n || open.s || open.w || open.e
      || !water(x - 1, y - 1) || !water(x + 1, y - 1) || !water(x - 1, y + 1) || !water(x + 1, y + 1);
    if (!landNear) px(ctx, 'rgba(8, 36, 120, 0.22)', ox, oy, TILE, TILE);
    if (open.n) {
      // The far bank is seen from above: grass lip, exposed earth, then a cast shadow on the water.
      px(ctx, bank, ox, oy, TILE, 2); px(ctx, earth, ox, oy + 2, TILE, 2); px(ctx, deep, ox, oy + 4, TILE, 3);
      for (let i = 0; i < TILE; i += 2) if (cellHash(ox + i, oy, 61) > 0.5) px(ctx, bank, ox + i, oy + 2, 2, 1);
    }
    // Foam laps the near banks in broken dashes rather than a ruled line.
    const dash = (fx: number, fy: number, w: number, h: number, salt: number): void => {
      if (cellHash(fx, fy, salt) > 0.45) px(ctx, foam, fx, fy, w, h);
    };
    if (open.s) { px(ctx, bank, ox, oy + TILE - 2, TILE, 2); for (let i = 1; i < TILE - 2; i += 3) dash(ox + i, oy + TILE - 4, 2, 1, 63); }
    if (open.w) { px(ctx, bank, ox, oy, 2, TILE); for (let i = open.n ? 6 : 1; i < TILE - 4; i += 3) dash(ox + 3, oy + i, 1, 2, 64); }
    if (open.e) { px(ctx, bank, ox + TILE - 2, oy, 2, TILE); for (let i = open.n ? 6 : 1; i < TILE - 4; i += 3) dash(ox + TILE - 4, oy + i, 1, 2, 65); }
    const corner = (cx: number, cy: number, sx: number, sy: number): void => {
      const steps = [[0, 0, 5, 2], [0, 2, 3, 1], [0, 3, 2, 2]] as const;
      for (const [dx, dy, w, h] of steps) px(ctx, bank, sx > 0 ? cx + dx : cx - dx - w + 1, sy > 0 ? cy + dy : cy - dy - h + 1, w, h);
    };
    if (open.n && open.w) corner(ox, oy, 1, 1);
    if (open.n && open.e) corner(ox + TILE - 1, oy, -1, 1);
    if (open.s && open.w) corner(ox, oy + TILE - 1, 1, -1);
    if (open.s && open.e) corner(ox + TILE - 1, oy + TILE - 1, -1, -1);
    // Reeds on some shore cells.
    if ((open.w || open.e || open.s) && cellHash(x, y, 62) > 0.72) {
      const rx = ox + (open.w ? 1 : open.e ? TILE - 4 : 6); const ry = oy + (open.s ? TILE - 8 : 5);
      px(ctx, '#2f6a2a', rx, ry + 1, 1, 6); px(ctx, '#4f8f34', rx + 2, ry, 1, 7); px(ctx, '#7a5a2c', rx + 2, ry - 2, 1, 3);
    }
  }
}

function paintTallGrassFringe(ctx: CanvasRenderingContext2D, model: VillageGroundModel): void {
  const tall = (x: number, y: number): boolean => model.terrain.get(`${x},${y}`) === 'training-grass';
  for (const [key, id] of model.terrain) {
    if (id !== 'training-grass') continue;
    const [x, y] = key.split(',').map(Number);
    const ox = x * TILE; const oy = y * TILE;
    if (!tall(x, y - 1)) {
      for (let i = 0; i < TILE; i += 2) {
        const h = 1 + Math.floor(cellHash(ox + i, oy, 71) * 4);
        px(ctx, cellHash(ox + i, oy, 72) > 0.5 ? '#3d8a2c' : '#2f7426', ox + i, oy - h, 1, h);
        if (h > 2) px(ctx, '#74b83c', ox + i + 1, oy - h + 2, 1, h - 2);
      }
    }
    if (!tall(x, y + 1)) {
      px(ctx, 'rgba(14, 56, 30, 0.42)', ox, oy + TILE, TILE, 2);
      for (let i = 0; i < TILE; i += 3) if (cellHash(ox + i, oy, 73) > 0.4) px(ctx, '#2f7426', ox + i, oy + TILE, 1, 2);
    }
    if (!tall(x - 1, y)) for (let i = 1; i < TILE; i += 3) px(ctx, '#2f7426', ox - 1 - Math.floor(cellHash(ox, oy + i, 74) * 2), oy + i, 2, 2);
    if (!tall(x + 1, y)) for (let i = 1; i < TILE; i += 3) px(ctx, '#3d8a2c', ox + TILE - 1 + Math.floor(cellHash(ox, oy + i, 75) * 2), oy + i, 2, 2);
  }
}

function paintMeadowDetails(ctx: CanvasRenderingContext2D, model: VillageGroundModel): void {
  for (let y = 0; y < model.rows; y += 1) {
    for (let x = 0; x < model.columns; x += 1) {
      const key = `${x},${y}`;
      if (model.terrain.has(key) || model.occupied.has(key)) continue;
      const ox = x * TILE; const oy = y * TILE;
      const meadow = valueNoise(x, y, 5, 81) * 0.6 + valueNoise(x, y, 11, 82) * 0.4;
      const roll = cellHash(x, y, 83);
      const jx = 2 + Math.floor(cellHash(x, y, 84) * 9); const jy = 4 + Math.floor(cellHash(x, y, 85) * 8);
      if (meadow > 0.6 && roll < 0.55) {
        // Wildflower cluster: two or three blooms sharing one colour family.
        const tone = FLOWER_TONES[Math.floor(valueNoise(x, y, 4, 86) * FLOWER_TONES.length) % FLOWER_TONES.length];
        const blooms = 2 + Math.floor(cellHash(x, y, 87) * 2);
        for (let i = 0; i < blooms; i += 1) {
          const bx = ox + 2 + Math.floor(cellHash(x, y, 90 + i) * 11); const by = oy + 3 + Math.floor(cellHash(x, y, 95 + i) * 10);
          px(ctx, '#2f7426', bx, by + 1, 1, 2);
          px(ctx, tone, bx - 1, by, 3, 1); px(ctx, tone, bx, by - 1, 1, 3);
          px(ctx, tone === '#ffd84a' ? '#c8742a' : '#ffd84a', bx, by);
        }
      } else if (roll < 0.34) {
        // Grass tuft.
        px(ctx, '#2f7426', ox + jx, oy + jy, 1, 3); px(ctx, '#2f7426', ox + jx + 2, oy + jy + 1, 1, 2);
        px(ctx, '#8cc84a', ox + jx + 1, oy + jy - 1, 1, 3); px(ctx, '#8cc84a', ox + jx + 3, oy + jy, 1, 2);
      } else if (roll > 0.975) {
        // Mushroom.
        px(ctx, 'rgba(18, 38, 26, 0.3)', ox + jx - 1, oy + jy + 3, 5, 1);
        px(ctx, '#f3ead6', ox + jx + 1, oy + jy + 1, 1, 2);
        px(ctx, '#c8442e', ox + jx, oy + jy, 3, 1); px(ctx, '#c8442e', ox + jx + 1, oy + jy - 1);
        px(ctx, '#fff6d8', ox + jx, oy + jy);
      } else if (roll > 0.95) {
        // Pebbles.
        px(ctx, 'rgba(18, 38, 26, 0.3)', ox + jx, oy + jy + 2, 4, 1);
        px(ctx, '#8d9096', ox + jx, oy + jy, 3, 2); px(ctx, '#c9ccd0', ox + jx, oy + jy, 2, 1);
        px(ctx, '#8d9096', ox + jx + 5, oy + jy + 1, 2, 1);
      } else if (roll > 0.9 && meadow < 0.4) {
        // Clover patch.
        px(ctx, '#3d8a2c', ox + jx, oy + jy, 2, 2); px(ctx, '#3d8a2c', ox + jx + 3, oy + jy + 1, 2, 2); px(ctx, '#3d8a2c', ox + jx + 1, oy + jy + 3, 2, 2);
        px(ctx, '#9ad65a', ox + jx, oy + jy); px(ctx, '#9ad65a', ox + jx + 3, oy + jy + 1);
      }
    }
  }
}

function paintShadows(ctx: CanvasRenderingContext2D, composition: WorldCompositionV1, definition: CompositionScenarioDefinition, forest: readonly { x: number; y: number }[]): void {
  for (const cell of forest) softShadow(ctx, cell.x * TILE + 10, cell.y * TILE + TILE, 12, 5, 0.3);
  for (const placement of composition.placements) {
    const object = definition.objects[placement.definitionId];
    if (!object) continue;
    const ox = placement.x * TILE; const oy = placement.y * TILE;
    const w = object.footprint.width * TILE; const h = object.footprint.height * TILE;
    if (object.kind === 'structure') {
      // The rasters are three-quarter views; the light comes from the upper left.
      softShadow(ctx, ox + w / 2 + 3, oy + h - 13, w * 0.46, 8, 0.3);
      continue;
    }
    if (placement.definitionId === 'fence-horizontal') { px(ctx, 'rgba(18, 38, 26, 0.28)', ox, oy + TILE - 1, TILE, 2); continue; }
    if (placement.definitionId === 'fence-vertical') { px(ctx, 'rgba(18, 38, 26, 0.24)', ox + 9, oy, 3, TILE); continue; }
    const visual = PROP_VISUALS[placement.definitionId];
    if (!visual?.shadow) continue;
    softShadow(ctx, ox + TILE / 2 + 2, oy + TILE - 1, visual.shadow / 2, Math.max(2, visual.shadow / 5));
  }
}

function paintGround(model: VillageGroundModel, composition: WorldCompositionV1, definition: CompositionScenarioDefinition): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = model.columns * TILE;
  canvas.height = model.rows * TILE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  paintGrassVariation(ctx, model);
  paintPathEdges(ctx, model);
  paintShoreline(ctx, model);
  paintMeadowDetails(ctx, model);
  paintTallGrassFringe(ctx, model);
  paintShadows(ctx, composition, definition, borderForestCells(model));
  return canvas;
}

function canvasTexture(canvas: HTMLCanvasElement, scaleMode: 'nearest' | 'linear' = 'nearest'): Texture {
  const texture = Texture.from(canvas);
  texture.source.scaleMode = scaleMode;
  return texture;
}

/** Small LRU: the scene is rebuilt often with the same layout, and layouts are immutable values. */
const GROUND_CACHE: { key: WorldCompositionV1; columns: number; rows: number; texture: Texture }[] = [];

export function groundDressingTexture(composition: WorldCompositionV1, definition: CompositionScenarioDefinition, columns: number, rows: number): Texture {
  const hit = GROUND_CACHE.find((entry) => entry.key === composition && entry.columns === columns && entry.rows === rows);
  if (hit) return hit.texture;
  const model = villageGroundModel(composition, definition, columns, rows);
  const texture = canvasTexture(paintGround(model, composition, definition));
  GROUND_CACHE.unshift({ key: composition, columns, rows, texture });
  // Evict late: the previous scene may still be on stage for one more frame.
  while (GROUND_CACHE.length > 4) GROUND_CACHE.pop()?.texture.destroy(true);
  return texture;
}

const SHARED = new Map<string, Texture>();
function shared(key: string, make: () => HTMLCanvasElement, scaleMode: 'nearest' | 'linear' = 'linear'): Texture {
  let texture = SHARED.get(key);
  if (!texture || texture.destroyed) { texture = canvasTexture(make(), scaleMode); SHARED.set(key, texture); }
  return texture;
}

function radial(size: number, stops: readonly [number, string][], squash = 1): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = Math.round(size * squash);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(1, squash);
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

/** Warm additive halo for lanterns and lit windows. */
export function glowTexture(): Texture {
  return shared('glow', () => radial(64, [[0, 'rgba(255, 214, 120, 0.85)'], [0.35, 'rgba(255, 170, 70, 0.32)'], [1, 'rgba(255, 150, 40, 0)']]));
}

/** Soft blob used for drifting cloud shadows. */
export function cloudShadowTexture(): Texture {
  return shared('cloud', () => radial(128, [[0, 'rgba(10, 30, 40, 0.5)'], [0.6, 'rgba(10, 30, 40, 0.28)'], [1, 'rgba(10, 30, 40, 0)']], 0.55));
}

/** Edge darkening plus a warm upper-left key light, stretched over the whole map. */
export function vignetteTexture(): Texture {
  return shared('vignette', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 192;
    const ctx = canvas.getContext('2d')!;
    const light = ctx.createRadialGradient(70, 40, 0, 70, 40, 230);
    light.addColorStop(0, 'rgba(255, 236, 170, 0.16)');
    light.addColorStop(0.5, 'rgba(255, 236, 170, 0.03)');
    light.addColorStop(1, 'rgba(20, 30, 70, 0.14)');
    ctx.fillStyle = light; ctx.fillRect(0, 0, 256, 192);
    const edge = ctx.createRadialGradient(128, 96, 70, 128, 96, 165);
    edge.addColorStop(0, 'rgba(8, 24, 20, 0)');
    edge.addColorStop(1, 'rgba(8, 24, 20, 0.4)');
    ctx.fillStyle = edge; ctx.fillRect(0, 0, 256, 192);
    return canvas;
  });
}
