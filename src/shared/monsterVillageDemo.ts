export const MONSTER_VILLAGE_DEMO_KIND = 'starter-village-field-note-v1' as const;
export const MONSTER_VILLAGE_DEMO_TASK_ID = 'monster-village-demo-field-note';

export type MonsterVillageDemoObjectiveId =
  | 'meet-professor'
  | 'collect-meadow-leaf'
  | 'collect-stable-leaf'
  | 'return-professor';

export interface MonsterVillageDemoObjective {
  id: MonsterVillageDemoObjectiveId;
  label: string;
  anchor: { x: number; y: number };
  radius: number;
  kind: 'npc' | 'world-object' | 'delivery';
}

export interface MonsterVillageDemoState {
  kind: typeof MONSTER_VILLAGE_DEMO_KIND;
  objectiveIds: MonsterVillageDemoObjectiveId[];
  completedObjectiveIds: MonsterVillageDemoObjectiveId[];
  acceptedAt?: string;
}

export interface MonsterVillageDemoTaskSeed {
  id: typeof MONSTER_VILLAGE_DEMO_TASK_ID;
  title: string;
  description: string;
  status: 'todo';
  dependsOn: string[];
  priority: number;
  createdAt: string;
  worldDemo: MonsterVillageDemoState;
}

export const MONSTER_VILLAGE_DEMO_OBJECTIVES: readonly MonsterVillageDemoObjective[] = [
  { id: 'meet-professor', label: 'Talk to Professor', anchor: { x: 9, y: 11 }, radius: 3, kind: 'npc' },
  { id: 'collect-meadow-leaf', label: 'Collect a Lumina Leaf in the meadow', anchor: { x: 8, y: 14 }, radius: 3, kind: 'world-object' },
  { id: 'collect-stable-leaf', label: 'Collect a Lumina Leaf at the stable', anchor: { x: 49, y: 21 }, radius: 4, kind: 'world-object' },
  { id: 'return-professor', label: 'Return to Professor and deliver the note', anchor: { x: 9, y: 11 }, radius: 3, kind: 'delivery' }
];

const OBJECTIVE_IDS = MONSTER_VILLAGE_DEMO_OBJECTIVES.map((objective) => objective.id);

export function createMonsterVillageDemoTask(now = new Date().toISOString()): MonsterVillageDemoTaskSeed {
  return {
    id: MONSTER_VILLAGE_DEMO_TASK_ID,
    title: '[Monster Village demo] The First Field Note',
    description: 'Fixture/demo mission: meet Professor, gather two Lumina Leaves, and return the field note. This task is intentionally identifiable as demo content.',
    status: 'todo',
    dependsOn: [],
    priority: 3,
    createdAt: now,
    worldDemo: {
      kind: MONSTER_VILLAGE_DEMO_KIND,
      objectiveIds: [...OBJECTIVE_IDS],
      completedObjectiveIds: []
    }
  };
}

export function isMonsterVillageDemoState(value: unknown): value is MonsterVillageDemoState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<MonsterVillageDemoState>;
  return candidate.kind === MONSTER_VILLAGE_DEMO_KIND
    && Array.isArray(candidate.objectiveIds)
    && candidate.objectiveIds.every((id) => OBJECTIVE_IDS.includes(id as MonsterVillageDemoObjectiveId))
    && Array.isArray(candidate.completedObjectiveIds)
    && candidate.completedObjectiveIds.every((id) => OBJECTIVE_IDS.includes(id as MonsterVillageDemoObjectiveId));
}

export function objectiveById(id: string): MonsterVillageDemoObjective | undefined {
  return MONSTER_VILLAGE_DEMO_OBJECTIVES.find((objective) => objective.id === id);
}

export function isNearDemoObjective(id: string, position: { x: number; y: number }): boolean {
  const objective = objectiveById(id);
  if (!objective || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return false;
  return Math.hypot(position.x - objective.anchor.x, position.y - objective.anchor.y) <= objective.radius;
}

export function addDemoObjective(state: MonsterVillageDemoState, objectiveId: MonsterVillageDemoObjectiveId): MonsterVillageDemoState {
  if (!state.objectiveIds.includes(objectiveId) || state.completedObjectiveIds.includes(objectiveId)) return state;
  return { ...state, completedObjectiveIds: [...state.completedObjectiveIds, objectiveId] };
}

export function demoObjectivesComplete(state: MonsterVillageDemoState): boolean {
  return state.objectiveIds.every((id) => state.completedObjectiveIds.includes(id));
}
