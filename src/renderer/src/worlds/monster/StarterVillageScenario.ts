import starterVillageAtlasUrl from '../../assets/worlds/starter-village/starter-village-atlas.png?url';
import starterVillageBuildingsUrl from '../../assets/worlds/starter-village/starter-village-buildings.png?url';
import { MONSTER_ROSTER_URLS } from './monsterRosterSprites';
import { resolveRelativePoint, type CompositionScenarioDefinition, type GridPoint, type WorldCompositionV1 } from '@shared/worldComposition';

export const STARTER_VILLAGE_TILE_SIZE = 16;
export const STARTER_VILLAGE_COLUMNS = 64;
export const STARTER_VILLAGE_ROWS = 48;

export const STARTER_VILLAGE_ANCHOR_IDS = [
  'professor',
  'stable',
  'training-grass',
  'village-idle',
  'route-exit'
] as const;

export type ScenarioAnchorId = typeof STARTER_VILLAGE_ANCHOR_IDS[number];
export type StarterVillageTileId =
  | 'grass' | 'training-grass' | 'dirt' | 'road' | 'water' | 'tree' | 'shrub' | 'flowers'
  | 'guide-house' | 'stable' | 'fence-horizontal' | 'fence-vertical' | 'fence-post'
  | 'rock' | 'lantern' | 'crate' | 'sign';

export type StarterVillageBuildingId = 'laboratory' | 'stable-building' | 'village-home';

export interface StarterVillageAssetCatalogEntry {
  id: string;
  label: string;
  kind: 'structure' | 'prop';
  assetId: string;
  frameId: StarterVillageTileId | StarterVillageBuildingId;
}

/** Monster Trainer-specific art labels and frame bindings; the composition runtime stays world-agnostic. */
export const STARTER_VILLAGE_ASSET_CATALOG: Readonly<Record<string, StarterVillageAssetCatalogEntry>> = {
  laboratory: { id: 'laboratory', label: 'Field laboratory', kind: 'structure', assetId: 'laboratory', frameId: 'laboratory' },
  stable: { id: 'stable', label: 'Stable', kind: 'structure', assetId: 'stable-building', frameId: 'stable-building' },
  'village-home': { id: 'village-home', label: 'Village home', kind: 'structure', assetId: 'village-home', frameId: 'village-home' },
  tree: { id: 'tree', label: 'Tree', kind: 'prop', assetId: 'tree', frameId: 'tree' },
  shrub: { id: 'shrub', label: 'Shrub', kind: 'prop', assetId: 'shrub', frameId: 'shrub' },
  flowers: { id: 'flowers', label: 'Flowers', kind: 'prop', assetId: 'flowers', frameId: 'flowers' },
  rock: { id: 'rock', label: 'Rock', kind: 'prop', assetId: 'rock', frameId: 'rock' },
  lantern: { id: 'lantern', label: 'Lantern', kind: 'prop', assetId: 'lantern', frameId: 'lantern' },
  crate: { id: 'crate', label: 'Crate', kind: 'prop', assetId: 'crate', frameId: 'crate' },
  sign: { id: 'sign', label: 'Sign', kind: 'prop', assetId: 'sign', frameId: 'sign' },
  'fence-horizontal': { id: 'fence-horizontal', label: 'Horizontal fence', kind: 'prop', assetId: 'fence-horizontal', frameId: 'fence-horizontal' },
  'fence-vertical': { id: 'fence-vertical', label: 'Vertical fence', kind: 'prop', assetId: 'fence-vertical', frameId: 'fence-vertical' },
  'fence-post': { id: 'fence-post', label: 'Fence post', kind: 'prop', assetId: 'fence-post', frameId: 'fence-post' }
};

