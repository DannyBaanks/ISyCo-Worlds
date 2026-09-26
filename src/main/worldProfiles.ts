import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import {
  isVisualIdentityProfileV1,
  isWorldProfilesFileV1,
  type VisualIdentityProfileV1,
  type WorldProfilesFileV1
} from '../shared/worldProfiles';

const WORLD_PROFILES_FILE = 'world-profiles.json';

function worldProfilesPath(): string {
  return join(app.getPath('userData'), WORLD_PROFILES_FILE);
}

function cloneProfile(profile: VisualIdentityProfileV1): VisualIdentityProfileV1 {
  return JSON.parse(JSON.stringify(profile)) as VisualIdentityProfileV1;
}

/** Invalid/corrupt files read as empty and are never rewritten during a read. */
export function readWorldProfiles(): Record<string, VisualIdentityProfileV1> {
  const path = worldProfilesPath();
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    if (!isWorldProfilesFileV1(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed.profiles).map(([agentId, profile]) => [agentId, cloneProfile(profile)])
    );
  } catch {
    return {};
  }
}

/** Return a deterministic in-memory default without creating persistent state. */
export function profileForAgent(
  profiles: Record<string, VisualIdentityProfileV1>,
  agentId: string
): VisualIdentityProfileV1 {
  const existing = profiles[agentId];
  if (existing) return cloneProfile(existing);
  if (!agentId.trim()) throw new Error('invalid agent id');
  return {
    version: 1,
    agentId,
    seed: `munder-worlds:v1:${agentId}`,
    appearances: {},
    updatedAt: 'derived'
  };
}

export function saveWorldProfile(profile: VisualIdentityProfileV1): void {
  if (!isVisualIdentityProfileV1(profile)) throw new Error('invalid visual identity profile');

  const profiles = readWorldProfiles();
  profiles[profile.agentId] = cloneProfile(profile);
  const file: WorldProfilesFileV1 = { version: 1, profiles };
  const path = worldProfilesPath();
  const temporaryPath = `${path}.${randomBytes(8).toString('hex')}.tmp`;

  mkdirSync(dirname(path), { recursive: true });
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(file, null, 2)}\n`, 'utf8');
    renameSync(temporaryPath, path);
  } finally {
    if (existsSync(temporaryPath)) rmSync(temporaryPath, { force: true });
  }
}
