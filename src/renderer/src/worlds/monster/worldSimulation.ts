import type { WorldTask } from '../worldProjection';
import type { EvolutionStage } from './monsterArt';

export type SimulationSpeed = 0.5 | 1 | 2;

export interface MonsterVillageGameState {
  version: 1;
  elapsedMs: number;
  paused: boolean;
  speed: SimulationSpeed;
  /** Durable world-only reward receipts. Never written to Hive. */
  rewardIds: readonly string[];
  rewardsByAgent: Readonly<Record<string, number>>;
}

export interface WorldReward {
  taskId: string;
  agentId: string | null;
}

export const MONSTER_VILLAGE_GAME_STORAGE_KEY = 'isyco-worlds:monster-village:game:v1';
export const DEFAULT_MONSTER_VILLAGE_GAME: MonsterVillageGameState = {
  version: 1,
  elapsedMs: 0,
  paused: false,
  speed: 1,
  rewardIds: [],
  rewardsByAgent: {}
};

const isSpeed = (value: unknown): value is SimulationSpeed => value === 0.5 || value === 1 || value === 2;

export function normalizeGameState(value: unknown): MonsterVillageGameState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_MONSTER_VILLAGE_GAME;
  const raw = value as Record<string, unknown>;
  const rewardIds = Array.isArray(raw.rewardIds)
    ? raw.rewardIds.filter((id): id is string => typeof id === 'string' && id.length > 0).slice(-1000)
    : [];
  const rawRewards = raw.rewardsByAgent && typeof raw.rewardsByAgent === 'object' && !Array.isArray(raw.rewardsByAgent)
    ? raw.rewardsByAgent as Record<string, unknown>
    : {};
  const rewardsByAgent: Record<string, number> = {};
  for (const [agentId, count] of Object.entries(rawRewards)) {
    if (typeof count === 'number' && Number.isSafeInteger(count) && count > 0) rewardsByAgent[agentId] = count;
  }
  return {
    version: 1,
    elapsedMs: typeof raw.elapsedMs === 'number' && Number.isFinite(raw.elapsedMs) ? Math.max(0, raw.elapsedMs) : 0,
    paused: raw.paused === true,
    speed: isSpeed(raw.speed) ? raw.speed : 1,
    rewardIds,
    rewardsByAgent
  };
}

export function readMonsterVillageGameState(storage: Pick<Storage, 'getItem'> | undefined = typeof localStorage === 'undefined' ? undefined : localStorage): MonsterVillageGameState {
  if (!storage) return DEFAULT_MONSTER_VILLAGE_GAME;
  try {
    const raw = storage.getItem(MONSTER_VILLAGE_GAME_STORAGE_KEY);
    return raw ? normalizeGameState(JSON.parse(raw)) : DEFAULT_MONSTER_VILLAGE_GAME;
  } catch {
    return DEFAULT_MONSTER_VILLAGE_GAME;
  }
}

export function writeMonsterVillageGameState(
  state: MonsterVillageGameState,
  storage: Pick<Storage, 'setItem'> | undefined = typeof localStorage === 'undefined' ? undefined : localStorage
): void {
  if (!storage) return;
  try { storage.setItem(MONSTER_VILLAGE_GAME_STORAGE_KEY, JSON.stringify(state)); } catch { /* world-only persistence is best effort */ }
}

/** Clock advancement is the only effect of the world speed controls. */
export function advanceSimulation(state: MonsterVillageGameState, deltaMs: number): MonsterVillageGameState {
  if (state.paused || !Number.isFinite(deltaMs) || deltaMs <= 0) return state;
  return { ...state, elapsedMs: state.elapsedMs + Math.min(deltaMs, 2_000) * state.speed };
}

/**
 * Reconcile only durable `done` task states. A task id is the idempotency key,
 * so replaying a snapshot or restarting the world cannot award twice.
 */
export function reconcileDurableRewards(
  state: MonsterVillageGameState,
  tasks: readonly WorldTask[]
): { state: MonsterVillageGameState; added: readonly WorldReward[] } {
  const seen = new Set(state.rewardIds);
  const rewardIds = [...state.rewardIds];
  const rewardsByAgent = { ...state.rewardsByAgent };
  const added: WorldReward[] = [];
  for (const task of tasks) {
    if (task.status !== 'done' || seen.has(task.id)) continue;
    seen.add(task.id);
    rewardIds.push(task.id);
    if (task.assignee) rewardsByAgent[task.assignee] = (rewardsByAgent[task.assignee] ?? 0) + 1;
    added.push({ taskId: task.id, agentId: task.assignee });
  }
  if (!added.length) return { state, added };
  return {
    state: { ...state, rewardIds: rewardIds.slice(-1000), rewardsByAgent },
    added
  };
}

export function evolutionStageForAgent(state: MonsterVillageGameState, agentId: string): EvolutionStage {
  const rewards = state.rewardsByAgent[agentId] ?? 0;
  if (rewards >= 3) return 'final';
  if (rewards >= 1) return 'middle';
  return 'baby';
}

export function formatSimulationClock(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}
