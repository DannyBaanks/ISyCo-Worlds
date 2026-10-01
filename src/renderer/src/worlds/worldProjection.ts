/**
 * The smallest renderer-neutral reading of agent/task state that a visual world
 * may use. It deliberately contains no operational meaning beyond the source
 * fields: no inferred success, collaboration, artifacts, or progression.
 */
export type WorldAgentState = 'idle' | 'working' | 'waiting' | 'blocked' | 'other';

export interface WorldAgent {
  id: string;
  name: string;
  state: WorldAgentState;
  archived: boolean;
  /** Selected Monster Village roster sprite; absent for legacy/default records. */
  monsterCharacter?: MonsterRosterCharacter;
}

export interface WorldTask {
  id: string;
  title: string;
  assignee: string | null;
  status: string;
  awaitsHuman: boolean;
}

export interface CanonicalWorldSnapshot {
  agents: readonly WorldAgent[];
  tasks: readonly WorldTask[];
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

function normalizeAgentState(status: unknown): WorldAgentState {
  if (status === 'idle') return 'idle';
  if (status === 'working' || status === 'running' || status === 'busy') return 'working';
  if (status === 'waiting' || status === 'queued') return 'waiting';
  if (status === 'blocked') return 'blocked';
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

export function normalizeWorldSnapshot(agents: unknown, rawTasks: unknown): CanonicalWorldSnapshot {
  const normalizedAgents = (Array.isArray(agents) ? agents : []).flatMap((value): WorldAgent[] => {
    const agent = record(value);
    const id = agent && stringField(agent.id);
    if (!agent || !id) return [];
    return [{
      id,
      name: stringField(agent.name) ?? id,
      state: normalizeAgentState(agent.status),
      archived: agent.archived === true,
      ...(isMonsterRosterCharacter(agent.monsterCharacter) ? { monsterCharacter: agent.monsterCharacter } : {})
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
      awaitsHuman: awaitsHuman(task, status)
    }];
  }).sort((a, b) => a.id.localeCompare(b.id));

  return { agents: normalizedAgents, tasks: normalizedTasks };
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
import { isMonsterRosterCharacter, type MonsterRosterCharacter } from './monster/rosterCharacters';
