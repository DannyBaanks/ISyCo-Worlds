const IDENTIFIER = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const MAX_GRID_VALUE = 4096;

export interface GridPoint {
  x: number;
  y: number;
}

export interface CompositionFootprint {
  width: number;
  height: number;
}

export interface CompositionInteractionSlot {
  id: string;
  kind: string;
  capacity: number;
}

export interface CompositionObjectDefinition {
  id: string;
  kind: 'structure' | 'prop';
  assetId: string;
  footprint: CompositionFootprint;
  movable: boolean;
  removable: boolean;
  semanticAnchors?: Readonly<Record<string, GridPoint>>;
  stationKind?: string;
  affinities?: readonly string[];
  interactionSlots?: readonly CompositionInteractionSlot[];
  interactionPoints?: Readonly<Record<string, GridPoint>>;
}

export interface CompositionScenarioDefinition {
  scenarioId: string;
  columns: number;
  rows: number;
  terrainIds: readonly string[];
  objects: Readonly<Record<string, CompositionObjectDefinition>>;
}

export interface CompositionPlacement {
  id: string;
  definitionId: string;
  x: number;
  y: number;
}

export interface PaintedTerrainCell {
  x: number;
  y: number;
  terrainId: string;
}

/** Durable, visual-only composition. `terrain` stores brush overrides over the scenario ground. */
export interface WorldCompositionV1 {
  version: 1;
  scenarioId: string;
  placements: CompositionPlacement[];
  terrain: PaintedTerrainCell[];
}

export type CompositionCommand =
  | { type: 'place-object'; placement: CompositionPlacement }
  | { type: 'move-object'; placementId: string; x: number; y: number }
  | { type: 'remove-object'; placementId: string }
  | { type: 'paint-terrain'; x: number; y: number; terrainId: string | null };

export interface CompositionEditorState {
  present: WorldCompositionV1;
  past: WorldCompositionV1[];
}

export type CompositionValidationCode =
  | 'invalid-document'
  | 'invalid-definition'
  | 'scenario-mismatch'
  | 'unknown-object'
  | 'duplicate-placement'
  | 'out-of-bounds'
  | 'overlap'
  | 'object-locked'
  | 'unknown-terrain'
  | 'duplicate-terrain-cell'
  | 'invalid-command';

export type CompositionResult = { ok: true } | { ok: false; error: CompositionValidationCode };
export type CompositionEditResult =
  | { ok: true; state: CompositionEditorState }
  | { ok: false; state: CompositionEditorState; error: CompositionValidationCode };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && IDENTIFIER.test(value);
}

function isGridCoordinate(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= MAX_GRID_VALUE;
}

function isGridPoint(value: unknown): value is GridPoint {
  return isRecord(value) && isGridCoordinate(value.x) && isGridCoordinate(value.y);
}

function validNamedPoints(value: unknown): value is Readonly<Record<string, GridPoint>> {
  return isRecord(value) && Object.entries(value).every(([name, point]) => isId(name) && isGridPoint(point));
}

function validObjectDefinition(value: unknown, key: string): value is CompositionObjectDefinition {
  if (!isRecord(value) || value.id !== key || !isId(value.id) || !isId(value.assetId)) return false;
  if (value.kind !== 'structure' && value.kind !== 'prop') return false;
  if (!isRecord(value.footprint) || !Number.isSafeInteger(value.footprint.width) || !Number.isSafeInteger(value.footprint.height)
    || (value.footprint.width as number) <= 0 || (value.footprint.height as number) <= 0
    || (value.footprint.width as number) > MAX_GRID_VALUE || (value.footprint.height as number) > MAX_GRID_VALUE) return false;
  if (typeof value.movable !== 'boolean' || typeof value.removable !== 'boolean') return false;
  if (value.semanticAnchors !== undefined && !validNamedPoints(value.semanticAnchors)) return false;
  if (value.stationKind !== undefined && !isId(value.stationKind)) return false;
  if (value.affinities !== undefined && (!Array.isArray(value.affinities) || !value.affinities.every(isId))) return false;
  if (value.interactionPoints !== undefined && !validNamedPoints(value.interactionPoints)) return false;
  if (value.interactionSlots !== undefined) {
    if (!Array.isArray(value.interactionSlots)) return false;
    const seen = new Set<string>();
    for (const slot of value.interactionSlots) {
      if (!isRecord(slot) || !isId(slot.id) || !isId(slot.kind) || !Number.isSafeInteger(slot.capacity) || (slot.capacity as number) <= 0 || seen.has(slot.id)) return false;
      seen.add(slot.id);
    }
  }
  return true;
}

