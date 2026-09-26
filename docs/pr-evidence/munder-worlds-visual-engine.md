# Munder Worlds Visual Engine — Verification Evidence

Base commit: `cbcd810` (docs: plan Munder Worlds visual engine). Six implementation commits followed: `4324bf0c`, `535e29b7`, `1535daa6`, `52af9c45`, `51de0018`, `0600c175`.

## Commands and results

- `npm run typecheck` (tsc across all packages) — PASS, exit 0.
- `npm run test:focused` — PASS: 1089 pass, 0 fail.
- Per-task unit runs during development: `node --test test/world-config.test.cjs`, `world-profiles.test.cjs`, `world-projection.test.cjs`, `world-projection-controller.test.cjs`, `world-registry.test.cjs`, `world-shell.test.cjs`, `monster-trainer-art.test.cjs`, `monster-trainer-world.test.cjs` — all PASS.
- One pre-existing assertion in `test/global-nav.test.cjs:49` expected the literal `<OfficeFloor />` mount; the floor slot now mounts `WorldHost` (which renders OfficeFloor by default). The assertion was updated to the new mount and the suite confirms the rest of its invariants unchanged.

## Supported state mappings (rendered, nothing else)

- Agent status normalizes to `idle | working | waiting | blocked | other`; a task is `awaitsHuman` only while `blocked` with an unanswered, undismissed `humanQA` record.
- Monster Trainer renders four visual states only: idle (circle), working (bar), blocked (triangle), awaitsHuman (diamond). Shapes are distinct, never color-only.

## Intentional omissions

No artifact drops, collaboration, remote nodes, XP, progression, evolution, combat, or external/franchise sprites. A completed task is never rendered as an individual agent's success.

## Profile behavior

- Profiles are keyed by stable `agentId` and stored versioned in `world-profiles.json` under user data (temp-file/rename writes).
- Reading a missing profile derives a deterministic default (`munder-worlds:v1:<agentId>`) in memory and never writes to disk.
- Malformed or truncated `world-profiles.json` returns an empty record and the damaged file is left untouched.
- Only validated `monster-trainer` appearance payloads (variant in the allowlist, 3-integer palette) override the seed default.

## Live feature-gate verification

NOT VERIFIED in this environment: the manual app walkthrough (enable Worlds in Settings, select Monster Trainer, observe real agents, click creature/task, switch back) requires a desktop display and a live hive; the verification host is headless Linux. The gate and fallback paths are covered by automated tests: hosts resolve disabled/unknown selections to Office (`WorldHost` + error boundary), controls write only `{ worldsEnabled, selectedWorld }` through existing config IPC, and locale key parity holds across en/es/zh-CN/ar.

## Rollback

Disable Worlds in Settings or select Office; neither writes runtime/hive/task/agent state nor deletes visual profiles. All World UI sits behind `worldsEnabled` (default false).

## Transactional Runtime Addendum

Implemented after the original visual-engine slice:

- `WorldEngine` owns `VALIDATING`, `BOOTSTRAPPING`, `MOUNTING`, `READY`, and `RECOVERY`, with structured `{ phase, worldId, cause, runtime }` failures.
- `WorldHost` keeps the committed keyed layer mounted while a full-size, invisible candidate surface bootstraps. It makes the candidate visible before scheduling the prior layer's unmount; the engine records that cleanup once through `markDisposed`.
- Registry entries now declare their own surface and resource manifest. Office is the registry-declared fallback, not a host-only rendering branch.
- Browser resource resolution preloads Vite-produced image URLs. The engine receives the same resolver contract in dev and packaged mode; only the resolver's runtime/url inputs differ. A dead Vite server is surfaced as a `BOOTSTRAPPING` error and is never restarted by the renderer.
- The finite policy is tested: target failure retains a valid READY world; without one, Office is attempted once; a failed Office attempt enters Recovery Surface. A failed async renderer gets the same finite fallback path.

### Commands and results (transactional runtime)

- `node --test test/world-engine.test.cjs test/office-world-lifecycle.test.cjs test/monster-trainer-world.test.cjs test/world-shell.test.cjs` — PASS: 20/20.
- `npm run typecheck` — PASS, exit 0.
- `npm run test:focused` — PASS: 1102 pass, 0 fail, 6 skipped (1108 total).
- `npm run build` — PASS. Production output contains the bundled Office assets, including `interiors-*.png` and `office-tileset-*.png`.
- `git diff --check` — PASS.

### Manual checks still required

1. Launch through `npm run dev` with Vite actively running; switch Office -> Monster Trainer -> Office and verify the visual swap is seamless and interactions remain usable.
2. Launch the packaged output; repeat Office/Monster/Office and confirm the bundled assets load through `file:`/packaged URLs.
3. With a safe disposable dev session, stop Vite after Monster is READY, select Office, and verify the active Monster layer remains visible with the structured recovery message rather than a blank/partial Office canvas.

### Design boundary actually used

React has no safe general-purpose API to reparent a live Pixi canvas without remounting it. The implementation therefore uses keyed, full-size, opacity-hidden staging layers in the same host. The candidate's Pixi application is genuinely initialized before it becomes visible; React commits its visibility swap before the retired layer is unmounted in the following layout turn. This is the documented transactional boundary; there is no claim of an OS-level/offscreen renderer transaction.

## Starter Village evidence

- `Starter Village` replaces Monster Trainer's former agent-card slots with one static 24 x 16 scene of 16 x 16 source-pixel tiles. Its layer order is backdrop, terrain, roads, structures, foreground, then guide/workers/markers.
- The scenario preserves five semantic ids independently from the replaceable map geometry: `professor`, `stable`, `training-grass`, `village-idle`, and `route-exit`.
- `starter-village-atlas.svg` is hand-authored original Munder Worlds source-pixel art. It contains the scene's terrain, route, Guide House, stable, vegetation, fence and props; provenance is recorded in `src/renderer/src/assets/ATTRIBUTION.md`. The image-generation candidate was rejected and is not in this repository.
- The Monster Trainer manifest requires the atlas. The existing WorldEngine resource resolver now preloads it through Pixi `Assets`; missing-atlas tests report `BOOTSTRAPPING` and retain the prior READY Office world.
- The renderer selects only 4x, 3x, 2x or 1x scales. A host smaller than the 1x 384 x 256 scene retains a scrollable 1x viewport rather than using a fractional scale.

### Commands and results (Starter Village)

- `node --test test/world-engine.test.cjs test/world-registry.test.cjs test/starter-village-scenario.test.cjs test/monster-trainer-world.test.cjs test/world-shell.test.cjs` — PASS: 25/25.
- `npm run typecheck` — PASS, exit 0.
- `npm run test:focused` — PASS: 1108 pass, 0 fail, 6 skipped (1114 total).
- `npm run build` — PASS. Production output contains `starter-village-atlas-B9oMm7Uv.svg`.
- `git diff --check` — PASS.

### SVG witness status

MANUAL_PENDING: this verification host exposes no Electron/native display surface, so the real Pixi SVG rasterization could not be inspected at reachable integer scales. The SVG is packaged and loaded through Pixi `Assets`, but seams/anti-aliasing are not declared visually demonstrated. If a live Electron witness finds artifacts, replace it with an equivalent original PNG atlas and keep the same scenario/manifest contract.
