import type { VisualIdentityProfileV1 } from '@shared/worldProfiles';
import type { WorldAgent, WorldTask } from '../worldProjection';
import monsterCatalogAtlasUrl from '../../assets/worlds/starter-village/monster-catalog-atlas.svg?url';

/**
 * Original Monster Trainer creature identity. The catalog is project-owned
 * source-pixel art; a profile seed selects a stable species without using
 * franchise assets or mutating operational agent state.
 */

export const MONSTER_VARIANTS = ['blob', 'horn', 'shell', 'spike'] as const;
export type MonsterVariant = typeof MONSTER_VARIANTS[number];

/** Bounded original palettes: [outline, body, accent]. */
export const MONSTER_PALETTES: ReadonlyArray<readonly [number, number, number]> = [
  [0x2b2440, 0x7adfc3, 0xf5f0e6],
  [0x33261d, 0xe0a458, 0xfdf3d8],
  [0x1f2d3d, 0x9db4d0, 0xf1f6fb],
  [0x3d1f2b, 0xe07a9a, 0xfbe7ee],
  [0x26331d, 0xa8c66c, 0xf2f7e0]
] as const;

export const MONSTER_SPECIES_IDS = [
  'mossprig', 'pebblit', 'emberoo', 'glimmerfin', 'thornkit',
  'cloudlet', 'mireling', 'cindercub', 'lumenmoth', 'brambleox'
] as const;
export type MonsterSpeciesId = typeof MONSTER_SPECIES_IDS[number];

export interface MonsterSpriteFrame { x: number; y: number; w: 16; h: 16; }
export interface MonsterSpecies {
  id: MonsterSpeciesId;
  name: string;
  variant: MonsterVariant;
  frame: MonsterSpriteFrame;
  palette: readonly [number, number, number];
}

/** Ten original 16×16 sprites in reading order inside the catalog atlas. */
export const MONSTER_CATALOG: readonly MonsterSpecies[] = [
  { id: 'mossprig', name: 'Mossprig', variant: 'blob', frame: { x: 0, y: 0, w: 16, h: 16 }, palette: [0x26331d, 0x77bb61, 0xe9e09a] },
  { id: 'pebblit', name: 'Pebblit', variant: 'shell', frame: { x: 16, y: 0, w: 16, h: 16 }, palette: [0x26323c, 0x8495a1, 0xd6e2de] },
  { id: 'emberoo', name: 'Emberoo', variant: 'horn', frame: { x: 32, y: 0, w: 16, h: 16 }, palette: [0x472126, 0xe36b42, 0xf5d06e] },
  { id: 'glimmerfin', name: 'Glimmerfin', variant: 'shell', frame: { x: 48, y: 0, w: 16, h: 16 }, palette: [0x17374a, 0x54aeca, 0xd8f0e6] },
  { id: 'thornkit', name: 'Thornkit', variant: 'spike', frame: { x: 64, y: 0, w: 16, h: 16 }, palette: [0x382342, 0xa775ba, 0xd6c169] },
  { id: 'cloudlet', name: 'Cloudlet', variant: 'blob', frame: { x: 0, y: 16, w: 16, h: 16 }, palette: [0x354457, 0xc9d9e3, 0xf9f0bf] },
  { id: 'mireling', name: 'Mireling', variant: 'shell', frame: { x: 16, y: 16, w: 16, h: 16 }, palette: [0x173a3d, 0x4e9b86, 0xc6df9c] },
  { id: 'cindercub', name: 'Cindercub', variant: 'horn', frame: { x: 32, y: 16, w: 16, h: 16 }, palette: [0x4a2525, 0xc95b44, 0xf2b56d] },
  { id: 'lumenmoth', name: 'Lumenmoth', variant: 'spike', frame: { x: 48, y: 16, w: 16, h: 16 }, palette: [0x353044, 0xa4a3d6, 0xf3df72] },
  { id: 'brambleox', name: 'Brambleox', variant: 'horn', frame: { x: 64, y: 16, w: 16, h: 16 }, palette: [0x3b2b20, 0x986443, 0x9fb85f] }
];

export const MONSTER_CATALOG_ATLAS_URL = monsterCatalogAtlasUrl;

export interface MonsterAppearance {
  species?: MonsterSpeciesId;
  variant?: MonsterVariant;
  palette?: readonly [number, number, number];
}

export interface PixelBlock {
  x: number;
  y: number;
  w: number;
  h: number;
  color: number;
}