export function isWorldCompositionV1(value: unknown): value is WorldCompositionV1 {
  if (!isRecord(value) || value.version !== 1 || !isId(value.scenarioId)
    || !Array.isArray(value.placements) || !Array.isArray(value.terrain)) return false;
  if (Object.keys(value).some((key) => !['version', 'scenarioId', 'placements', 'terrain'].includes(key))) return false;
  const placementIds = new Set<string>();
  for (const placement of value.placements) {
    if (!isRecord(placement) || !isId(placement.id) || !isId(placement.definitionId)
      || !isGridCoordinate(placement.x) || !isGridCoordinate(placement.y) || placementIds.has(placement.id)) return false;
    if (Object.keys(placement).some((key) => !['id', 'definitionId', 'x', 'y'].includes(key))) return false;
    placementIds.add(placement.id);
  }
  const cells = new Set<string>();
  for (const cell of value.terrain) {
    if (!isRecord(cell) || !isGridCoordinate(cell.x) || !isGridCoordinate(cell.y) || !isId(cell.terrainId)) return false;
    if (Object.keys(cell).some((key) => !['x', 'y', 'terrainId'].includes(key))) return false;
    const key = `${cell.x},${cell.y}`;
    if (cells.has(key)) return false;
    cells.add(key);
  }
  return true;
}

function validScenarioDefinition(value: CompositionScenarioDefinition): boolean {
  if (!isRecord(value) || !isId(value.scenarioId) || !Number.isSafeInteger(value.columns) || !Number.isSafeInteger(value.rows)
    || value.columns <= 0 || value.rows <= 0 || value.columns > MAX_GRID_VALUE || value.rows > MAX_GRID_VALUE
    || !Array.isArray(value.terrainIds) || !value.terrainIds.every(isId) || !isRecord(value.objects)) return false;
  if (new Set(value.terrainIds).size !== value.terrainIds.length) return false;
  return Object.entries(value.objects).every(([key, item]) => validObjectDefinition(item, key));
}

function withinMap(x: number, y: number, width: number, height: number, columns: number, rows: number): boolean {
  return Number.isSafeInteger(x) && Number.isSafeInteger(y) && x >= 0 && y >= 0
    && x + width <= columns && y + height <= rows;
}

export function validateComposition(layout: WorldCompositionV1, definition: CompositionScenarioDefinition): CompositionResult {
  if (!validScenarioDefinition(definition)) return { ok: false, error: 'invalid-definition' };
  if (!isWorldCompositionV1(layout)) return { ok: false, error: 'invalid-document' };
  if (layout.scenarioId !== definition.scenarioId) return { ok: false, error: 'scenario-mismatch' };

  const occupied = new Set<string>();
  for (const placement of layout.placements) {
    const object = definition.objects[placement.definitionId];
    if (!object) return { ok: false, error: 'unknown-object' };
    const { width, height } = object.footprint;
    if (!withinMap(placement.x, placement.y, width, height, definition.columns, definition.rows)) {
      return { ok: false, error: 'out-of-bounds' };
    }
    for (let y = placement.y; y < placement.y + height; y += 1) {
      for (let x = placement.x; x < placement.x + width; x += 1) {
        const key = `${x},${y}`;
        if (occupied.has(key)) return { ok: false, error: 'overlap' };
        occupied.add(key);
      }
    }
  }

  const terrain = new Set(definition.terrainIds);
  const terrainCells = new Set<string>();
  for (const cell of layout.terrain) {
    if (!terrain.has(cell.terrainId)) return { ok: false, error: 'unknown-terrain' };
    if (cell.x >= definition.columns || cell.y >= definition.rows) return { ok: false, error: 'out-of-bounds' };
    const key = `${cell.x},${cell.y}`;
    if (terrainCells.has(key)) return { ok: false, error: 'duplicate-terrain-cell' };
    terrainCells.add(key);
  }
  return { ok: true };
}

