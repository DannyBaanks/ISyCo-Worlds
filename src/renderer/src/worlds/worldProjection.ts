/**
 * The smallest renderer-neutral reading of agent/task state that a visual world
 * may use. It deliberately contains no operational meaning beyond the source
 * fields: no inferred success, collaboration, artifacts, or progression.
 */
import type { WorldPresentationActivity } from '@shared/worldPresentationProtocol';
import { isMonsterVillageDemoState, type MonsterVillageDemoState } from '@shared/monsterVillageDemo';

export type WorldAgentState = 'idle' | 'working' | 'waiting' | 'blocked' | 'other';

export interface WorldAgent {
  id: string;
  name: string;
  state: WorldAgentState;
  archived: boolean;
  /** Selected Monster Village roster sprite; absent for legacy/default records. */
  monsterCharacter?: MonsterRosterCharacter;
  /** Live station inferred by the existing hook/PTY read layer, when present. */
  station?: string;
  /** Last tool kind reported by the existing hook/PTY read layer, when present. */
  tool?: string;
}

export interface WorldTask {
  id: string;
  title: string;
  assignee: string | null;
  status: string;
  awaitsHuman: boolean;
  worldDemo?: MonsterVillageDemoState;
}

export interface CanonicalWorldSnapshot {
  readonly agents: readonly WorldAgent[];
  readonly tasks: readonly WorldTask[];
  readonly activity: readonly WorldPresentationActivity[];
}

export type VisualTransition =
  | { kind: 'agent-added' | 'agent-removed'; agentId: string }
  | { kind: 'agent-state-changed'; agentId: string; from: WorldAgentState; to: WorldAgentState }
  | { kind: 'task-added' | 'task-removed'; taskId: string }
  | { kind: 'task-status-changed'; taskId: string; from: string; to: string }
  | { kind: 'task-assignee-changed'; taskId: string; from: string | null; to: string | null }
  | { kind: 'task-awaits-human-changed'; taskId: string; from: boolean; to: boolean };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function boundedString(value: unknown, fallback: string): string {
  const text = stringField(value) ?? fallback;
  return text.slice(0, 160);
}

function normalizeAgentState(status: unknown): WorldAgentState {
  if (status === 'idle') return 'idle';
  if (status === 'working' || status === 'running' || status === 'busy' || status === 'thinking' || status === 'compacting' || status === 'typing') return 'working';
  if (status === 'waiting' || status === 'queued') return 'waiting';
  if (status === 'blocked' || status === 'looping') return 'blocked';
  return 'other';
}

function awaitsHuman(task: Record<string, unknown>, status: string): boolean {
  if (status !== 'blocked' || !Array.isArray(task.humanQA)) return false;
  return task.humanQA.some((entry) => {
    const question = record(entry);
    if (!question || !stringField(question.q)) return false;
    const answered = typeof question.a === 'string' && question.a.trim().length > 0;
    return !answered && !question.dismissedAt;
  });
}

export function normalizeWorldSnapshot(agents: unknown, rawTasks: unknown, rawActivity: unknown = []): CanonicalWorldSnapshot {
  const normalizedAgents = (Array.isArray(agents) ? agents : []).flatMap((value): WorldAgent[] => {
    const agent = record(value);
    const id = agent && stringField(agent.id);
    if (!agent || !id) return [];
    const monsterCharacter = canonicalMonsterCharacter(agent.monsterCharacter);
    const station = stringField(agent.currentStation);
    const tool = stringField(agent.carrying);
    return [{
      id,
      name: stringField(agent.name) ?? id,
      state: normalizeAgentState(agent.status),
      archived: agent.archived === true,
      ...(monsterCharacter ? { monsterCharacter } : {}),
      ...(station ? { station } : {}),
      ...(tool ? { tool } : {})
    }];
  }).sort((a, b) => a.id.localeCompare(b.id));

  const normalizedTasks = (Array.isArray(rawTasks) ? rawTasks : []).flatMap((value): WorldTask[] => {
    const task = record(value);
    const id = task && stringField(task.id);
    if (!task || !id) return [];
    const status = stringField(task.status) ?? 'other';
    return [{
      id,
      title: stringField(task.title) ?? 'Untitled task',
      assignee: stringField(task.assignee),
      status,
      awaitsHuman: awaitsHuman(task, status),
      ...(isMonsterVillageDemoState(task.worldDemo) ? { worldDemo: task.worldDemo } : {})
    }];
  }).sort((a, b) => a.id.localeCompare(b.id));

  return { agents: normalizedAgents, tasks: normalizedTasks, activity: normalizeWorldActivity(rawActivity) };
}

/**
 * Convert the existing durable Hive log into a small, redacted activity feed.
 * This deliberately ignores message bodies, prompts, tool inputs and paths.
 */