/** V1 stations and authored interaction coordinates are descriptive only; no worker behavior consumes them. */
export const STARTER_VILLAGE_COMPOSITION_DEFINITION: CompositionScenarioDefinition = {
  scenarioId: 'starter-village',
  columns: STARTER_VILLAGE_COLUMNS,
  rows: STARTER_VILLAGE_ROWS,
  terrainIds: ['grass', 'training-grass', 'dirt', 'road', 'water'],
  objects: {
    laboratory: {
      id: 'laboratory', kind: 'structure', assetId: 'laboratory', footprint: { width: 6, height: 5 }, movable: true, removable: false,
      semanticAnchors: { professor: { x: 3, y: 5 } },
      stationKind: 'research', affinities: ['research', 'observation'],
      interactionSlots: [{ id: 'research-desk', kind: 'research', capacity: 1 }],
      interactionPoints: { entrance: { x: 3, y: 5 }, work: { x: 4, y: 3 }, idle: { x: 1, y: 5 } }
    },
    stable: {
      id: 'stable', kind: 'structure', assetId: 'stable-building', footprint: { width: 6, height: 5 }, movable: true, removable: false,
      semanticAnchors: { stable: { x: 3, y: 5 } },
      stationKind: 'care', affinities: ['care', 'training'],
      interactionSlots: [{ id: 'stable-care', kind: 'care', capacity: 2 }],
      interactionPoints: { entrance: { x: 3, y: 5 }, work: { x: 4, y: 3 }, idle: { x: 1, y: 5 } }
    },
    'village-home': { id: 'village-home', kind: 'structure', assetId: 'village-home', footprint: { width: 4, height: 4 }, movable: true, removable: true, interactionPoints: { entrance: { x: 2, y: 4 } } },
    tree: { id: 'tree', kind: 'prop', assetId: 'tree', footprint: { width: 1, height: 1 }, movable: true, removable: true },
    shrub: { id: 'shrub', kind: 'prop', assetId: 'shrub', footprint: { width: 1, height: 1 }, movable: true, removable: true },
    flowers: { id: 'flowers', kind: 'prop', assetId: 'flowers', footprint: { width: 1, height: 1 }, movable: true, removable: true },
    rock: { id: 'rock', kind: 'prop', assetId: 'rock', footprint: { width: 1, height: 1 }, movable: true, removable: true },
    lantern: { id: 'lantern', kind: 'prop', assetId: 'lantern', footprint: { width: 1, height: 1 }, movable: true, removable: true },
    crate: { id: 'crate', kind: 'prop', assetId: 'crate', footprint: { width: 1, height: 1 }, movable: true, removable: true },
    sign: { id: 'sign', kind: 'prop', assetId: 'sign', footprint: { width: 1, height: 1 }, movable: true, removable: true },
    'fence-horizontal': { id: 'fence-horizontal', kind: 'prop', assetId: 'fence-horizontal', footprint: { width: 1, height: 1 }, movable: true, removable: true },
    'fence-vertical': { id: 'fence-vertical', kind: 'prop', assetId: 'fence-vertical', footprint: { width: 1, height: 1 }, movable: true, removable: true },
    'fence-post': { id: 'fence-post', kind: 'prop', assetId: 'fence-post', footprint: { width: 1, height: 1 }, movable: true, removable: true }
  }
};

export interface ScenarioTilePlacement {
  tile: StarterVillageTileId;
  x: number;
  y: number;
}

export interface ScenarioLayer {
  id: 'backdrop' | 'terrain' | 'roads' | 'structures' | 'foreground';
  zIndex: number;
  fill?: StarterVillageTileId;
  tiles: readonly ScenarioTilePlacement[];
}

export interface ScenarioAnchorPlacement {
  x: number;
  y: number;
  zIndex: number;
}

export interface StarterVillageScenario {
  id: 'starter-village';
  resources: readonly { id: string; url: string }[];
  map: {
    columns: typeof STARTER_VILLAGE_COLUMNS;
    rows: typeof STARTER_VILLAGE_ROWS;
    layers: readonly ScenarioLayer[];
  };
  semanticAnchors: readonly ScenarioAnchorId[];
  anchorPlacements: Readonly<Record<ScenarioAnchorId, ScenarioAnchorPlacement>>;
  ambient: {
    title: 'Starter Village';
    mood: 'first-light';
    palette: readonly number[];
  };
}

export const STARTER_VILLAGE_ATLAS_URL = starterVillageAtlasUrl;
export const STARTER_VILLAGE_BUILDINGS_ATLAS_URL = starterVillageBuildingsUrl;
export const MONSTER_ROSTER_SHEET_URLS = MONSTER_ROSTER_URLS;