function rejected(state: CompositionEditorState, error: CompositionValidationCode): CompositionEditResult {
  return { ok: false, state, error };
}

export function applyCompositionCommand(
  state: CompositionEditorState,
  command: CompositionCommand,
  definition: CompositionScenarioDefinition
): CompositionEditResult {
  if (!state || !isWorldCompositionV1(state.present) || !Array.isArray(state.past)) return rejected(state, 'invalid-document');
  const next = structuredClone(state.present);

  if (command.type === 'place-object') {
    if (next.placements.some((placement) => placement.id === command.placement.id)) return rejected(state, 'duplicate-placement');
    next.placements.push(structuredClone(command.placement));
  } else if (command.type === 'move-object') {
    const placement = next.placements.find((item) => item.id === command.placementId);
    if (!placement) return rejected(state, 'unknown-object');
    const object = definition.objects[placement.definitionId];
    if (!object) return rejected(state, 'unknown-object');
    if (!object.movable) return rejected(state, 'object-locked');
    if (!Number.isSafeInteger(command.x) || !Number.isSafeInteger(command.y) || command.x < 0 || command.y < 0) return rejected(state, 'out-of-bounds');
    placement.x = command.x;
    placement.y = command.y;
  } else if (command.type === 'remove-object') {
    const index = next.placements.findIndex((item) => item.id === command.placementId);
    if (index < 0) return rejected(state, 'unknown-object');
    const object = definition.objects[next.placements[index].definitionId];
    if (!object) return rejected(state, 'unknown-object');
    if (!object.removable) return rejected(state, 'object-locked');
    next.placements.splice(index, 1);
  } else if (command.type === 'paint-terrain') {
    if (!Number.isSafeInteger(command.x) || !Number.isSafeInteger(command.y) || command.x < 0 || command.y < 0
      || command.x >= definition.columns || command.y >= definition.rows) return rejected(state, 'out-of-bounds');
    const index = next.terrain.findIndex((cell) => cell.x === command.x && cell.y === command.y);
    if (command.terrainId === null) {
      if (index >= 0) next.terrain.splice(index, 1);
    } else {
      if (!definition.terrainIds.includes(command.terrainId)) return rejected(state, 'unknown-terrain');
      const cell = { x: command.x, y: command.y, terrainId: command.terrainId };
      if (index >= 0) next.terrain[index] = cell;
      else next.terrain.push(cell);
    }
  } else {
    return rejected(state, 'invalid-command');
  }

  const validation = validateComposition(next, definition);
  if (!validation.ok) return rejected(state, validation.error);
  return {
    ok: true,
    state: {
      present: next,
      past: [...state.past.map((item) => structuredClone(item)), structuredClone(state.present)]
    }
  };
}

export function undoComposition(state: CompositionEditorState): CompositionEditorState {
  if (!state || !isWorldCompositionV1(state.present) || !Array.isArray(state.past) || state.past.length === 0) return state;
  const past = state.past.map((item) => structuredClone(item));
  const present = past.pop()!;
  return { present, past };
}

export function resolveRelativePoint(placement: CompositionPlacement, point: GridPoint): GridPoint {
  return { x: placement.x + point.x, y: placement.y + point.y };
}
