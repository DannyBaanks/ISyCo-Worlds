# Worlds Global Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Worlds into a dedicated global tab with one live world renderer at a time, while preserving the existing semantic Munder session.

**Architecture:** `App` owns a persisted global visual route; `WorldsView` owns catalog selection and the only alternate-world `WorldHost`. The WorldEngine retains shared manifest/resource/error policy but serializes renderer handoff: preload before release, dispose one Pixi surface, then mount one candidate. Hive and Zustand remain the sole source of agents, tasks, terminals, and selection.

**Tech Stack:** Electron, React 18, TypeScript, PixiJS 8, Vite, Node's built-in test runner.

**Spec:** `docs/superpowers/specs/2026-09-26-worlds-global-surface-design.md`

## Global Constraints

- Worlds is enabled only by the existing `worldsEnabled` preference.
- `selectedWorld` and the persisted global route are visual preferences, never operational facts.
- Office, Marketplace, sidebar, Command Center, agent strip, Hive, PTYs, tasks, agents, and visual identities retain their existing authority.
- Exactly one Pixi world renderer may be mounted during a world handoff; normal selection must not call `window.location.reload()`.
- Retain structured lifecycle errors and a finite Office/recovery policy; no retry loops.
- Do not add art, movement, training, progression, campaigns, a router library, or unrelated refactors.
- All renderer CSP changes keep `script-src 'self'`; only self-hosted `blob:` workers are admitted.

## Review Focus

- A Vite/Monaco blob worker must be allowed while arbitrary scripts remain forbidden; Task 1 pins both policy directives.
- A persisted bad global route must become Office rather than a blank renderer; Task 2 validates normalization.
- Disabling Worlds must hide the tab and route a restored Worlds preference back to Office; Task 3 covers the gate.
- A failed non-Office resource preload must leave the ready renderer painted because it has not yet been disposed; Task 5 covers it.
- A post-disposal renderer failure must make one Office attempt and release every Pixi mount/ticker once; Task 5 covers repeated failures.

---

### Task 1: Allow bundled development workers without widening script execution

**Files:**
- Modify: `src/renderer/index.html`
- Modify: `test/bundled-fonts.test.cjs`

**Interfaces:**
- Produces: a renderer CSP containing `worker-src 'self' blob:` while preserving `script-src 'self'`.
- Consumed by: Monaco's Vite `?worker` constructors and every WorldHost boot.

- [ ] **Step 1: Write the failing CSP regression test**

Add `the renderer CSP admits the self-hosted blob workers Monaco uses in development` to `test/bundled-fonts.test.cjs`. Read the app CSP and assert both literal directives: `worker-src 'self' blob:` and `script-src 'self'`.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test test/bundled-fonts.test.cjs`

Expected: FAIL because the application policy has no `worker-src` directive.

- [ ] **Step 3: Add the minimal CSP directive**

Insert `worker-src 'self' blob:` after `script-src 'self'` in `src/renderer/index.html`. Do not add `unsafe-eval`, remote origins, or broaden `script-src`.

- [ ] **Step 4: Run the focused test and renderer typecheck**

Run: `node --test test/bundled-fonts.test.cjs && npm run typecheck:web`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/index.html test/bundled-fonts.test.cjs
git commit -m "fix(renderer): permit bundled blob workers"
```

### Task 2: Persist and normalize the visual global route

**Files:**
- Modify: `src/main/config.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/store/config.ts`
- Modify: `test/world-config.test.cjs`

**Interfaces:**
- Produces: `lastGlobalView?: 'office' | 'marketplace' | 'worlds'` on the mirrored `HarnessConfig` and a main-process normalizer that returns `office` for an invalid value or a Worlds route while Worlds is disabled.
- Consumed by: `App` initial route state in Task 4.

- [ ] **Step 1: Write failing config behavior tests**

Extend `test/world-config.test.cjs` with literal cases: a saved `{ worldsEnabled: true, selectedWorld: 'monster-trainer', lastGlobalView: 'worlds' }` round-trips; `lastGlobalView: 'unknown'` reads as `office`; a saved Worlds route with `worldsEnabled: false` reads as `office`.

- [ ] **Step 2: Run the config test to verify it fails**

Run: `node --test test/world-config.test.cjs`

Expected: FAIL because `lastGlobalView` is not part of the config contract.

- [ ] **Step 3: Implement the visual-route preference**

