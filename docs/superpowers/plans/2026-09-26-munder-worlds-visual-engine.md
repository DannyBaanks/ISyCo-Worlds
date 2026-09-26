# Munder Worlds Visual Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a feature-gated visual-world engine with agent-keyed visual identities and a small, real-state-driven Monster Trainer canvas while preserving the Office renderer.

**Architecture:** New worlds consume a renderer-side canonical projection of the existing Zustand agent roster plus the hive task ledger; they never write operational state. A dedicated main-process identity repository persists versioned profiles by `agentId`, while a registry/host keeps Office as the fallback. The first non-Office world renders original procedural Pixi creatures from identity seeds and supported state only.

**Tech Stack:** Electron 32, React 18, TypeScript, PixiJS 8, Zustand 4, Electron preload IPC, Node `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-26-munder-worlds-visual-engine-design.md`

## Global Constraints

- Keep `OfficeFloor`, hive state, task mutation, hooks, leases, bridges, permissions, and `avatar-overrides.json` behavior unchanged.
- Add no frontend state library, game engine, external sprite asset, or backend event protocol.
- Worlds are disabled by default; Office remains the default and recoverable fallback.
- Visual profiles are keyed by stable `agentId`; no display-name or Office-slot identity lookup is allowed.
- A read or deterministic fallback profile must never write user data.
- A completed task is not evidence that an individual agent succeeded; render only the statuses present in the canonical snapshot.
- A non-Office world consumes snapshot, identity resolver, and callbacks only; it must not import the hive bridge or Zustand store directly.
- Every new production function is implemented test-first; run `npm run typecheck` and `npm run test:focused` before declaring the branch complete.

## Review Focus

- Malformed or truncated `world-profiles.json` yields safe defaults and never rewrites the damaged file. Task 2 owns this test.
- An unanswered human question maps to `awaitsHuman` only when its task is `blocked`; a completed or dismissed question cannot show an approval gate. Task 3 owns this test.
- Equal snapshots yield no transition, preventing duplicated effects on the poll loop. Task 3 owns this test.
- Rendering an agent with no profile never persists a generated default profile. Task 2 owns this test.
- A disabled or failed Monster renderer preserves Office and never changes hive/task state. Task 5 owns the host test; Task 6 wires the real renderer into that host.

### Task 1: Shared World IDs and Feature Configuration

**Files:**
- Create: `src/shared/worlds.ts`
- Modify: `src/main/config.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/store/config.ts`
- Test: `test/world-config.test.cjs`

**Interfaces:**
- Produces `WorldId = 'office' | 'monster-trainer'`, `WORLD_IDS`, and `isWorldId(value: unknown): value is WorldId`.
- Produces optional `worldsEnabled?: boolean` and `selectedWorld?: WorldId` at every `HarnessConfig` boundary.

- [ ] **Step 1: Write the failing test**

Create `test/world-config.test.cjs`. Load `src/shared/worlds.ts` through `test/load-ts.cjs`; assert only the two known ids validate. Mock Electron user data as in `test/config-write-notify.test.cjs`; assert a fresh `readConfig()` exposes `worldsEnabled === false` and `selectedWorld === 'office'`, and a write of `{ worldsEnabled: true, selectedWorld: 'monster-trainer' }` round-trips.

- [ ] **Step 2: Verify RED**

Run `node --test test/world-config.test.cjs`. Expect a missing module/export/default failure.

- [ ] **Step 3: Implement the shared config contract**

Create `src/shared/worlds.ts`. Add fields/defaults to main config and mirror them in preload and renderer config. On an invalid stored selected-world value, read `office`; never pass arbitrary ids to renderers.

- [ ] **Step 4: Verify GREEN**

Run `node --test test/world-config.test.cjs && npm run typecheck`. Expect PASS.

- [ ] **Step 5: Commit**

Run `git add src/shared/worlds.ts src/main/config.ts src/preload/index.ts src/renderer/src/store/config.ts test/world-config.test.cjs && git commit -m "feat(worlds): add feature configuration contract"`.

### Task 2: Versioned Visual Identity Repository

