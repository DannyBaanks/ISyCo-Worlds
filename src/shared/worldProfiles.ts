import { isWorldId, type WorldId } from './worlds';

/** A durable, world-neutral visual identity for one real agent. */
export interface VisualIdentityProfileV1 {
  version: 1;
  agentId: string;
  seed: string;
  appearances: Partial<Record<WorldId, unknown>>;
  updatedAt: string;
}

export interface WorldProfilesFileV1 {
  version: 1;
  profiles: Record<string, VisualIdentityProfileV1>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isVisualIdentityProfileV1(value: unknown): value is VisualIdentityProfileV1 {
  if (!isRecord(value)) return false;
  if (value.version !== 1) return false;
  if (typeof value.agentId !== 'string' || !value.agentId.trim()) return false;
  if (typeof value.seed !== 'string' || !value.seed) return false;
  if (typeof value.updatedAt !== 'string' || !value.updatedAt) return false;
  if (!isRecord(value.appearances)) return false;
  return Object.keys(value.appearances).every(isWorldId);
}

export function isWorldProfilesFileV1(value: unknown): value is WorldProfilesFileV1 {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.profiles)) return false;
  return Object.entries(value.profiles).every(
    ([agentId, profile]) => agentId === (profile as { agentId?: unknown }).agentId && isVisualIdentityProfileV1(profile)
  );
}
