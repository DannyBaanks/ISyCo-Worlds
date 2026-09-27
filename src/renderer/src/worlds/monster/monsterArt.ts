import type { VisualIdentityProfileV1 } from '@shared/worldProfiles';
import type { WorldAgent, WorldTask } from '../worldProjection';

/**
 * Original procedural creature art for the Monster Trainer world. Everything
 * is derived from the profile seed (plus a small validated appearance payload)
 * and drawn as whole-pixel rectangles; no external images or franchise assets.
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

export interface MonsterAppearance {
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
  variant: MonsterVariant;
  palette: readonly [number, number, number];
  blocks: readonly PixelBlock[];
}

export type EvolutionStage = 'baby' | 'middle' | 'final';
export type CreatureAction = 'idle' | 'walk' | 'work' | 'blocked' | 'waiting';
export type CreatureDirection = 'up' | 'right' | 'down' | 'left';
export interface CreatureFrameOptions {
  stage: EvolutionStage;
  action: CreatureAction;
  direction: CreatureDirection;
  frame: 0 | 1;
}
export interface CreatureFramePlan extends CreaturePlan {
  width: 24;
  height: 24;
  stage: EvolutionStage;
  action: CreatureAction;
  direction: CreatureDirection;
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
  if (typeof record.variant === 'string'
    && (MONSTER_VARIANTS as readonly string[]).includes(record.variant)) {
    appearance.variant = record.variant as MonsterVariant;
  }
  if (Array.isArray(record.palette) && record.palette.length === 3 && record.palette.every(isHexColor)) {
    appearance.palette = record.palette as unknown as readonly [number, number, number];
  }
  return appearance;
}

/**
 * Deterministic creature layout on a 16x16 pixel grid: a body with two eyes,
 * plus a variant silhouette. All coordinates are whole pixels by construction.
 */
export function creaturePlan(profile: VisualIdentityProfileV1): CreaturePlan {
  const overrides = monsterAppearance(profile);
  const hash = hashSeed(profile.seed);
  const variant = overrides.variant ?? MONSTER_VARIANTS[hash % MONSTER_VARIANTS.length];
  const palette = overrides.palette ?? MONSTER_PALETTES[(hash >>> 3) % MONSTER_PALETTES.length];
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
  return { variant, palette, blocks };
}

/**
 * Authored pose plan for a village worker. Evolution changes its silhouette,
 * never its seeded variant or palette. Every stage shares a fixed foot baseline
 * so a swap in form does not visually jump off the ground.
 */
export function creatureFramePlan(profile: VisualIdentityProfileV1, pose: CreatureFrameOptions): CreatureFramePlan {
  const identity = creaturePlan(profile);
  const [outline, body, accent] = identity.palette;
  const { stage, action, direction, frame } = pose;
  const flip = direction === 'left';
  const side = direction === 'left' || direction === 'right';
  const bodyShape: Record<EvolutionStage, { x: number; y: number; w: number; h: number }> = {
    baby: { x: 7, y: 12, w: 10, h: 8 },
    middle: { x: 5, y: 9, w: 14, h: 11 },
    final: { x: 3, y: 7, w: 18, h: 13 }
  };
  const shape = bodyShape[stage];
  const bob = action === 'idle' || action === 'waiting' ? frame : 0;
  const stride = action === 'walk' ? (frame === 0 ? -1 : 1) : 0;
  const blocks: PixelBlock[] = [
    // A tiny transparent-ground shadow gives the sprite a shared floor contact.
    { x: 7, y: 21, w: 10, h: 2, color: 0x21312b },
    { x: shape.x, y: shape.y + bob, w: shape.w, h: shape.h - 1, color: outline },
    { x: shape.x + 1, y: shape.y + 1 + bob, w: shape.w - 2, h: shape.h - 3, color: body },
    { x: shape.x + 3, y: shape.y + 2 + bob, w: Math.max(2, Math.floor(shape.w / 3)), h: 2, color: accent },
    // Feet stay on the same ground line while alternating during movement.
    { x: flip ? 7 - stride : 7 + stride, y: 19, w: 4, h: 3, color: outline },
    { x: flip ? 13 + stride : 13 - stride, y: 19, w: 4, h: 3, color: outline }
  ];

  if (action === 'work') {
    blocks.push({ x: 17, y: 11, w: 4, h: 2, color: accent }, { x: 19, y: 9, w: 2, h: 2, color: 0xf5f0e6 });
  } else if (action === 'blocked') {
    blocks.push({ x: 10, y: 4, w: 4, h: 3, color: accent });
  } else if (action === 'waiting') {
    blocks.push({ x: 10, y: 4, w: 4, h: 2, color: accent });
  } else if (identity.variant === 'horn') {
    blocks.push({ x: 10, y: shape.y - 2 + bob, w: 4, h: 3, color: accent });
  } else if (identity.variant === 'shell') {
    blocks.push({ x: shape.x + shape.w - 3, y: shape.y + 2 + bob, w: 5, h: Math.max(4, shape.h - 4), color: accent });
  } else if (identity.variant === 'spike') {
    blocks.push({ x: shape.x + 3, y: shape.y - 2 + bob, w: 3, h: 3, color: accent }, { x: shape.x + 9, y: shape.y - 3 + bob, w: 3, h: 4, color: accent });
  } else {
    blocks.push({ x: shape.x + 2, y: shape.y + shape.h - 3 + bob, w: shape.w - 4, h: 2, color: accent });
  }

  // Two eyes face the camera; side/back poses remain readable without changing
  // the identity colors or inventing another creature species.
  if (direction === 'down') {
    blocks.push({ x: shape.x + 3, y: shape.y + 4 + bob, w: 2, h: 2, color: outline }, { x: shape.x + shape.w - 5, y: shape.y + 4 + bob, w: 2, h: 2, color: outline });
  } else if (side) {
    blocks.push({ x: flip ? shape.x + 2 : shape.x + shape.w - 4, y: shape.y + 4 + bob, w: 2, h: 2, color: outline });
  } else {
    blocks.push({ x: shape.x + 2, y: shape.y + 4 + bob, w: shape.w - 4, h: 1, color: outline });
  }

  return { ...identity, width: 24, height: 24, stage, action, direction, blocks };
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
