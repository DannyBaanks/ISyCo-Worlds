# Starter Village Scenario Design

## Intent and scope

`Starter Village` is the first environmental scene for the existing
`monster-trainer` world. It replaces the current card/slot layout with one
original, static, readable village. It tells the beginning of the Monster
Trainer story without changing the authority, roles, tasks, Hive, Harness, or
WorldEngine lifecycle.

The player should be able to identify a guide's laboratory in the northwest,
a creature stable in the east, training grass in the south, and a route out of
the village to the northeast. The scene is a genre homage to early handheld
top-down RPGs, not a recreation of any franchise location, map, character,
or asset.

This phase deliberately excludes pathfinding, autonomous movement, worker
training logic, combat, gyms, evolution, scenario progression, and campaign
frameworks. Workers remain static visual projections at semantic anchors.

## Existing architectural boundary

The existing `WorldEngine` remains the only lifecycle owner:

`VALIDATING -> BOOTSTRAPPING -> MOUNTING -> READY`, with its transactional
candidate staging, finite Office fallback, disposal, and Recovery Surface
unchanged. `Starter Village` is mounted inside the existing
`monster-trainer` world. It does not become a new selectable WorldEngine
world or introduce another loader/lifecycle.

`MonsterTrainerSurface` remains the sole bridge from the live visual
projection to the renderer. The scene renderer accepts props and callbacks;
it never reads or writes Hive, tasks, agents, or config itself.

## Scenario contract (minimum reusable unit)

The scenario is a local, typed data module rather than a framework for
campaigns. It contains only what this first and a future independent scene
need:

```ts
interface MonsterScenario {
  id: 'starter-village';
  resources: readonly ScenarioResource[];
  map: { columns: number; rows: number; layers: readonly ScenarioLayer[] };
  semanticAnchors: readonly ScenarioAnchorId[];
  anchorPlacements: Readonly<Record<ScenarioAnchorId, ScenarioAnchorPlacement>>;
  ambient: { title: string; mood: string; palette: readonly number[] };
}
```

`map.layers` names rendering strata and their tiles/props.
`semanticAnchors` is the stable identity list meaningful to workers or the
guide; it contains no geometry. `anchorPlacements` is the current visual map
implementation that resolves those identities to coordinates and z placement.
Renderer code may consume a placement, but may not spread literal anchor
coordinates through rendering components. Scenario ids and anchor ids are
stable data identifiers, not display labels. A later layout may replace every
coordinate while preserving the semantic-anchor contract.

Required stable anchors:

| Id | Meaning in this phase |
| --- | --- |
| `professor` | Laboratory/guide placement in the northwest. |
| `stable` | Static worker/home placement at the eastern stable. |
| `training-grass` | Southern grass clearing reserved for future training. |
| `village-idle` | Neutral village placement for idle visual agents. |
| `route-exit` | Northeast road boundary pointing to a future scenario. |

Anchors are data only in this slice. There is no state-to-anchor routing
beyond choosing a deterministic static presentation for visible workers.

## Logical map, scale, camera, and pixel policy

The current Monster Trainer renderer has no map grid: it uses procedural
16x16 creature plans, drawn at `CELL = 4`, on a canvas that resizes to its
host. Starter Village therefore uses source-pixel drawing and only integer
display scales; it does not claim pixel-perfect output at a fractional scale.

- **Logical tile:** 16 x 16 source pixels.
- **Map:** 24 x 16 logical tiles (384 x 256 source pixels). It is compact
  enough to display at 2x in the established floor panel while retaining
  separate laboratory, stable, grass, route, and boundary space.
- **Scale:** select the largest fitting scale from the discrete set
  `4x`, `3x`, `2x`, `1x`. Render primitives and placement values stay whole
  source pixels; Pixi uses `roundPixels` and nearest-neighbour/pixelated
  rendering.
- **Viewport policy:** the map is centered at the selected integer scale and
  unused host space receives the deep-ground color. It never stretches on an
  axis or receives a fractional fit transform. When the host cannot display
  even the 1x (384 x 256) map, the scene remains at 1x inside an overflow
  viewport with native scrolling; it does not downscale below 1x or crop the
  scene. Thus the renderer makes no pixel-perfect claim outside integral
  scales.
- **Camera policy:** static overview camera for this scenario. It has no
  panning, following, zoom animation, or stateful movement. A later scenario
  can choose a camera policy without changing WorldEngine.

