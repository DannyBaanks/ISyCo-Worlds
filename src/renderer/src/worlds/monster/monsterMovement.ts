import { compositionSpan, type WorldCompositionV1, type GridPoint } from '@shared/worldComposition';
import type { WorldAgent, WorldTask } from '../worldProjection';
import {
  resolveStarterVillageAnchor,
  STARTER_VILLAGE_COLUMNS,
  STARTER_VILLAGE_PRESET,
  STARTER_VILLAGE_SCENARIO,
  STARTER_VILLAGE_TILE_SIZE,
  STARTER_VILLAGE_COMPOSITION_DEFINITION,
  type ScenarioAnchorId
} from './StarterVillageScenario';
import { visualStateFor, type MonsterVisualState } from './monsterArt';

export type WorkerDestination = 'professor' | 'stable' | 'training-grass' | 'village-idle' | 'route-exit';
export type WorkerDirection = 'up' | 'right' | 'down' | 'left';
export type WorkerAnimation = 'idle' | 'walk' | 'work' | 'blocked' | 'waiting';

export interface VillageNavigationGrid {
  columns: number;
  rows: number;
  blocked: Set<string>;
}

export interface TileWalker {
  path: readonly GridPoint[];
  tileSize: number;
  segment: number;
  x: number;
  y: number;
  direction: WorkerDirection;
  finished: boolean;
}

export interface WorkerMotionSnapshot {
  id: string;
  x: number;
  y: number;
  direction: WorkerDirection;
  action: WorkerAnimation;
  visualState: MonsterVisualState;
  frame: number;
  destination: WorkerDestination;
  arrived: boolean;
}

interface WorkerMotionRecord extends WorkerMotionSnapshot {
  walker: TileWalker;
  animationElapsed: number;
  taskId: string | null;
  agentState: WorldAgent['state'];
}

const SOLID_OBJECTS = new Set([
  'laboratory', 'stable', 'village-home', 'tree', 'shrub', 'rock', 'crate',
  'fence-horizontal', 'fence-vertical', 'fence-post'
]);
const DIRECTION_STEPS: ReadonlyArray<readonly [number, number, WorkerDirection]> = [
  [0, -1, 'up'], [1, 0, 'right'], [0, 1, 'down'], [-1, 0, 'left']
];
const SLOT_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1],
  [2, 0], [0, 2], [-2, 0], [0, -2], [2, 1], [-2, 1], [2, -1], [-2, -1]
];

const cellId = ({ x, y }: GridPoint): string => `${x},${y}`;
const inBounds = (grid: VillageNavigationGrid, point: GridPoint): boolean =>
  Number.isInteger(point.x) && Number.isInteger(point.y)
  && point.x >= 0 && point.y >= 0 && point.x < grid.columns && point.y < grid.rows;

/** Build collision from semantic terrain/object footprints, never raster pixels. */
export function createStarterVillageNavigation(composition: WorldCompositionV1): VillageNavigationGrid {
  const span = compositionSpan(composition, STARTER_VILLAGE_COLUMNS, STARTER_VILLAGE_SCENARIO.map.rows);
  const blocked = new Set<string>();
  const terrain = new Map(STARTER_VILLAGE_PRESET.terrain.map((cell) => [cellId(cell), cell.terrainId]));
  for (const cell of composition.terrain) terrain.set(cellId(cell), cell.terrainId);
  for (const [id, terrainId] of terrain) if (terrainId === 'water') blocked.add(id);

  for (const placement of composition.placements) {
    if (!SOLID_OBJECTS.has(placement.definitionId)) continue;
    const definition = STARTER_VILLAGE_COMPOSITION_DEFINITION.objects[placement.definitionId];
    if (!definition) continue;
    for (let y = placement.y; y < placement.y + definition.footprint.height; y += 1) {
      for (let x = placement.x; x < placement.x + definition.footprint.width; x += 1) {
        if (x >= 0 && y >= 0 && x < span.columns && y < span.rows) blocked.add(`${x},${y}`);
      }
    }
  }
  return { columns: span.columns, rows: span.rows, blocked };
}

