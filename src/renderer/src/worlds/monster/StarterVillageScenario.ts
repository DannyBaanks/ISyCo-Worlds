import starterVillageAtlasUrl from '../../assets/worlds/starter-village/starter-village-atlas.png?url';

export const STARTER_VILLAGE_TILE_SIZE = 16;
export const STARTER_VILLAGE_COLUMNS = 24;
export const STARTER_VILLAGE_ROWS = 16;

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
  resources: readonly { id: 'starter-village-atlas'; url: string }[];
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

function rectangle(tile: StarterVillageTileId, left: number, top: number, width: number, height: number): ScenarioTilePlacement[] {
  return Array.from({ length: width * height }, (_, index) => ({
    tile,
    x: left + (index % width),
    y: top + Math.floor(index / width)
  }));
}

const trainingGrass = [
  ...rectangle('training-grass', 3, 11, 8, 5),
  ...rectangle('training-grass', 16, 10, 4, 4)
];
const waterEdge = rectangle('water', 0, 10, 2, 6);

export const STARTER_VILLAGE_SCENARIO: StarterVillageScenario = {
  id: 'starter-village',
  resources: [{ id: 'starter-village-atlas', url: STARTER_VILLAGE_ATLAS_URL }],
  map: {
    columns: STARTER_VILLAGE_COLUMNS,
    rows: STARTER_VILLAGE_ROWS,
    layers: [
      { id: 'backdrop', zIndex: 0, fill: 'grass', tiles: [] },
      { id: 'terrain', zIndex: 10, tiles: [...trainingGrass, ...waterEdge] },
      {
        id: 'roads',
        zIndex: 20,
        tiles: [
          ...rectangle('dirt', 7, 7, 11, 2),
          ...rectangle('road', 17, 4, 2, 4),
          ...rectangle('road', 18, 3, 5, 2),
          ...rectangle('road', 10, 8, 2, 4)
        ]
      },
      {
        id: 'structures',
        zIndex: 30,
        tiles: [
          { tile: 'guide-house', x: 2, y: 1 },
          { tile: 'stable', x: 16, y: 4 },
          { tile: 'sign', x: 7, y: 6 },
          { tile: 'lantern', x: 8, y: 7 },
          { tile: 'lantern', x: 16, y: 8 },
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
          ...rectangle('shrub', 2, 10, 2, 1),
          ...rectangle('shrub', 11, 11, 1, 4),
          { tile: 'flowers', x: 5, y: 10 },
          { tile: 'flowers', x: 8, y: 15 },
          { tile: 'rock', x: 2, y: 15 },
          { tile: 'rock', x: 21, y: 10 }
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

/** Selects a whole-pixel scene scale; values below 1x retain a scrollable 1x map. */
export function integerScaleForViewport(width: number, height: number): 1 | 2 | 3 | 4 {
  const mapWidth = STARTER_VILLAGE_COLUMNS * STARTER_VILLAGE_TILE_SIZE;
  const mapHeight = STARTER_VILLAGE_ROWS * STARTER_VILLAGE_TILE_SIZE;
  for (const scale of [4, 3, 2] as const) {
    if (width >= mapWidth * scale && height >= mapHeight * scale) return scale;
  }
  return 1;
}
