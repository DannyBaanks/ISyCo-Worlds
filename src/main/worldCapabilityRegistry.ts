import type {
  CapabilityDescriptor,
  ResolvedWorldProfile,
  WorldCapabilityOverrides,
  WorldProfileDescriptor,
  WorldProfileResolutionError
} from '../shared/worldCapabilities';
import { WORLD_IDS } from '../shared/worlds';

export const WORLD_PROFILES: readonly WorldProfileDescriptor[] = [
  {
    id: 'monster-trainer', labelKey: 'worlds.monsterTrainer',
    requiredCapabilities: ['trainer.core'], optionalCapabilities: ['trainer.mcp', 'trainer.skills', 'trainer.actions'],
    sharedCapabilities: ['workspace.filesystem', 'workspace.git'], presentationId: 'monster-trainer'
  },
  {
    id: 'office', labelKey: 'worlds.office',
    requiredCapabilities: ['office.core'], optionalCapabilities: ['munder.mcp', 'munder.skills', 'munder.actions'],
    sharedCapabilities: ['workspace.filesystem', 'workspace.git'], presentationId: 'office'
  },
];

export const WORLD_CAPABILITIES: readonly CapabilityDescriptor[] = [
  { id: 'office.core', kind: 'action', profiles: ['office'], shared: false, requires: [], conflicts: [], required: true, activation: 'harness-restart', adapterId: 'harness.core' },
  { id: 'trainer.core', kind: 'action', profiles: ['monster-trainer'], shared: false, requires: [], conflicts: [], required: true, activation: 'harness-restart', adapterId: 'harness.core' },
  { id: 'munder.mcp', kind: 'mcp', profiles: ['office'], shared: false, requires: ['office.core'], conflicts: [], required: false, activation: 'harness-restart', adapterId: 'mcp.munder' },
  { id: 'munder.skills', kind: 'skill', profiles: ['office'], shared: false, requires: [], conflicts: [], required: false, activation: 'harness-restart', adapterId: 'skills.munder' },
  { id: 'munder.actions', kind: 'action', profiles: ['office'], shared: false, requires: [], conflicts: [], required: false, activation: 'harness-restart', adapterId: 'actions.munder' },
  { id: 'trainer.mcp', kind: 'mcp', profiles: ['monster-trainer'], shared: false, requires: ['trainer.core'], conflicts: [], required: false, activation: 'harness-restart', adapterId: 'mcp.trainer' },
  { id: 'trainer.skills', kind: 'skill', profiles: ['monster-trainer'], shared: false, requires: [], conflicts: [], required: false, activation: 'harness-restart', adapterId: 'skills.trainer' },
  { id: 'trainer.actions', kind: 'action', profiles: ['monster-trainer'], shared: false, requires: [], conflicts: [], required: false, activation: 'harness-restart', adapterId: 'actions.trainer' },
  { id: 'workspace.filesystem', kind: 'mcp', profiles: ['office', 'monster-trainer'], shared: true, requires: [], conflicts: [], required: false, activation: 'harness-restart', adapterId: 'workspace.filesystem' },
  { id: 'workspace.git', kind: 'mcp', profiles: ['office', 'monster-trainer'], shared: true, requires: ['workspace.filesystem'], conflicts: [], required: false, activation: 'harness-restart', adapterId: 'workspace.git' }
];

function resolutionError(code: string, profileId: string, capabilityId?: string, relatedId?: string): WorldProfileResolutionError {
  const error = new Error(`${code}${capabilityId ? `: ${capabilityId}` : ''}${relatedId ? ` -> ${relatedId}` : ''}`) as WorldProfileResolutionError;
  error.name = 'WorldProfileResolutionError';
  error.code = code;
  error.profileId = profileId;
  if (capabilityId) error.capabilityId = capabilityId;
  if (relatedId) error.relatedId = relatedId;
  return error;
}

function uniqueById<T extends { id: string }>(items: readonly T[], code: string, profileId: string): Map<string, T> {
  const result = new Map<string, T>();
  for (const item of items) {
    if (!item.id || result.has(item.id)) throw resolutionError(code, profileId, item.id);
    result.set(item.id, item);
  }
  return result;
}

export function resolveWorldProfile(
  profileId: string,
  profiles: readonly WorldProfileDescriptor[] = WORLD_PROFILES,
  capabilities: readonly CapabilityDescriptor[] = WORLD_CAPABILITIES,
  overrides: WorldCapabilityOverrides = {}
): ResolvedWorldProfile {
  const profileMap = uniqueById(profiles, 'duplicate-profile', profileId);
  const capabilityMap = uniqueById(capabilities, 'duplicate-capability', profileId);
  const profile = profileMap.get(profileId);
  if (!profile) throw resolutionError('unknown-profile', profileId);

  const roots = [...profile.requiredCapabilities, ...profile.sharedCapabilities];
  for (const id of profile.optionalCapabilities) {
    if (!overrides.disabled?.includes(id)) roots.push(id);
  }
  for (const id of overrides.enabled || []) {
    if (!roots.includes(id)) roots.push(id);
  }

  const selected = new Set<string>();
  const visiting = new Set<string>();
  const ordered: CapabilityDescriptor[] = [];
  const visit = (id: string) => {
    const capability = capabilityMap.get(id);
    if (!capability) throw resolutionError('unknown-dependency', profileId, id);
    if (!capability.profiles.includes(profileId) && !capability.shared) {
      throw resolutionError('profile-capability-mismatch', profileId, id);
    }
    if (capability.shared && !profile.sharedCapabilities.includes(id)) {
      throw resolutionError('shared-capability-not-declared', profileId, id);
    }
    if (selected.has(id)) return;
    if (visiting.has(id)) throw resolutionError('dependency-cycle', profileId, id);
    visiting.add(id);
    for (const dependency of capability.requires) visit(dependency);
    visiting.delete(id);
    selected.add(id);
    ordered.push(capability);
  };
  for (const id of roots) visit(id);

  for (const item of ordered) {
    for (const conflict of item.conflicts) {
      if (selected.has(conflict)) throw resolutionError('capability-conflict', profileId, item.id, conflict);
    }
  }
  return { profile, capabilities: ordered };
}

export function isRegisteredWorldProfile(profileId: string): boolean {
  return (WORLD_IDS as readonly string[]).includes(profileId) && WORLD_PROFILES.some((profile) => profile.id === profileId);
}
