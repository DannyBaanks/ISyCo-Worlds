import type { WorldId } from './worlds';
import { validateWorldManifest, type WorldManifestV1 } from './worldManifest';
import office from './worldManifests/office.world.json';
import monsterTrainer from './worldManifests/monster-trainer.world.json';

/**
 * The provenance of every bundled world, keyed by id. A world that is added
 * to WORLD_IDS without a manifest does not compile (Record<WorldId, …>), and
 * one whose manifest is incomplete fails test/world-manifest.test.cjs.
 */
export const WORLD_MANIFESTS: Readonly<Record<WorldId, WorldManifestV1>> = {
  office: office as WorldManifestV1,
  'monster-trainer': monsterTrainer as WorldManifestV1
};

export function worldManifest(id: WorldId): WorldManifestV1 {
  return WORLD_MANIFESTS[id];
}

/** Manifests that do not validate, with their problems. Empty in a healthy build. */
export function invalidWorldManifests(): Array<{ id: string; errors: string[] }> {
  return Object.entries(WORLD_MANIFESTS)
    .map(([id, manifest]) => ({ id, errors: validateWorldManifest(manifest) }))
    .filter((entry) => entry.errors.length > 0);
}