function terrainRows(terrainId: string, rows: readonly [y: number, left: number, right: number][]) {
  return rows.flatMap(([y, left, right]) => Array.from({ length: right - left + 1 }, (_, i) => ({ x: left + i, y, terrainId })));
}

function propRow(definitionId: string, idPrefix: string, y: number, xs: readonly number[]) {
  return xs.map((x, index) => ({ id: `${idPrefix}-${index + 1}`, definitionId, x, y }));
}

function propColumn(definitionId: string, idPrefix: string, x: number, ys: readonly number[]) {
  return ys.map((y, index) => ({ id: `${idPrefix}-${index + 1}`, definitionId, x, y }));
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}

const STRUCTURE_LAYER_TILE: Partial<Record<string, StarterVillageTileId>> = {
  laboratory: 'guide-house',
  stable: 'stable',
  'village-home': 'guide-house',
  sign: 'sign',
  lantern: 'lantern',
  crate: 'crate',
  'fence-horizontal': 'fence-horizontal',
  'fence-vertical': 'fence-vertical',
  'fence-post': 'fence-post'
};
const FOREGROUND_LAYER_TILE = new Set(['tree', 'shrub', 'flowers', 'rock']);

function layersFromPreset(preset: WorldCompositionV1): ScenarioLayer[] {
  const structures: ScenarioTilePlacement[] = [];
  const foreground: ScenarioTilePlacement[] = [];
  for (const placement of preset.placements) {
    const structureTile = STRUCTURE_LAYER_TILE[placement.definitionId];
    if (structureTile) structures.push({ tile: structureTile, x: placement.x, y: placement.y });
    else if (FOREGROUND_LAYER_TILE.has(placement.definitionId)) foreground.push({ tile: placement.definitionId as StarterVillageTileId, x: placement.x, y: placement.y });
  }
  return [
    { id: 'backdrop', zIndex: 0, fill: 'grass', tiles: [] },
    {
      id: 'terrain', zIndex: 10,
      tiles: preset.terrain
        .filter((cell) => cell.terrainId === 'training-grass' || cell.terrainId === 'water')
        .map((cell) => ({ tile: cell.terrainId as StarterVillageTileId, x: cell.x, y: cell.y }))
    },
    {
      id: 'roads', zIndex: 20,
      tiles: preset.terrain
        .filter((cell) => cell.terrainId === 'dirt' || cell.terrainId === 'road')
        .map((cell) => ({ tile: cell.terrainId as StarterVillageTileId, x: cell.x, y: cell.y }))
    },
    { id: 'structures', zIndex: 30, tiles: structures },
    { id: 'foreground', zIndex: 40, tiles: foreground }
  ];
}

