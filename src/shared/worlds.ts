export const WORLD_IDS = ['office', 'monster-trainer'] as const;

export type WorldId = (typeof WORLD_IDS)[number];

export function isWorldId(value: unknown): value is WorldId {
  return typeof value === 'string' && (WORLD_IDS as readonly string[]).includes(value);
}
