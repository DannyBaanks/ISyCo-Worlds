import { createElement, type ComponentType, type ReactNode } from 'react';
import type { WorldId } from '@shared/worlds';
import { OfficeFloor } from '@/scene/office/OfficeFloor';
import { OFFICE_THEME } from '@/scene/office/themeRegistry';
import { MonsterTrainerSurface } from './monster/MonsterTrainerSurface';
import { STARTER_VILLAGE_SCENARIO } from './monster/StarterVillageScenario';
import type { WorldManifest } from './WorldEngine';

export const FALLBACK_WORLD_ID: WorldId = 'office';

export interface WorldSurfaceLifecycle {
  onReady: () => void;
  onRenderFailure: (cause: unknown) => void;
}

export interface WorldDefinition extends WorldManifest {
  labelKey: string;
  experimental: boolean;
  render: (lifecycle: WorldSurfaceLifecycle) => ReactNode;
}

// Task 3 gives both existing surfaces their lifecycle props. The casts keep this
// registry contract honest while preserving their established rendering boundary.
const OfficeSurface = OfficeFloor as unknown as ComponentType<WorldSurfaceLifecycle>;
const MonsterSurface = MonsterTrainerSurface as unknown as ComponentType<WorldSurfaceLifecycle>;

/** A small allowlist: a persisted id never selects arbitrary renderer code. */
export const WORLD_REGISTRY: readonly WorldDefinition[] = [
  {
    id: 'office',
    labelKey: 'settings.general.worlds.office',
    experimental: false,
    resources: OFFICE_THEME.tilesets.map((tileset, index) => ({
      id: `tileset-${index}`,
      url: tileset.url
    })),
    render: (lifecycle) => createElement(OfficeSurface, lifecycle)
  },
  {
    id: 'monster-trainer',
    labelKey: 'settings.general.worlds.monsterTrainer',
    experimental: true,
    resources: STARTER_VILLAGE_SCENARIO.resources,
    render: (lifecycle) => createElement(MonsterSurface, lifecycle)
  }
];

export function worldById(id: unknown): WorldDefinition {
  return WORLD_REGISTRY.find((world) => world.id === id) ?? WORLD_REGISTRY[0];
}