/** Curated visual layout. Grass is the implicit ground; only the brushes below are stored. */
export const STARTER_VILLAGE_PRESET: WorldCompositionV1 = deepFreeze({
  version: 1,
  scenarioId: 'starter-village',
  placements: [
    { id: 'lab-nw', definitionId: 'laboratory', x: 6, y: 6 },
    { id: 'home-north', definitionId: 'village-home', x: 18, y: 6 },
    { id: 'stable-east', definitionId: 'stable', x: 46, y: 16 },
    { id: 'home-south', definitionId: 'village-home', x: 28, y: 32 },
    { id: 'home-east', definitionId: 'village-home', x: 56, y: 26 },
    ...propRow('tree', 'north-canopy', 2, [2, 5, 8, 12, 16, 22, 26, 32, 36, 42, 48, 54, 58, 62]),
    ...propRow('tree', 'north-canopy-b', 3, [4, 10, 20, 30, 40, 50, 60]),
    ...propColumn('tree', 'west-hedge', 2, [6, 8, 14, 18, 22, 26, 30, 34, 38, 42, 46]),
    ...propColumn('tree', 'east-hedge', 62, [4, 8, 14, 18, 22, 26, 34, 38, 42, 46]),
    ...propRow('tree', 'south-canopy', 46, [6, 12, 18, 24, 36, 44, 56]),
    ...propRow('tree', 'grove', 28, [36, 38, 40]),
    ...propRow('tree', 'grove-b', 30, [35, 37, 41]),
    ...propRow('sign', 'lab-sign', 12, [8]),
    ...propRow('lantern', 'lab-lantern', 12, [10]),
    ...propRow('flowers', 'lab-flowers', 13, [9]),
    ...propRow('shrub', 'lab-shrub', 13, [11]),
    ...propRow('sign', 'north-home-sign', 16, [16]),
    ...propRow('flowers', 'north-home-flowers', 13, [17, 22]),
    ...propRow('crate', 'stable-crate', 22, [47]),
    ...propRow('lantern', 'stable-lantern', 22, [50]),
    ...propRow('rock', 'stable-rock', 23, [48]),
    ...propRow('flowers', 'stable-flowers', 23, [51]),
    ...propRow('rock', 'lake-rock', 36, [34]),
    ...propRow('flowers', 'lake-flowers', 37, [33]),
    ...propRow('shrub', 'lake-shrub', 38, [35]),
    ...propRow('sign', 'south-home-sign', 36, [26]),
    ...propRow('lantern', 'south-home-lantern', 37, [32]),
    ...propRow('fence-post', 'corral-nw', 24, [46]),
    ...propRow('fence-post', 'corral-ne', 24, [52]),
    ...propRow('fence-post', 'corral-sw', 29, [46]),
    ...propRow('fence-post', 'corral-se', 29, [52]),
    ...propRow('fence-horizontal', 'corral-north', 24, [47, 48, 50, 51]),
    ...propRow('fence-horizontal', 'corral-south', 29, [47, 48, 49, 50, 51]),
    ...propColumn('fence-vertical', 'corral-west', 46, [25, 26, 27, 28]),
    ...propColumn('fence-vertical', 'corral-east', 52, [25, 26, 27, 28])
  ],
  terrain: [
    ...terrainRows('training-grass', [
      [12, 4, 10], [13, 3, 12], [14, 4, 11], [15, 5, 13], [16, 6, 12], [17, 7, 10]
    ]),
    ...terrainRows('training-grass', [
      [25, 47, 51], [26, 47, 50], [27, 47, 51], [28, 48, 51]
    ]),
    ...terrainRows('water', [
      [34, 38, 42], [35, 36, 44], [36, 35, 45], [37, 35, 46],
      [38, 36, 46], [39, 37, 45], [40, 38, 43], [41, 39, 41],
      [42, 40, 40], [43, 40, 40], [44, 40, 41], [45, 41, 41]
    ]),
    ...terrainRows('dirt', [
      [11, 4, 58],
      [10, 20, 20],
      [12, 21, 21], [13, 21, 21], [14, 21, 21], [15, 21, 21], [16, 21, 21], [17, 21, 21],
      [18, 21, 21], [19, 21, 21], [20, 21, 21], [21, 21, 21], [22, 21, 21], [23, 21, 21],
      [24, 21, 21], [25, 21, 21], [26, 21, 21], [27, 21, 21], [28, 21, 21], [29, 21, 21],
      [30, 21, 21], [31, 21, 21], [32, 21, 21], [33, 21, 21], [34, 21, 21], [35, 21, 21],
      [36, 21, 30],
      [12, 44, 44], [13, 44, 44], [14, 44, 44], [15, 44, 44], [16, 44, 44], [17, 44, 44],
      [18, 44, 44], [19, 44, 44], [20, 44, 44], [21, 44, 49],
      [12, 61, 61], [13, 61, 61], [14, 61, 61], [15, 61, 61], [16, 61, 61], [17, 61, 61],
      [18, 61, 61], [19, 61, 61], [20, 61, 61], [21, 61, 61], [22, 61, 61], [23, 61, 61],
      [24, 61, 61], [25, 61, 61], [26, 61, 61], [27, 61, 61], [28, 61, 61], [29, 61, 61],
      [30, 58, 61]
    ]),
    ...terrainRows('road', [[11, 59, 62]])
  ]
});