The scene's reference layout, rendered from back to front, is:

1. deep-ground/backdrop;
2. terrain tiles (grass, dirt, water edge);
3. roads and boundaries;
4. buildings and fixed large props;
5. foreground vegetation/fences/rocks;
6. guide and static workers;
7. worker state markers and interaction labels, when present.

Buildings and props carry an explicit z value supplied by scenario layer
data. Workers render above ground and behind foreground occluders where the
map requires it; their state marker is always above their body. This replaces
the current cards entirely, rather than placing the village behind or around
them.

## Composition

The map is original and intentionally asymmetric, so it does not evoke a
specific existing town:

- **Northwest:** a small, copper-roofed `Guide House`/laboratory with an
  instrument porch, notice board, and garden edge; the `professor` anchor is
  outside its entrance.
- **East:** a timber-roofed stable/creature nursery, hay stack and fenced
  paddock; the `stable` anchor sits within the paddock approach.
- **South:** an open, clearly textured grass/training clearing bounded by
  shrubs and stones; `training-grass` and `village-idle` are distinct points
  here and near the square respectively.
- **Center:** a warm dirt-and-stone road joins laboratory, stable, and the
  southern clearing.
- **Northeast:** the road narrows through a natural gap and leaves the map at
  `route-exit`, visually promising a later scenario.
- **Edges:** trees, bushes, fence runs, flower clusters, stones, water edge,
  lanterns and a small tool crate prevent a floating empty rectangle while
  retaining clear walking/placement spaces for later work.

## Assets, resources, and provenance

The scene receives one original project-owned pixel atlas:

`src/renderer/src/assets/worlds/starter-village/starter-village-atlas.<ext>`

It contains the minimal reusable terrain, road, vegetation, building, fence,
and prop tiles used by the scenario. It is original project art, not a
third-party, generated, franchise, or traced asset. Its repository header and
the project attribution record will identify it as original Munder Worlds
artwork.

The first implementation may use an integer-rect SVG candidate, but that is
not an architectural requirement. It must first load the real atlas through
Pixi with nearest-neighbour and `roundPixels` and be visually inspected. If
Pixi's SVG rasterization produces seams, anti-aliasing, or other artifacts,
the candidate is replaced with an equivalent original PNG atlas. The stable
contract is one original project atlas and its manifest URL, not an SVG file
format.

The URL imported from this asset is a **required resource** in the existing
`monster-trainer` world manifest. The same browser/Pixi resource resolver runs
for dev and packaged builds. The scenario renderer consumes the resolver's
cached texture rather than adding an independent image loader. If that atlas
cannot resolve, the normal `BOOTSTRAPPING` lifecycle error retains the last
READY world or follows the finite fallback policy; it never mounts a partial
village.

All existing `monsterArt.ts` creature plans are original procedural project
art. They may remain as temporary static worker bodies, but no old Monster
Trainer card/pad/slot art survives in the visual scene. Existing Office
tilesets remain outside this work and retain their existing third-party
attribution.

## Rendering and lifecycle

The Monster Trainer Pixi application continues to own exactly one app and one
ticker per mounted scene. It creates a root scene container, builds layers
from `StarterVillageScenario`, renders a complete first frame, then invokes
`onReady`. It has no global ticker/listener/timer. On unmount it removes the
ticker and destroys its app once; on initialization/render failure it reports
the cause through `onRenderFailure` for WorldEngine rollback.

No new resource cache is introduced. The shared resolver is responsible for
loading the atlas before mount, and the scene retrieves that same cached Pixi
asset during rendering.

## Verification

Focused tests will demonstrate:

1. `starter-village` is the registered active Monster Trainer scenario and
   replaces the prior slot layout.
2. Its required atlas appears in Monster Trainer's manifest and resolves in
   both resolver modes.
3. A missing required atlas creates a structured lifecycle failure without
   unmounting a last READY world.
4. All five stable semantic anchor ids exist once and resolve within the map.
5. Repeated scene mount/unmount keeps a single managed ticker/app lifecycle
   and does not create another loader/listener contract.
6. Production build contains the atlas.

Automated tests cannot establish visual taste, real Electron canvas cleanup,
or a real dev-server outage. Those remain explicit manual checks: inspect the
starter village in Electron dev, repeat in packaged output, and force the
atlas to fail in a disposable dev run while another world is READY.
