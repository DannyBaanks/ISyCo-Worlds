import starterVillageAtlasUrl from '../../assets/worlds/starter-village/starter-village-atlas.png?url';
import starterVillageBuildingsUrl from '../../assets/worlds/starter-village/starter-village-buildings.png?url';
import type { CompositionScenarioDefinition } from '@shared/worldComposition';

export const STARTER_VILLAGE_TILE_SIZE = 16;
export const STARTER_VILLAGE_COLUMNS = 24;
export const STARTER_VILLAGE_ROWS = 24;

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
  resources: readonly { id: 'starter-village-atlas' | 'starter-village-buildings'; url: string }[];
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

function rectangle(tile: StarterVillageTileId, left: number, top: number, width: number, height: number): ScenarioTilePlacement[] {
  return Array.from({ length: width * height }, (_, index) => ({
    tile,
    x: left + (index % width),
    y: top + Math.floor(index / width)
  }));
}

const trainingGrass = [
  ...rectangle('training-grass', 4, 11, 6, 8),
  ...rectangle('training-grass', 16, 10, 4, 4)
];
const lakeAndRiver: ScenarioTilePlacement[] = [
  ...rectangle('water', 12, 13, 2, 1),
  ...rectangle('water', 11, 14, 4, 1),
  ...rectangle('water', 10, 15, 6, 3),
  ...rectangle('water', 11, 18, 4, 1),
  ...rectangle('water', 12, 19, 2, 1),
  ...rectangle('water', 12, 20, 1, 3)
];

export const STARTER_VILLAGE_SCENARIO: StarterVillageScenario = {
  id: 'starter-village',
  resources: [
    { id: 'starter-village-atlas', url: STARTER_VILLAGE_ATLAS_URL },
    { id: 'starter-village-buildings', url: STARTER_VILLAGE_BUILDINGS_ATLAS_URL }
  ],
  map: {
    columns: STARTER_VILLAGE_COLUMNS,
    rows: STARTER_VILLAGE_ROWS,
    layers: [
      { id: 'backdrop', zIndex: 0, fill: 'grass', tiles: [] },
      { id: 'terrain', zIndex: 10, tiles: [...trainingGrass, ...lakeAndRiver] },
      {
        id: 'roads',
        zIndex: 20,
        tiles: [
          ...rectangle('dirt', 7, 7, 11, 2),
          ...rectangle('road', 17, 4, 2, 4),
          ...rectangle('road', 18, 3, 5, 2),
          ...rectangle('road', 10, 8, 2, 6),
          ...rectangle('dirt', 4, 20, 7, 1)
        ]
      },
      {
        id: 'structures',
        zIndex: 30,
        tiles: [
          { tile: 'guide-house', x: 2, y: 1 },
          { tile: 'stable', x: 16, y: 4 },
          { tile: 'guide-house', x: 0, y: 18 },
          { tile: 'sign', x: 7, y: 6 },
          { tile: 'lantern', x: 8, y: 7 },
          { tile: 'lantern', x: 16, y: 8 },
          { tile: 'sign', x: 6, y: 18 },
          { tile: 'lantern', x: 9, y: 19 },
          { tile: 'crate', x: 21, y: 8 },
          ...rectangle('fence-horizontal', 16, 9, 4, 1),
          ...rectangle('fence-horizontal', 16, 14, 4, 1),
          ...rectangle('fence-vertical', 15, 10, 1, 4),
          ...rectangle('fence-vertical', 20, 10, 1, 4),
          { tile: 'fence-post', x: 15, y: 9 },
          { tile: 'fence-post', x: 20, y: 9 },
          { tile: 'fence-post', x: 15, y: 14 },
          { tile: 'fence-post', x: 20, y: 14 }
        ]
      },
      {
        id: 'foreground',
        zIndex: 40,
        tiles: [
          ...rectangle('tree', 0, 0, 2, 5),
          ...rectangle('tree', 22, 0, 2, 7),
          ...rectangle('tree', 22, 10, 2, 3),
          ...rectangle('shrub', 2, 10, 2, 1),
          ...rectangle('shrub', 11, 11, 1, 4),
          { tile: 'flowers', x: 5, y: 10 },
          { tile: 'flowers', x: 8, y: 15 },
          { tile: 'flowers', x: 7, y: 19 },
          { tile: 'rock', x: 2, y: 15 },
          { tile: 'rock', x: 21, y: 10 },
          { tile: 'rock', x: 10, y: 19 },
          { tile: 'shrub', x: 15, y: 20 }
        ]
      }
    ]
  },
  semanticAnchors: STARTER_VILLAGE_ANCHOR_IDS,
  anchorPlacements: {
    professor: { x: 5, y: 6, zIndex: 60 },
    stable: { x: 18, y: 9, zIndex: 60 },
    'training-grass': { x: 6, y: 13, zIndex: 60 },
    'village-idle': { x: 12, y: 9, zIndex: 60 },
    'route-exit': { x: 22, y: 3, zIndex: 60 }
  },
  ambient: {
    title: 'Starter Village',
    mood: 'first-light',
    palette: [0x132532, 0x2f755b, 0x89bc5f, 0xd99a58, 0xf1db9d]
  }
};

/** Selects an integral scale from available width; extra map height scrolls instead of shrinking the art. */
export function integerScaleForViewport(width: number, _height: number): 1 | 2 | 3 | 4 {
  const mapWidth = STARTER_VILLAGE_COLUMNS * STARTER_VILLAGE_TILE_SIZE;
  if (width >= mapWidth * 4) return 4;
  if (width >= mapWidth * 3) return 3;
  if (width >= mapWidth * 2) return 2;
  return 1;
}