/** Breadth-first four-way navigation. Blocked destinations fail closed. */
export function findTilePath(grid: VillageNavigationGrid, start: GridPoint, goal: GridPoint): GridPoint[] | null {
  if (!inBounds(grid, start) || !inBounds(grid, goal) || grid.blocked.has(cellId(goal))) return null;
  if (start.x === goal.x && start.y === goal.y) return [{ ...start }];

  const queue: GridPoint[] = [{ ...start }];
  const parents = new Map<string, string | null>([[cellId(start), null]]);
  let cursor = 0;
  while (cursor < queue.length) {
    const current = queue[cursor++];
    for (const [dx, dy] of DIRECTION_STEPS) {
      const next = { x: current.x + dx, y: current.y + dy };
      const key = cellId(next);
      if (!inBounds(grid, next) || grid.blocked.has(key) || parents.has(key)) continue;
      parents.set(key, cellId(current));
      if (next.x === goal.x && next.y === goal.y) {
        const path: GridPoint[] = [next];
        let parent = parents.get(key);
        while (parent) {
          const [x, y] = parent.split(',').map(Number);
          path.push({ x, y });
          parent = parents.get(parent);
        }
        return path.reverse();
      }
      queue.push(next);
    }
  }
  return null;
}

/** Runtime facts only choose a visual destination; they never write tasks or agent state. */
export function destinationForWorker(agent: Pick<WorldAgent, 'id' | 'state'>, tasks: readonly WorldTask[]): WorkerDestination {
  if (tasks.some((task) => task.assignee === agent.id && task.awaitsHuman)) return 'professor';
  if (agent.state === 'blocked') return 'professor';
  if (agent.state === 'working') return 'training-grass';
  if (agent.state === 'waiting') return 'village-idle';
  return 'village-idle';
}

export function createTileWalker(path: readonly GridPoint[], tileSize = STARTER_VILLAGE_TILE_SIZE): TileWalker {
  const safePath = path.map((point) => ({ x: point.x, y: point.y }));
  const first = safePath[0] ?? { x: 0, y: 0 };
  const second = safePath[1];
  return {
    path: safePath,
    tileSize,
    segment: 1,
    x: first.x * tileSize,
    y: first.y * tileSize,
    direction: second ? directionBetween(first, second) : 'down',
    finished: safePath.length < 2
  };
}

export function advanceTileWalker(walker: TileWalker, deltaMs: number, speedPxPerSecond: number): TileWalker {
  if (walker.finished || !Number.isFinite(deltaMs) || deltaMs <= 0 || !Number.isFinite(speedPxPerSecond) || speedPxPerSecond <= 0) return walker;
  let remaining = speedPxPerSecond * Math.min(deltaMs, 1000) / 1000;
  let x = walker.x;
  let y = walker.y;
  let segment = walker.segment;
  let direction = walker.direction;
  while (remaining > 0 && segment < walker.path.length) {
    const point = walker.path[segment];
    const targetX = point.x * walker.tileSize;
    const targetY = point.y * walker.tileSize;
    const dx = targetX - x;
    const dy = targetY - y;
    const distance = Math.hypot(dx, dy);
    if (distance === 0) { segment += 1; continue; }
    direction = directionBetween(walker.path[segment - 1], point);
    const travel = Math.min(distance, remaining);
    const ratio = travel / distance;
    x = Math.round(x + dx * ratio);
    y = Math.round(y + dy * ratio);
    remaining -= travel;
    if (travel >= distance) segment += 1;
  }
  return { ...walker, segment, x, y, direction, finished: segment >= walker.path.length };
}

function directionBetween(from: GridPoint, to: GridPoint): WorkerDirection {
  if (to.x > from.x) return 'right';
  if (to.x < from.x) return 'left';
  if (to.y < from.y) return 'up';
  return 'down';
}

function anchorPlacements(composition: WorldCompositionV1): Record<ScenarioAnchorId, GridPoint> {
  return {
    professor: resolveStarterVillageAnchor(composition, 'professor'),
    stable: resolveStarterVillageAnchor(composition, 'stable'),
    'training-grass': STARTER_VILLAGE_SCENARIO.anchorPlacements['training-grass'],
    'village-idle': STARTER_VILLAGE_SCENARIO.anchorPlacements['village-idle'],
    'route-exit': STARTER_VILLAGE_SCENARIO.anchorPlacements['route-exit']
  };
}

function nearestOpenTile(grid: VillageNavigationGrid, origin: GridPoint, reserved: Set<string>): GridPoint | null {
  const queue = [origin];
  const seen = new Set<string>([cellId(origin)]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const point = queue[cursor];
    if (inBounds(grid, point) && !grid.blocked.has(cellId(point)) && !reserved.has(cellId(point))) return point;
    for (const [dx, dy] of DIRECTION_STEPS) {
      const next = { x: point.x + dx, y: point.y + dy };
      if (!inBounds(grid, next) || seen.has(cellId(next))) continue;
      seen.add(cellId(next));
      queue.push(next);
    }
  }
  return null;
}

