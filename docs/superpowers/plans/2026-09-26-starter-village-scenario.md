# Starter Village Scenario Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Monster Trainer's card layout with an original, pixel-perfect Starter Village scene whose static semantic anchors are ready for future behavior.

**Architecture:** A local `StarterVillageScenario` data module supplies map layers, a semantic identity list, replaceable anchor placements, ambient metadata, and its atlas resource. The existing Monster Trainer Pixi app builds the stage from that scenario and the existing WorldEngine preloads the atlas through its shared resolver; no new world lifecycle or Hive bridge is introduced.

**Tech Stack:** React, TypeScript, PixiJS 8, Electron Vite, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-26-starter-village-scenario-design.md`

## Global Constraints

- Preserve the existing WorldEngine lifecycle, transactional swap, finite fallback, and Recovery Surface.
- Do not modify Hive, Harness, agent/task authority, Office, movement, pathfinding, training, evolution, campaigns, or gym behavior.
- Use only original project artwork; no Pokémon/Nintendo/Game Freak or third-party Monster Trainer assets.
- Logical map: 24 x 16 tiles; source tile: 16 x 16 pixels; select only `4x`, `3x`, `2x`, or `1x` scales.
- Below a 1x host, retain a 1x scene in a native-overflow viewport; never claim fractional pixel-perfect fit.
- Semantic anchor identity (`semanticAnchors`) must remain distinct from coordinate implementation (`anchorPlacements`).
- Add no global ticker, listener, timer, or duplicate scene asset loader.

## Review Focus

- A host that fits only 1x or is smaller than 384 x 256 remains integer-scaled and exposes the complete scene through overflow; Task 3 adds scale-policy tests.
- A missing Starter Village atlas becomes a structured `BOOTSTRAPPING` failure without removing a prior READY world; Task 2 adds an engine-manifest failure test.
- Any changed anchor coordinate leaves the five stable semantic ids intact; Task 1 validates both identity and bounded placement data.
- Repeated mount/unmount releases the Pixi app/ticker and does not create a second asset load route; Task 3 extends lifecycle checks.
- Production bundling emits the real selected atlas; Task 4 checks the produced renderer assets after `npm run build`.

---

### Task 1: Author the scenario data and original atlas candidate

**Files:**
- Create: `src/renderer/src/worlds/monster/StarterVillageScenario.ts`
- Create: `src/renderer/src/assets/worlds/starter-village/starter-village-atlas.svg`
- Modify: `src/renderer/src/assets/ATTRIBUTION.md`
- Create: `test/starter-village-scenario.test.cjs`

**Interfaces:**
- Produces: `STARTER_VILLAGE_SCENARIO`, `STARTER_VILLAGE_ANCHOR_IDS`, `ScenarioAnchorId`, `integerScaleForViewport(width, height): 1 | 2 | 3 | 4`.
- Consumed by: Task 2's world manifest and Task 3's Pixi scene builder.

- [ ] **Step 1: Write the failing scenario-data tests**

Assert the exported scenario has id `starter-village`, a `24 x 16` map, the exactly five required semantic ids, independent `anchorPlacements` with in-bounds positions, stable ordered layers, and original-atlas provenance. Assert `integerScaleForViewport` selects only 4/3/2/1 and returns 1 for a smaller-than-map host.

- [ ] **Step 2: Run the focused scenario test to verify it fails**

Run: `node --test test/starter-village-scenario.test.cjs`

Expected: FAIL because the scenario and atlas do not exist.

- [ ] **Step 3: Implement the scenario data and original atlas candidate**

Author the small reusable terrain/road/building/vegetation/prop atlas as integer-aligned original source pixels and record project provenance. Define semantic ids separately from the map's `anchorPlacements`; keep all geometry in scenario data. Implement the discrete scale chooser without fractional output.

- [ ] **Step 4: Run the focused scenario test to verify it passes**

Run: `node --test test/starter-village-scenario.test.cjs`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add src/renderer/src/worlds/monster/StarterVillageScenario.ts src/renderer/src/assets/worlds/starter-village/starter-village-atlas.svg src/renderer/src/assets/ATTRIBUTION.md test/starter-village-scenario.test.cjs && git commit -m "feat(worlds): define starter village scenario"`

### Task 2: Put the atlas on the existing WorldEngine resource path

**Files:**
- Modify: `src/renderer/src/worlds/WorldRuntimeSurface.tsx`
- Modify: `src/renderer/src/worlds/worldRegistry.ts`
- Modify: `test/world-engine.test.cjs`
- Modify: `test/world-registry.test.cjs`

**Interfaces:**
- Consumes: `STARTER_VILLAGE_SCENARIO.resources` and its atlas URL from Task 1.
- Produces: a Pixi-cached `WorldResourceResolver` path used equally by dev and packaged runtime, and the `monster-trainer` required-resource manifest entry.
- Consumed by: Task 3's scene builder, which reads the cached atlas rather than loading it separately.

- [ ] **Step 1: Write failing manifest and lifecycle tests**

Extend the registry test to prove Monster Trainer's real manifest contains the Starter Village atlas URL. Extend the engine test with the real required resource id: a failing resolver must expose a structured `BOOTSTRAPPING` error and retain the active READY Office mount.

- [ ] **Step 2: Run the affected tests to verify they fail**

Run: `node --test test/world-engine.test.cjs test/world-registry.test.cjs`

Expected: FAIL because Monster Trainer has no Starter Village resource.

- [ ] **Step 3: Implement shared Pixi resource resolution and manifest registration**