export const STARTER_VILLAGE_SCENARIO: StarterVillageScenario = {
  id: 'starter-village',
  resources: [
    { id: 'starter-village-atlas', url: STARTER_VILLAGE_ATLAS_URL },
    { id: 'starter-village-buildings', url: STARTER_VILLAGE_BUILDINGS_ATLAS_URL },
    ...Object.entries(MONSTER_ROSTER_SHEET_URLS).map(([character, url]) => ({ id: `roster-${character}`, url }))
  ],
  map: {
    columns: STARTER_VILLAGE_COLUMNS,
    rows: STARTER_VILLAGE_ROWS,
    layers: layersFromPreset(STARTER_VILLAGE_PRESET)
  },
  semanticAnchors: STARTER_VILLAGE_ANCHOR_IDS,
  anchorPlacements: {
    professor: { x: 9, y: 11, zIndex: 60 },
    stable: { x: 49, y: 21, zIndex: 60 },
    'training-grass': { x: 8, y: 14, zIndex: 60 },
    'village-idle': { x: 34, y: 13, zIndex: 60 },
    'route-exit': { x: 61, y: 11, zIndex: 60 }
  },
  ambient: {
    title: 'Starter Village',
    mood: 'first-light',
    palette: [0x1c3b2c, 0x2f755b, 0x89bc5f, 0xd99a58, 0xf1db9d]
  }
};

export const STARTER_VILLAGE_ANCHOR_BINDINGS: Readonly<Partial<Record<ScenarioAnchorId, {
  placementId: string;
  localPoint: GridPoint;
}>>> = {
  professor: { placementId: 'lab-nw', localPoint: STARTER_VILLAGE_COMPOSITION_DEFINITION.objects.laboratory.semanticAnchors!.professor },
  stable: { placementId: 'stable-east', localPoint: STARTER_VILLAGE_COMPOSITION_DEFINITION.objects.stable.semanticAnchors!.stable }
};

/** A layout that never leaves the old 24×24 village is the previous map, not an edit of this one. */
export function upgradeStarterVillageLayout(layout: WorldCompositionV1): WorldCompositionV1 {
  if (layout.columns !== undefined || layout.rows !== undefined) return layout;
  const fitsOldMap = layout.placements.every((placement) => placement.x < 24 && placement.y < 24)
    && layout.terrain.every((cell) => cell.x < 24 && cell.y < 24);
  if (fitsOldMap && (STARTER_VILLAGE_COLUMNS > 24 || STARTER_VILLAGE_ROWS > 24)) return STARTER_VILLAGE_PRESET;
  return layout;
}

/** Resolves structure-bound semantic anchors from their stable placement identity. */
export function resolveStarterVillageAnchor(layout: WorldCompositionV1, anchorId: ScenarioAnchorId): GridPoint {
  const binding = STARTER_VILLAGE_ANCHOR_BINDINGS[anchorId];
  if (binding) {
    const placement = layout.placements.find((item) => item.id === binding.placementId);
    if (placement) return resolveRelativePoint(placement, binding.localPoint);
  }
  const fallback = STARTER_VILLAGE_SCENARIO.anchorPlacements[anchorId];
  return { x: fallback.x, y: fallback.y };
}

/** Selects an integral scale from available width. The live village uses displayScaleForViewport instead. */
export function integerScaleForViewport(width: number, _height: number): 1 | 2 | 3 | 4 {
  const mapWidth = STARTER_VILLAGE_COLUMNS * STARTER_VILLAGE_TILE_SIZE;
  if (width >= mapWidth * 4) return 4;
  if (width >= mapWidth * 3) return 3;
  if (width >= mapWidth * 2) return 2;
  return 1;
}

/**
 * Scale that keeps the whole city inside the viewport.
 * An integer from 1 to 4 is used when that integer still fits both axes.
 * A larger city returns a fraction below 1 so the frame shrinks with the zoom
 * and the view does not grow scrollbars.
 */
export function displayScaleForViewport(viewportWidth: number, viewportHeight: number, mapWidth: number, mapHeight: number): number {
  if (!(viewportWidth > 0) || !(viewportHeight > 0) || !(mapWidth > 0) || !(mapHeight > 0)) return 1;
  const fit = Math.min(viewportWidth / mapWidth, viewportHeight / mapHeight);
  const crisp = Math.min(4, Math.floor(fit));
  if (crisp >= 1 && mapWidth * crisp <= viewportWidth && mapHeight * crisp <= viewportHeight) return crisp;
  return fit;
}
