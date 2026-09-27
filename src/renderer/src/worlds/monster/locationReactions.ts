import type { VisualTransition, WorldTask } from '../worldProjection';

/** A location gets one shared visual signal, however many workers finish there. */
export interface LocationReactionBurst {
  locationId: string;
  kind: 'task-completed';
  taskIds: readonly string[];
  agentIds: readonly string[];
  elapsedMs: number;
}

export const LOCATION_REACTION_DURATION_MS = 1400;

const SPARKLE_DIRECTIONS = [
  [-1, -1], [0, -1], [1, -1], [1, 0],
  [1, 1], [0, 1], [-1, 1], [-1, 0]
] as const;

/** Project only a real transition into Hive's durable `done` status. */
export function deriveLocationReactionBursts(
  transitions: readonly VisualTransition[],
  tasks: readonly WorldTask[],
  locationForAgent: ReadonlyMap<string, string>
): LocationReactionBurst[] {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const grouped = new Map<string, { taskIds: Set<string>; agentIds: Set<string> }>();

  for (const transition of transitions) {
    if (transition.kind !== 'task-status-changed' || transition.to !== 'done' || transition.from === 'done') continue;
    const task = tasksById.get(transition.taskId);
    if (!task || task.status !== 'done' || !task.assignee) continue;
    const locationId = locationForAgent.get(task.assignee);
    if (!locationId) continue;
    const group = grouped.get(locationId) ?? { taskIds: new Set<string>(), agentIds: new Set<string>() };
    group.taskIds.add(task.id);
    group.agentIds.add(task.assignee);
    grouped.set(locationId, group);
  }

  return [...grouped].sort(([a], [b]) => a.localeCompare(b)).map(([locationId, group]) => ({
    locationId,
    kind: 'task-completed',
    taskIds: [...group.taskIds].sort(),
    agentIds: [...group.agentIds].sort(),
    elapsedMs: 0
  }));
}

/** Advance a location-owned burst without retaining dead timers or ticker work. */
export function advanceLocationReaction(burst: LocationReactionBurst, deltaMs: number): LocationReactionBurst | null {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return burst;
  const elapsedMs = burst.elapsedMs + Math.min(deltaMs, 1000);
  return elapsedMs >= LOCATION_REACTION_DURATION_MS ? null : { ...burst, elapsedMs };
}

/** Whole-pixel sparkle geometry shared by every location skin. */
export function locationReactionFrame(elapsedMs: number): {
  alpha: number;
  radius: number;
  sparkles: readonly { x: number; y: number }[];
} {
  const progress = Math.max(0, Math.min(1, elapsedMs / LOCATION_REACTION_DURATION_MS));
  const radius = 2 + Math.floor(progress * 7);
  return {
    alpha: 1 - progress,
    radius,
    sparkles: SPARKLE_DIRECTIONS.map(([x, y]) => ({ x: x * radius, y: y * radius }))
  };
}
