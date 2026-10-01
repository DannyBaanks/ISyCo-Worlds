// The first profile is the default world shown to new installations.
export const WORLD_IDS = ['monster-trainer', 'office'] as const;

export type WorldId = (typeof WORLD_IDS)[number];

export function isWorldId(value: unknown): value is WorldId {
  return typeof value === 'string' && (WORLD_IDS as readonly string[]).includes(value);
}