Add the optional field to main, preload, and renderer `HarnessConfig` mirrors. Set `office` in defaults and normalize only the three declared values. Normalization must force `office` when `worldsEnabled !== true`; it must not edit Hive/task/agent data.

- [ ] **Step 4: Run focused config tests and both typechecks**

Run: `node --test test/world-config.test.cjs && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/config.ts src/preload/index.ts src/renderer/src/store/config.ts test/world-config.test.cjs
git commit -m "feat(worlds): persist visual global route"
```

### Task 3: Add the gated Worlds global navigation tab

**Files:**
- Modify: `src/renderer/src/components/globalNavModel.ts`
- Modify: `src/renderer/src/components/GlobalNav.tsx`
- Modify: `src/renderer/src/i18n/locales/en.json`
- Modify: `src/renderer/src/i18n/locales/es.json`
- Modify: `src/renderer/src/i18n/locales/zh-CN.json`
- Modify: `src/renderer/src/i18n/locales/ar.json`
- Modify: `src/renderer/src/i18n/locales/ja.json`
- Modify: `test/global-nav.test.cjs`

**Interfaces:**
- Produces: `GlobalView = 'office' | 'marketplace' | 'worlds'` and `GlobalNav` props `worldsEnabled: boolean` plus its existing view callbacks.
- Consumed by: `App` and `WorldsView` in Task 4.

- [ ] **Step 1: Write failing global-nav tests**

Extend `test/global-nav.test.cjs` to assert `GlobalView` admits `worlds`, `GlobalNav` receives `worldsEnabled`, the Worlds tab is rendered only behind that prop, and every five locale `shell` trees has the same key set including `shell.nav.worlds`.

- [ ] **Step 2: Run the focused navigation test to verify it fails**

Run: `node --test test/global-nav.test.cjs`

Expected: FAIL because Worlds is not a global view or translated tab.

- [ ] **Step 3: Implement the tab without changing Marketplace semantics**

Add the Worlds `button` after Marketplace using the existing `tabStyle`, `aria-current`, and titlebar non-drag behavior. Keep Marketplace visible at narrow density. Make the Worlds button absent when `worldsEnabled` is false; do not alter the Settings menu keyboard model.

- [ ] **Step 4: Run the navigation test**

Run: `node --test test/global-nav.test.cjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/globalNavModel.ts src/renderer/src/components/GlobalNav.tsx src/renderer/src/i18n/locales test/global-nav.test.cjs
git commit -m "feat(worlds): add global Worlds tab"
```

### Task 4: Make Worlds a dedicated shell surface

**Files:**
- Create: `src/renderer/src/worlds/WorldsView.tsx`
- Modify: `src/renderer/src/App.tsx`
- Delete: `src/renderer/src/components/WorldSelector.tsx`
- Modify: `test/world-shell.test.cjs`

**Interfaces:**
- `WorldsView({ config, onReturnToOffice }: { config: HarnessConfig; onReturnToOffice: () => void }): ReactNode` owns catalog controls and one alternative-world host slot.
- `App` initializes `globalView` from `config.lastGlobalView`, writes view changes through `window.cth.updateConfig`, and renders Office, Marketplace, or Worlds without unmounting semantic side panels.

- [ ] **Step 1: Write failing shell tests**

Replace the compact-selector expectation in `test/world-shell.test.cjs` with these assertions: `WorldSelector.tsx` is absent; `WorldsView` exists; `App` mounts it only for `globalView === 'worlds'`; the agent strip, sidebar, and Command Center remain unconditional; selecting Office from Worlds invokes `onReturnToOffice` instead of creating an Office card in the Worlds catalog.

- [ ] **Step 2: Run the shell test to verify it fails**

Run: `node --test test/world-shell.test.cjs`

Expected: FAIL because the current app keeps `WorldHost` in the Office slot and the compact selector exists.

- [ ] **Step 3: Implement the dedicated surface and route persistence**

Create `WorldsView` with the registry-driven list and a clear selected state. A Monster Trainer selection writes only `selectedWorld`; Office selection calls `onReturnToOffice`. In `App`, make Office and Worlds mutually exclusive canvas owners, update `lastGlobalView` on global-nav changes, and pass `worldsEnabled` to `GlobalNav`. Preserve Marketplace's overlay behavior and all existing non-world surfaces.

- [ ] **Step 4: Run focused shell/navigation tests and typecheck**

