import type { VisualIdentityProfileV1 } from '@shared/worldProfiles';

export type IdentityForAgent = (agentId: string) => VisualIdentityProfileV1;

/**
 * Profiles are deliberately isolated by exact agent id. A missing or malformed
 * entry gets a deterministic in-memory identity; rendering never writes it.
 */
export function createIdentityResolver(
  profiles: Record<string, VisualIdentityProfileV1>
): IdentityForAgent {
  return (agentId) => {
    const stored = profiles[agentId];
    if (stored && stored.agentId === agentId) return stored;
    return {
      version: 1,
      agentId,
      seed: `munder-worlds:v1:${agentId}`,
      appearances: {},
      updatedAt: 'derived'
    };
  };
}