function goalForActor(
  grid: VillageNavigationGrid,
  start: GridPoint,
  anchor: GridPoint,
  reserved: Set<string>
): { point: GridPoint; path: GridPoint[] } | null {
  for (const [dx, dy] of SLOT_OFFSETS) {
    const point = { x: anchor.x + dx, y: anchor.y + dy };
    if (!inBounds(grid, point) || grid.blocked.has(cellId(point)) || reserved.has(cellId(point))) continue;
    const path = findTilePath(grid, start, point);
    if (path) return { point, path };
  }
  return null;
}

/** Session-local visual actor simulation. It consumes snapshots and emits poses; it owns no Hive truth. */
export class MonsterWorkerMotion {
  private readonly actors = new Map<string, WorkerMotionRecord>();
  private grid: VillageNavigationGrid | null = null;
  private activeComposition: WorldCompositionV1 | null = null;

  updateProjection(agents: readonly WorldAgent[], tasks: readonly WorldTask[], composition: WorldCompositionV1): void {
    this.activeComposition = composition;
    this.grid = createStarterVillageNavigation(composition);
    const activeAgents = agents.filter((agent) => !agent.archived);
    const activeIds = new Set(activeAgents.map((agent) => agent.id));
    for (const id of this.actors.keys()) if (!activeIds.has(id)) this.actors.delete(id);

    const anchors = anchorPlacements(composition);
    const spawnReserved = new Set<string>();
    const goalReserved = new Set<string>();
    activeAgents.forEach((agent, index) => {
      let actor = this.actors.get(agent.id);
      if (!actor) {
        const preferred = index === 0 ? anchors.stable : anchors['village-idle'];
        const spawn = nearestOpenTile(this.grid!, preferred, spawnReserved) ?? preferred;
        const walker = createTileWalker([spawn]);
        actor = {
          id: agent.id, x: walker.x, y: walker.y, direction: 'down', action: 'idle',
          visualState: 'idle', frame: 0, destination: 'village-idle', arrived: true,
          walker, animationElapsed: 0, taskId: null, agentState: 'idle'
        };
        this.actors.set(agent.id, actor);
      }

      const current = { x: Math.round(actor.x / STARTER_VILLAGE_TILE_SIZE), y: Math.round(actor.y / STARTER_VILLAGE_TILE_SIZE) };
      spawnReserved.add(cellId(current));
      const destination = destinationForWorker(agent, tasks);
      const anchor = anchors[destination];
      const target = goalForActor(this.grid!, current, anchor, goalReserved);
      if (target) {
        goalReserved.add(cellId(target.point));
        const existingGoal = actor.walker.path.at(-1);
        if (destination !== actor.destination || !existingGoal || existingGoal.x !== target.point.x || existingGoal.y !== target.point.y) {
          actor.walker = createTileWalker(target.path);
          actor.destination = destination;
          actor.arrived = target.path.length < 2;
        }
      }
      actor.visualState = visualStateFor(agent, tasks);
      actor.agentState = agent.state;
      actor.taskId = tasks.find((task) => task.assignee === agent.id)?.id ?? null;
      actor.action = actionFor(actor.visualState, actor.walker.finished, actor.agentState);
    });
  }

  tick(deltaMs: number, speedPxPerSecond = 32): readonly WorkerMotionSnapshot[] {
    for (const actor of this.actors.values()) {
      actor.walker = advanceTileWalker(actor.walker, deltaMs, speedPxPerSecond);
      actor.x = actor.walker.x;
      actor.y = actor.walker.y;
      actor.direction = actor.walker.direction;
      actor.arrived = actor.walker.finished;
      actor.action = actionFor(actor.visualState, actor.walker.finished, actor.agentState);
      actor.animationElapsed += Math.max(0, Math.min(deltaMs, 1000));
      const frameDuration = actor.action === 'walk' ? 125 : 340;
      if (actor.animationElapsed >= frameDuration) {
        actor.frame = (actor.frame + Math.floor(actor.animationElapsed / frameDuration)) % 2;
        actor.animationElapsed %= frameDuration;
      }
    }
    return this.snapshot();
  }

  snapshot(): readonly WorkerMotionSnapshot[] {
    return [...this.actors.values()].map(({ id, x, y, direction, action, visualState, frame, destination, arrived }) =>
      ({ id, x, y, direction, action, visualState, frame, destination, arrived }));
  }

  taskFor(agentId: string): string | null { return this.actors.get(agentId)?.taskId ?? null; }

  hasNavigation(): boolean { return this.grid !== null && this.activeComposition !== null; }
}

function actionFor(state: MonsterVisualState, arrived: boolean, agentState: WorldAgent['state']): WorkerAnimation {
  if (!arrived) return 'walk';
  if (state === 'working') return 'work';
  if (state === 'blocked') return 'blocked';
  if (state === 'awaitsHuman') return 'waiting';
  if (agentState === 'waiting') return 'waiting';
  return 'idle';
}
