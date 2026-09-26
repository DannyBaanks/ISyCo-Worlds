import type { WorldId } from '@shared/worlds';

export interface WorldDefinition {
  id: WorldId;
  labelKey: string;
  experimental: boolean;
}

/** A small allowlist: a persisted id never selects arbitrary renderer code. */
export const WORLD_REGISTRY: readonly WorldDefinition[] = [
  { id: 'office', labelKey: 'settings.general.worlds.office', experimental: false },
  { id: 'monster-trainer', labelKey: 'settings.general.worlds.monsterTrainer', experimental: true }
];

export function worldById(id: unknown): WorldDefinition {
  return WORLD_REGISTRY.find((world) => world.id === id) ?? WORLD_REGISTRY[0];
}