**Files:**
- Create: `src/shared/worldProfiles.ts`
- Create: `src/main/worldProfiles.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Test: `test/world-profiles.test.cjs`

**Interfaces:**
- Consumes `WorldId` and Electron `app.getPath('userData')`.
- Produces shared `VisualIdentityProfileV1`, `WorldProfilesFileV1`, and structural validation from `src/shared/worldProfiles.ts`; main produces `readWorldProfiles()`, `profileForAgent(profiles, agentId)`, and validated `saveWorldProfile(profile)`.
- Produces read-only `window.cth.worldProfiles(): Promise<Record<string, VisualIdentityProfileV1>>`.

- [ ] **Step 1: Write the failing test**

Create `test/world-profiles.test.cjs` with mocked Electron user data. Assert the shared profile contract rejects invalid fields; the same valid `agentId` gets the same default seed; reading it creates no file; a saved profile round-trips without affecting a second agent; malformed JSON returns an empty record without rewriting it; and an empty id, a non-1 version, or non-object `appearances` is rejected.

- [ ] **Step 2: Verify RED**

Run `node --test test/world-profiles.test.cjs`. Expect a missing `worldProfiles` module failure.

- [ ] **Step 3: Implement repository and bridge**

Store `{ version: 1, profiles }` in `world-profiles.json` under user data with temp-file/rename writes. Validate/deep-copy valid records and preserve unknown values only inside a valid world-keyed `appearances` object. Derive defaults as `munder-worlds:v1:${agentId}` without writing. Register `worlds:getProfiles` in main and expose `worldProfiles()` in preload; do not expose writes to arbitrary renderer callers.

- [ ] **Step 4: Verify GREEN**

Run `node --test test/world-profiles.test.cjs && npm run typecheck`. Expect PASS.

- [ ] **Step 5: Commit**

Run `git add src/shared/worldProfiles.ts src/main/worldProfiles.ts src/main/index.ts src/preload/index.ts test/world-profiles.test.cjs && git commit -m "feat(worlds): add agent visual identity repository"`.

### Task 3: Pure Canonical Projection and Transitions

**Files:**
- Create: `src/renderer/src/worlds/worldProjection.ts`
- Test: `test/world-projection.test.cjs`

**Interfaces:**
- Produces `CanonicalWorldSnapshot`, `WorldAgent`, `WorldTask`, `normalizeWorldSnapshot(agents, rawTasks)`, and `deriveVisualTransitions(previous, next)`.
- Has no dependency on Zustand, preload IPC, or UI components.

- [ ] **Step 1: Write the failing test**

Create `test/world-projection.test.cjs` through `test/load-ts.cjs`. Assert agent status normalization to `idle | working | waiting | blocked | other`; safe malformed task handling; `awaitsHuman` only for a blocked task with unanswered, undismissed `humanQA`; false for a done task; and no transitions for equal snapshots.

- [ ] **Step 2: Verify RED**

Run `node --test test/world-projection.test.cjs`. Expect a missing module failure.

- [ ] **Step 3: Implement pure normalization and diffing**

Keep normalized arrays immutable and stably sorted by id. Use only ledger evidence: id, title, assignee, status, humanQA. Emit transitions only for additions/removals, normalized state changes, assignee changes, or `awaitsHuman` changes. Never derive success, artifacts, collaboration, remote nodes, or XP.

- [ ] **Step 4: Verify GREEN**

Run `node --test test/world-projection.test.cjs && npm run typecheck`. Expect PASS.

- [ ] **Step 5: Commit**

Run `git add src/renderer/src/worlds/worldProjection.ts test/world-projection.test.cjs && git commit -m "feat(worlds): add canonical visual projection"`.

### Task 4: Live Projection Controller and Identity Resolver

**Files:**
- Create: `src/renderer/src/worlds/identityResolver.ts`
- Create: `src/renderer/src/worlds/useWorldProjection.ts`
- Test: `test/world-projection-controller.test.cjs`

**Interfaces:**
- Consumes the pure projection, `window.cth.hiveTasks()`, `window.cth.worldProfiles()`, and Zustand.
- Produces `useWorldProjection(): { snapshot; transitions; identityFor(agentId) }` for a world host to pass down as props.

- [ ] **Step 1: Write the failing test**

Create `test/world-projection-controller.test.cjs`. Assert a stored profile wins, an unknown agent derives the expected default without a persistence call, and profiles cannot leak across ids. Add source assertions that the hook has one `hiveTasks` interval, clears it, subscribes to Zustand, and never calls a profile write.

- [ ] **Step 2: Verify RED**

Run `node --test test/world-projection-controller.test.cjs`. Expect missing module failures.

- [ ] **Step 3: Implement the controller**

Implement the resolver as map lookup plus deterministic fallback. On mount fetch profiles once, poll tasks immediately and then every 5 seconds, subscribe to agent-store changes, retain the last valid snapshot on task-read failure, and clean every timer/subscription. Calculate transitions only after normalizing a fresh successful snapshot. The hook may not write config, profiles, tasks, or agents.

- [ ] **Step 4: Verify GREEN**

Run `node --test test/world-projection-controller.test.cjs && npm run typecheck`. Expect PASS.

- [ ] **Step 5: Commit**

Run `git add src/renderer/src/worlds/identityResolver.ts src/renderer/src/worlds/useWorldProjection.ts test/world-projection-controller.test.cjs && git commit -m "feat(worlds): connect projection to live state"`.

### Task 5: Registry, Office Fallback Host, and Controls

**Files:**
- Create: `src/renderer/src/worlds/worldRegistry.ts`
- Create: `src/renderer/src/worlds/WorldHost.tsx`
- Create: `src/renderer/src/components/WorldSelector.tsx`
- Create: `src/renderer/src/components/WorldsSettings.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/components/SettingsModal.tsx`
- Modify: `src/renderer/src/i18n/locales/en.json`
- Modify: `src/renderer/src/i18n/locales/es.json`
- Modify: `src/renderer/src/i18n/locales/zh-CN.json`
- Modify: `src/renderer/src/i18n/locales/ar.json`
- Test: `test/world-registry.test.cjs`
- Test: `test/world-shell.test.cjs`

**Interfaces:**
- Produces pure `WORLD_REGISTRY` and `worldById(id)`.
- Produces controls that write only `{ worldsEnabled, selectedWorld }` through existing config IPC.
- Reserves the experimental Monster Trainer registry entry; until Task 6 wires its renderer, the host resolves that selection safely back to Office.

- [ ] **Step 1: Write failing registry/shell tests**

Create `test/world-registry.test.cjs` to assert stable ids, Office default, and unknown-id fallback. Create `test/world-shell.test.cjs` to assert `App` mounts `WorldHost` in the current floor slot while retaining `MemoryPanel`, sidebar, and `AgentStrip`; selector/settings only update Worlds fields; and locale key sets match in all four languages.

- [ ] **Step 2: Verify RED**

Run `node --test test/world-registry.test.cjs test/world-shell.test.cjs`. Expect missing registry/host/control failures.

- [ ] **Step 3: Implement registry and user controls**

Create registry entries for Office and experimental Monster Trainer. Add a non-destructive Worlds toggle in General settings and a title-bar selector only while Worlds is enabled. Persist selection with `updateConfig`; disabling Worlds preserves the saved choice but makes the host render Office. Add matching translations.

- [ ] **Step 4: Implement the fallback host**

Replace the unconditional `<OfficeFloor />` with `WorldHost`. When disabled, selected id invalid, or a non-Office renderer throws, render Office and show a recoverable return-to-Office action. It may update only visual selection preference, never hive/agent/task data.

- [ ] **Step 5: Verify GREEN**

Run `node --test test/world-registry.test.cjs test/world-shell.test.cjs && npm run typecheck`. Expect PASS.

- [ ] **Step 6: Commit**

Run `git add src/renderer/src/worlds/worldRegistry.ts src/renderer/src/worlds/WorldHost.tsx src/renderer/src/components/WorldSelector.tsx src/renderer/src/components/WorldsSettings.tsx src/renderer/src/App.tsx src/renderer/src/components/SettingsModal.tsx src/renderer/src/i18n/locales/en.json src/renderer/src/i18n/locales/es.json src/renderer/src/i18n/locales/zh-CN.json src/renderer/src/i18n/locales/ar.json test/world-registry.test.cjs test/world-shell.test.cjs && git commit -m "feat(worlds): add registry and Office fallback host"`.

### Task 6: Monster Trainer Canvas and Original Procedural Creatures

**Files:**
- Create: `src/renderer/src/worlds/monster/monsterArt.ts`
- Create: `src/renderer/src/worlds/monster/MonsterTrainerWorld.tsx`
- Create: `src/renderer/src/worlds/monster/MonsterTrainerSurface.tsx`
- Modify: `src/renderer/src/worlds/worldRegistry.ts`
- Modify: `src/renderer/src/worlds/WorldHost.tsx`
- Test: `test/monster-trainer-art.test.cjs`
- Test: `test/monster-trainer-world.test.cjs`

**Interfaces:**
- Consumes snapshot, visual identity, Pixi primitives, and selection callbacks from `WorldHost`.
- Produces deterministic original creature art, a `MonsterTrainerSurface` that owns the projection hook, and a self-contained Pixi lifecycle component that receives only props.

- [ ] **Step 1: Write failing art/component tests**

Create `test/monster-trainer-art.test.cjs`: same seed/appearance gives equal primitives, differing seeds choose valid variants/palettes, every coordinate is whole-pixel, and each supported state has a distinct non-color-only marker. Create `test/monster-trainer-world.test.cjs`: source checks enforce Pixi cleanup and at-most-two non-archived agents in `MonsterTrainerWorld`, callbacks rather than operational imports there, and use of the projection hook only in `MonsterTrainerSurface`.

- [ ] **Step 2: Verify RED**

Run `node --test test/monster-trainer-art.test.cjs test/monster-trainer-world.test.cjs`. Expect missing module failures.

- [ ] **Step 3: Implement deterministic creature art**

Use bounded palette and original Pixi `Graphics` rectangles only; import no images or franchise references. Derive variant/palette from profile seed. Permit only validated `appearances['monster-trainer']` palette/variant overrides. Add distinct shapes/icons for idle, working, blocked, and awaiting-human, plus static reduced-motion rendering.

- [ ] **Step 4: Implement canvas lifecycle and interaction**

Implement `MonsterTrainerSurface` to obtain the live projection/identity resolver and convert it to renderer props. Mount one Pixi application/ticker in `MonsterTrainerWorld`, use nearest-pixel rendering, and fully destroy it on unmount. Draw a compact region, real task markers, and at most two non-archived agents. Creature click calls `onAgentSelect`; task click calls `onTaskOpen`; unknown profiles/tasks use safe placeholders. Transitions drive only short effects. Update `WorldHost` to render this surface for the registered Monster world.

- [ ] **Step 5: Verify GREEN**

Run `node --test test/monster-trainer-art.test.cjs test/monster-trainer-world.test.cjs && npm run typecheck`. Expect PASS.

- [ ] **Step 6: Commit**

Run `git add src/renderer/src/worlds/monster/monsterArt.ts src/renderer/src/worlds/monster/MonsterTrainerWorld.tsx src/renderer/src/worlds/monster/MonsterTrainerSurface.tsx src/renderer/src/worlds/worldRegistry.ts src/renderer/src/worlds/WorldHost.tsx test/monster-trainer-art.test.cjs test/monster-trainer-world.test.cjs && git commit -m "feat(worlds): add Monster Trainer visual slice"`.

### Task 7: Regression Verification and Evidence

**Files:**
- Create: `docs/pr-evidence/munder-worlds-visual-engine.md`
- Modify: `docs/superpowers/specs/2026-09-26-munder-worlds-visual-engine-design.md` only for an evidence-backed contract correction.

- [ ] **Step 1: Run complete automated verification**

Run `npm run typecheck && npm run test:focused`. Expect PASS; record any unrelated existing failure by exact test name/output.

- [ ] **Step 2: Verify the live feature gates**

Run the development app. Check: Worlds disabled retains Office; enable Worlds in Settings; choose Monster Trainer; observe one or two real agents; exercise idle, working, blocked, and awaiting-human from actual state; click creature/task; switch back to Office; reload; confirm no hive/task/agent change.

- [ ] **Step 3: Record evidence and rollback**

Create evidence with base commit, commands/results, screenshots if generated, supported mappings, intentional omissions (artifacts, collaboration, remote nodes, XP/evolution), profile behavior, and rollback: disable Worlds or choose Office.

- [ ] **Step 4: Final verify and commit**

Run `git diff --check && npm run typecheck && npm run test:focused`, then run `git add docs/pr-evidence/munder-worlds-visual-engine.md docs/superpowers/specs/2026-09-26-munder-worlds-visual-engine-design.md && git commit -m "docs: record Munder Worlds verification"`. Expect no whitespace errors and all checks PASS.