Make the browser resolver use Pixi's existing asset cache for preload. Register only the scenario resource in Monster Trainer's existing world definition; do not branch in `WorldHost`. Preserve dev/package classification and make the scene retrieve the cached asset by URL.

- [ ] **Step 4: Run the affected tests to verify they pass**

Run: `node --test test/world-engine.test.cjs test/world-registry.test.cjs`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add src/renderer/src/worlds/WorldRuntimeSurface.tsx src/renderer/src/worlds/worldRegistry.ts test/world-engine.test.cjs test/world-registry.test.cjs && git commit -m "feat(worlds): bootstrap starter village atlas"`

### Task 3: Render Starter Village as the Monster Trainer surface

**Files:**
- Create: `src/renderer/src/worlds/monster/StarterVillageScene.ts`
- Modify: `src/renderer/src/worlds/monster/MonsterTrainerWorld.tsx`
- Modify: `test/monster-trainer-world.test.cjs`
- Modify: `test/world-shell.test.cjs`

**Interfaces:**
- Consumes: `STARTER_VILLAGE_SCENARIO`, the Pixi-cached atlas from Task 2, props-only snapshot/identity callbacks, and `integerScaleForViewport` from Task 1.
- Produces: `buildStarterVillageScene(options): Container` and a single managed Pixi lifecycle that reports READY only after its whole first frame.

- [ ] **Step 1: Write failing scene and lifecycle tests**

Assert the old `drawSlot`/slot-card structure is absent from Monster Trainer, the scene builder consumes scenario layers and the cached atlas, static workers resolve semantic anchor ids instead of renderer literals, source-pixel scale is integer-only with overflow below 1x, and unmount retains one ticker/app disposal path.

- [ ] **Step 2: Run the focused renderer tests to verify they fail**

Run: `node --test test/starter-village-scenario.test.cjs test/monster-trainer-world.test.cjs test/world-shell.test.cjs`

Expected: FAIL because the current renderer still draws slots.

- [ ] **Step 3: Implement the layered Pixi scene and static worker projection**

Build terrain through foreground layers from scenario map and atlas frames. Use explicit display order/z ordering, position guide/worker placeholders only by semantic-anchor lookups, preserve selection/task callbacks, and set atlas texture scaling to nearest-neighbour. Wrap the canvas in the integer-scale/overflow viewport; attach a scoped `ResizeObserver` only if needed and disconnect it during cleanup. Keep guarded ticker/lifecycle/error callbacks, but remove the card/pad drawing path.

- [ ] **Step 4: Run the focused renderer tests to verify they pass**

Run: `node --test test/starter-village-scenario.test.cjs test/monster-trainer-world.test.cjs test/world-shell.test.cjs`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add src/renderer/src/worlds/monster/StarterVillageScene.ts src/renderer/src/worlds/monster/MonsterTrainerWorld.tsx test/starter-village-scenario.test.cjs test/monster-trainer-world.test.cjs test/world-shell.test.cjs && git commit -m "feat(worlds): render starter village scene"`

### Task 4: Verify the real atlas format and production output

**Files:**
- Modify: `docs/pr-evidence/munder-worlds-visual-engine.md`
- Modify: `docs/superpowers/specs/2026-09-26-starter-village-scenario-design.md` only if SVG witness requires PNG fallback.
- Modify/Create: the selected original atlas only if the SVG witness demonstrably has Pixi raster artifacts.

**Interfaces:**
- Consumes: mounted Task 3 scene and the production build output.
- Produces: evidence of the actual atlas format and a manual-visual status that does not overclaim.

- [ ] **Step 1: Perform the real Pixi atlas witness before finalizing format**

Launch Electron dev where display access permits, enter Monster Trainer, and inspect the actual SVG atlas at each reachable integer scale. Check for seams and anti-aliasing. If artifacts exist, write a same-layout original PNG atlas, update the scenario resource URL, rerun Tasks 1–3 focused tests, and record the format decision. If display access is unavailable, leave SVG as a candidate and mark the witness manual-pending; do not claim it was visually verified.

- [ ] **Step 2: Run final automated verification**

Run: `node --test test/world-engine.test.cjs test/world-registry.test.cjs test/starter-village-scenario.test.cjs test/monster-trainer-world.test.cjs test/world-shell.test.cjs && npm run typecheck && npm run test:focused && npm run build && git diff --check`

Expected: all commands exit 0; build output includes the selected Starter Village atlas.

- [ ] **Step 3: Record evidence and commit**

Document exact command outcomes, the selected atlas provenance/format, automated guarantees, and manual visual gaps.

Run: `git add docs/pr-evidence/munder-worlds-visual-engine.md docs/superpowers/specs/2026-09-26-starter-village-scenario-design.md src/renderer/src/assets/worlds/starter-village && git commit -m "docs(worlds): verify starter village scene"`

## Self-review

- **Coverage:** Task 1 owns scenario, anchors, scales, atlas provenance; Task 2 owns lifecycle/manifest contract and resource failure; Task 3 owns card replacement with the static scene and cleanup; Task 4 owns actual Pixi-format witness, bundle, and evidence.
- **Consistency:** `STARTER_VILLAGE_SCENARIO`, `semanticAnchors`, `anchorPlacements`, `integerScaleForViewport`, and the atlas URL are produced in Task 1 and consumed consistently by Tasks 2–3.
- **Review focus:** each listed host/failure/identity/lifecycle/bundle condition is assigned to an explicit task and test or manual witness.
- **Proportion:** the plan creates one local scenario contract and one scene builder; it deliberately introduces no campaign, map editor, movement, or generic scenario framework.