export interface CreaturePlan {
  species: MonsterSpecies;
  variant: MonsterVariant;
  palette: readonly [number, number, number];
  blocks: readonly PixelBlock[];
}

export type MonsterVisualState = 'idle' | 'working' | 'blocked' | 'awaitsHuman';

export interface StateMarker {
  shape: 'circle' | 'bar' | 'triangle' | 'diamond';
  color: number;
}

function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function isHexColor(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffff;
}

/** Only a well-formed `monster-trainer` payload may override the seed default. */
export function monsterAppearance(profile: VisualIdentityProfileV1): MonsterAppearance {
  const raw = profile.appearances?.['monster-trainer'];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const record = raw as Record<string, unknown>;
  const appearance: MonsterAppearance = {};
  if (typeof record.species === 'string'
    && (MONSTER_SPECIES_IDS as readonly string[]).includes(record.species)) {
    appearance.species = record.species as MonsterSpeciesId;
  }
  if (typeof record.variant === 'string'
    && (MONSTER_VARIANTS as readonly string[]).includes(record.variant)) {
    appearance.variant = record.variant as MonsterVariant;
  }
  if (Array.isArray(record.palette) && record.palette.length === 3 && record.palette.every(isHexColor)) {
    appearance.palette = record.palette as unknown as readonly [number, number, number];
  }
  return appearance;
}

/** A visual seed maps to one catalog entry; an explicit valid species wins. */
export function monsterSpeciesFor(profile: VisualIdentityProfileV1): MonsterSpecies {
  const overrides = monsterAppearance(profile);
  if (overrides.species) return MONSTER_CATALOG.find((species) => species.id === overrides.species)!;
  if (overrides.variant) return MONSTER_CATALOG.find((species) => species.variant === overrides.variant)!;
  return MONSTER_CATALOG[hashSeed(profile.seed) % MONSTER_CATALOG.length]!;
}

/**
 * Deterministic creature layout on a 16x16 pixel grid: a body with two eyes,
 * plus a variant silhouette. All coordinates are whole pixels by construction.
 */
export function creaturePlan(profile: VisualIdentityProfileV1): CreaturePlan {
  const overrides = monsterAppearance(profile);
  const species = monsterSpeciesFor(profile);
  const variant = overrides.variant ?? species.variant;
  const palette = overrides.palette ?? species.palette;
  const [outline, body, accent] = palette;

  const blocks: PixelBlock[] = [
    { x: 3, y: 6, w: 10, h: 8, color: outline },
    { x: 4, y: 7, w: 8, h: 6, color: body },
    { x: 5, y: 9, w: 2, h: 2, color: outline },
    { x: 9, y: 9, w: 2, h: 2, color: outline }
  ];
  if (variant === 'horn') {
    blocks.push({ x: 6, y: 3, w: 4, h: 3, color: accent }, { x: 7, y: 2, w: 2, h: 1, color: accent });
  } else if (variant === 'shell') {
    blocks.push({ x: 9, y: 4, w: 5, h: 4, color: accent }, { x: 10, y: 5, w: 3, h: 2, color: body });
  } else if (variant === 'spike') {
    blocks.push(
      { x: 4, y: 4, w: 2, h: 2, color: accent },
      { x: 7, y: 3, w: 2, h: 3, color: accent },
      { x: 10, y: 4, w: 2, h: 2, color: accent }
    );
  } else {
    blocks.push({ x: 4, y: 12, w: 8, h: 2, color: accent });
  }
  return { species, variant, palette, blocks };
}

/** Only the four supported visual states exist; everything else reads idle. */
export function visualStateFor(agent: WorldAgent, tasks: readonly WorldTask[]): MonsterVisualState {
  if (tasks.some((task) => task.assignee === agent.id && task.awaitsHuman)) return 'awaitsHuman';
  if (agent.state === 'working' || agent.state === 'blocked') return agent.state;
  return 'idle';
}

/** Critical state never rides on color alone: each state has its own shape. */
export function stateMarker(state: MonsterVisualState): StateMarker {
  switch (state) {
    case 'working': return { shape: 'bar', color: 0x63c76a };
    case 'blocked': return { shape: 'triangle', color: 0xe0574f };
    case 'awaitsHuman': return { shape: 'diamond', color: 0xe0a458 };
    default: return { shape: 'circle', color: 0x9db4d0 };
  }
}