Run: `node --test test/world-shell.test.cjs test/global-nav.test.cjs && npm run typecheck:web`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/worlds/WorldsView.tsx src/renderer/src/App.tsx src/renderer/src/components/WorldSelector.tsx test/world-shell.test.cjs
git commit -m "feat(worlds): move world selection into global surface"
```

### Task 5: Serialize WorldEngine renderer ownership and preserve finite recovery

**Files:**
- Modify: `src/renderer/src/worlds/WorldEngine.ts`
- Modify: `src/renderer/src/worlds/WorldHost.tsx`
- Modify: `src/renderer/src/worlds/WorldRuntimeSurface.tsx`
- Modify: `test/world-engine.test.cjs`
- Modify: `test/office-world-lifecycle.test.cjs`
- Modify: `test/monster-trainer-world.test.cjs`

**Interfaces:**
- `WorldEngine.select(worldId)` preloads/validates before requesting disposal of a ready mount.
- `WorldEngine.markDisposed(token)` advances the pending candidate to mount only after the prior canvas cleanup has completed.
- `WorldHost` renders at most one `WorldRuntimeSurface`; it reports renderer READY/failure and performs no full-page reload during a normal selection.

- [ ] **Step 1: Write failing lifecycle tests**

Replace the hidden-staging assertion in `test/world-engine.test.cjs` with a serialized trace: Office is READY; Monster resources resolve while Office remains READY; exactly after Office disposal acknowledgement Monster becomes the sole mount candidate; Monster READY makes it active. Add a resource-failure case proving Office remains active because disposal was never requested. Add three consecutive failed transitions that prove no stale mount, disposal, or listener count accumulates. Extend Office/Monster lifecycle tests to assert each unmount calls its existing Pixi destruction path once, and assert the host never invokes `window.location.reload()` for a normal selection.

- [ ] **Step 2: Run the focused lifecycle tests to verify they fail**

Run: `node --test test/world-engine.test.cjs test/office-world-lifecycle.test.cjs test/monster-trainer-world.test.cjs`

Expected: FAIL because the current engine exposes simultaneous active/candidate world layers.

- [ ] **Step 3: Implement serialized handoff**

Keep the manifest/resource loop and `WorldLifecycleError` fields. After successful preload, queue the ready mount for disposal and retain the next world internally; do not expose the next renderer to React until `markDisposed` acknowledges cleanup. On a candidate renderer failure after disposal, perform the existing one-shot Office fallback; if that fails, enter Recovery. Make `visibleMounts`/host rendering derive one live mount only and remove the invisible opacity staging layer.

- [ ] **Step 4: Run focused lifecycle tests and typecheck**

Run: `node --test test/world-engine.test.cjs test/office-world-lifecycle.test.cjs test/monster-trainer-world.test.cjs && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/worlds/WorldEngine.ts src/renderer/src/worlds/WorldHost.tsx src/renderer/src/worlds/WorldRuntimeSurface.tsx test/world-engine.test.cjs test/office-world-lifecycle.test.cjs test/monster-trainer-world.test.cjs
git commit -m "fix(worlds): serialize Pixi renderer handoff"
```

### Task 6: Verify production output and the real Electron flow

**Files:**
- No production changes expected.

**Interfaces:**
- Consumes: the completed global route, single-renderer host, and existing dev/package resolver seam.
- Produces: final automated and manual evidence; no new runtime API.

- [ ] **Step 1: Run complete automated verification**

Run: `node --test test/*.test.cjs && npm run typecheck && npm run build`

Expected: all tests pass, typechecks pass, and the build emits Office, Starter Village, and Monaco worker assets.

- [ ] **Step 2: Manual Electron witness**

Start the development app with the Worlds flag enabled. Verify: Office → Worlds → Monster Trainer → Office three times; a missing-world-resource recovery; then reload while Monster Trainer is selected. Confirm the same agents, selected agent, task detail state, and live terminals remain available. Record any GPU/context warning as a failure rather than treating reload as success.

## Plan Self-Review

- Spec coverage: Tasks 1–6 cover the CSP prerequisite, global route, gated navigation, dedicated surface, serialized canvas ownership, finite failure behavior, dev/package seam, and manual GPU witness.
- Type consistency: `lastGlobalView`, `GlobalView`, `WorldsView`, `select`, and `markDisposed` are named once and consumed consistently.
- Scope: the plan deliberately excludes scenario art and semantic behavior changes.
- Review focus: every listed failure mode has an owning task and explicit test.
