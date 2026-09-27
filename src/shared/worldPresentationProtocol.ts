import { isWorldId, type WorldId } from './worlds';
import { isVisualIdentityProfileV1, type VisualIdentityProfileV1 } from './worldProfiles';

export type WorldPresentationPhase = 'IDLE' | 'VALIDATING' | 'BOOTSTRAPPING' | 'MOUNTING' | 'READY' | 'RECOVERY';
export type WorldPresentationAgentState = 'idle' | 'working' | 'waiting' | 'blocked' | 'other';

/** Read-only, deliberately small projection. The host must never receive Hive or session stores. */
export interface WorldPresentationProjection {
  agents: Array<{ id: string; name: string; state: WorldPresentationAgentState; archived: boolean }>;
  tasks: Array<{ id: string; title: string; assignee: string | null; status: string; awaitsHuman: boolean }>;
  visualIdentities?: Record<string, VisualIdentityProfileV1>;
}

export type WorldPresentationCommand =
  | { type: 'bootstrap'; profileId: WorldId; generation: number; projection: WorldPresentationProjection }
  | { type: 'update-projection'; profileId: WorldId; generation: number; projection: WorldPresentationProjection }
  | { type: 'restart'; generation: number }
  | { type: 'dispose'; generation: number };

export interface WorldPresentationError {
  phase: Exclude<WorldPresentationPhase, 'IDLE' | 'READY'>;
  profileId: WorldId;
  category: 'host' | 'resource' | 'protocol' | 'unknown';
  cause: { name: string; message: string };
}

export type WorldPresentationIntent =
  | { type: 'select-agent'; agentId: string }
  | { type: 'open-task'; taskId: string }
  | { type: 'request-recovery' };

export type WorldPresentationEvent =
  | { type: 'phase'; profileId: WorldId; generation: number; phase: Exclude<WorldPresentationPhase, 'IDLE' | 'RECOVERY'> }
  | { type: 'ready'; profileId: WorldId; generation: number }
  | { type: 'failed'; profileId: WorldId; generation: number; error: WorldPresentationError }
  | { type: 'intent'; profileId: WorldId; generation: number; intent: WorldPresentationIntent };

export interface WorldPresentationStatus {
  phase: WorldPresentationPhase;
  profileId: WorldId | null;
  generation: number;
  error?: WorldPresentationError;
}

const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(value);
const validGeneration = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const validProjection = (value: unknown): value is WorldPresentationProjection => {
  if (!value || typeof value !== 'object') return false;
  const p = value as WorldPresentationProjection;
  const states = ['idle', 'working', 'waiting', 'blocked', 'other'];
  return Array.isArray(p.agents) && Array.isArray(p.tasks)
    && p.agents.every((a) => !!a && validId(a.id) && typeof a.name === 'string' && states.includes(a.state) && typeof a.archived === 'boolean')
    && p.tasks.every((t) => !!t && validId(t.id) && typeof t.title === 'string' && (t.assignee === null || validId(t.assignee)) && typeof t.status === 'string' && typeof t.awaitsHuman === 'boolean')
    && (p.visualIdentities === undefined || (!!p.visualIdentities && typeof p.visualIdentities === 'object' && !Array.isArray(p.visualIdentities)
      && Object.entries(p.visualIdentities).every(([agentId, profile]) => validId(agentId) && isVisualIdentityProfileV1(profile) && profile.agentId === agentId)));
};
const validCause = (value: unknown): value is { name: string; message: string } => !!value && typeof value === 'object'
  && typeof (value as { name?: unknown }).name === 'string' && typeof (value as { message?: unknown }).message === 'string';

export function isWorldPresentationCommand(value: unknown): value is WorldPresentationCommand {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.type === 'bootstrap' || v.type === 'update-projection') {
    return isWorldId(v.profileId) && validGeneration(v.generation) && validProjection(v.projection);
  }
  return (v.type === 'restart' || v.type === 'dispose') && validGeneration(v.generation);
}

export function isWorldPresentationEvent(value: unknown): value is WorldPresentationEvent {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (!isWorldId(v.profileId) || !validGeneration(v.generation)) return false;
  if (v.type === 'ready') return true;
  if (v.type === 'phase') return ['VALIDATING', 'BOOTSTRAPPING', 'MOUNTING', 'READY'].includes(String(v.phase));
  if (v.type === 'failed') {
    const error = v.error as Record<string, unknown> | undefined;
    return !!error && ['VALIDATING', 'BOOTSTRAPPING', 'MOUNTING'].includes(String(error.phase))
      && ['host', 'resource', 'protocol', 'unknown'].includes(String(error.category)) && validCause(error.cause);
  }
  if (v.type !== 'intent' || !v.intent || typeof v.intent !== 'object') return false;
  const intent = v.intent as Record<string, unknown>;
  if (intent.type === 'select-agent') return validId(intent.agentId);
  if (intent.type === 'open-task') return validId(intent.taskId);
  return intent.type === 'request-recovery';
}

export function isCurrentWorldPresentationEvent(event: WorldPresentationEvent, profileId: WorldId, generation: number): boolean {
  return event.profileId === profileId && event.generation === generation;
}