export function normalizeWorldActivity(rawLog: unknown): WorldPresentationActivity[] {
  return (Array.isArray(rawLog) ? rawLog : []).flatMap((value, index): WorldPresentationActivity[] => {
    const entry = record(value);
    const ts = entry && typeof entry.ts === 'number' && Number.isFinite(entry.ts) ? entry.ts : 0;
    const kind = entry && stringField(entry.kind);
    if (!entry || !ts || !kind) return [];
    const agentId = stringField(entry.agentId);
    const taskId = stringField(entry.taskId);
    const from = stringField(entry.from);
    const to = stringField(entry.to);
    const subject = stringField(entry.subject);
    let detail = `Hive event: ${kind}`;
    if (kind === 'message') detail = `${from ?? 'unknown'} → ${to ?? 'unknown'}${subject ? ` · ${subject}` : ''}`;
    else if (kind === 'tasks') detail = 'Hive task ledger updated';
    else if (kind === 'spawn') detail = `Agent ${stringField(entry.name) ?? agentId ?? 'unknown'} spawned`;
    else if (kind === 'session') detail = `Agent ${agentId ?? 'unknown'} session changed`;
    else if (kind === 'agent-exit') detail = `Agent ${agentId ?? 'unknown'} exited`;
    else if (kind === 'archive') detail = `Agent ${agentId ?? 'unknown'} archive state changed`;
    else if (kind === 'agent-hold') detail = `Agent ${agentId ?? stringField(entry.id) ?? 'unknown'} hold state changed`;
    else if (kind === 'drain') detail = `Agent ${agentId ?? 'unknown'} received ${String(entry.count ?? 0)} message(s)`;
    else if (kind === 'drop') detail = `Hive routing dropped a message (${String(entry.reason ?? 'unknown reason')})`;
    else if (kind === 'voice_action') detail = `Hive action: ${boundedString(entry.verb, 'unknown')}`;
    else if (agentId) detail = `Agent ${agentId}: ${kind}`;
    const safeKind = kind.replace(/[^a-zA-Z0-9._:-]/g, '_');
    return [{
      id: `activity:${ts}:${index}:${safeKind}`,
      ts,
      source: 'Hive log (log.jsonl)',
      kind,
      detail: boundedString(detail, `Hive event: ${kind}`),
      ...(agentId ? { agentId } : {}),
      ...(taskId ? { taskId } : {})
    }];
  }).sort((a, b) => b.ts - a.ts).slice(0, 16);
}

function byId<T extends { id: string }>(values: readonly T[]): Map<string, T> {
  return new Map(values.map((value) => [value.id, value]));
}

/** Diff only facts visual effects can safely reflect; equal snapshots are quiet. */
export function deriveVisualTransitions(
  previous: CanonicalWorldSnapshot,
  next: CanonicalWorldSnapshot
): VisualTransition[] {
  const priorAgents = byId(previous.agents);
  const nextAgents = byId(next.agents);
  const priorTasks = byId(previous.tasks);
  const nextTasks = byId(next.tasks);
  const transitions: VisualTransition[] = [];

  for (const agent of next.agents) {
    const prior = priorAgents.get(agent.id);
    if (!prior) transitions.push({ kind: 'agent-added', agentId: agent.id });
  }
  for (const agent of previous.agents) {
    if (!nextAgents.has(agent.id)) transitions.push({ kind: 'agent-removed', agentId: agent.id });
  }
  for (const agent of next.agents) {
    const prior = priorAgents.get(agent.id);
    if (prior && prior.state !== agent.state) {
      transitions.push({ kind: 'agent-state-changed', agentId: agent.id, from: prior.state, to: agent.state });
    }
  }
  for (const task of next.tasks) {
    const prior = priorTasks.get(task.id);
    if (!prior) transitions.push({ kind: 'task-added', taskId: task.id });
  }
  for (const task of previous.tasks) {
    if (!nextTasks.has(task.id)) transitions.push({ kind: 'task-removed', taskId: task.id });
  }
  for (const task of next.tasks) {
    const prior = priorTasks.get(task.id);
    if (!prior) continue;
    if (prior.status !== task.status) {
      transitions.push({ kind: 'task-status-changed', taskId: task.id, from: prior.status, to: task.status });
    }
    if (prior.assignee !== task.assignee) {
      transitions.push({ kind: 'task-assignee-changed', taskId: task.id, from: prior.assignee, to: task.assignee });
    }
    if (prior.awaitsHuman !== task.awaitsHuman) {
      transitions.push({ kind: 'task-awaits-human-changed', taskId: task.id, from: prior.awaitsHuman, to: task.awaitsHuman });
    }
  }
  return transitions;
}
import { canonicalMonsterCharacter, type MonsterRosterCharacter } from './monster/rosterCharacters';
