export type CapabilityKind = 'mcp' | 'skill' | 'action' | 'hud' | 'cursor' | 'voice';

export type CapabilityActivation = 'live' | 'harness-restart' | 'presentation-restart';

export interface CapabilityDescriptor {
  id: string;
  kind: CapabilityKind;
  profiles: string[];
  shared: boolean;
  requires: string[];
  conflicts: string[];
  required: boolean;
  activation: CapabilityActivation;
  adapterId: string;
}

export interface WorldProfileDescriptor {
  id: string;
  labelKey: string;
  requiredCapabilities: string[];
  optionalCapabilities: string[];
  sharedCapabilities: string[];
  presentationId: string;
}

export interface ResolvedWorldProfile {
  profile: WorldProfileDescriptor;
  capabilities: CapabilityDescriptor[];
}

export interface WorldProfileResolutionError extends Error {
  code: string;
  profileId: string;
  capabilityId?: string;
  relatedId?: string;
}

export interface WorldCapabilityOverrides {
  enabled?: string[];
  disabled?: string[];
}
