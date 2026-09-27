# Isolated World Presentation Host Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Host Pixi worlds in a renderer process with a distinct PID that the GUI can restart without restarting the harness session.

**Architecture:** The Electron main process supervises a child visual WebContents/renderer and controls its lifetime. A narrow typed IPC protocol sends the active profile and read-only visual projection. The child owns Pixi and presentation assets only; the primary GUI retains Recovery UI and all semantic session ownership.

**Tech Stack:** Electron 32, electron-vite, React, PixiJS, TypeScript, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-27-world-capability-runtime-design.md`

**Prerequisite:** Complete `2026-09-27-world-capability-profiles.md` first; this host consumes its active-profile and read-only projection API.

## Global Constraints

- The visual host must have a distinct OS renderer PID; separate React roots or a worker thread are insufficient.
- Restarting/crashing the visual host must not restart the app, Hive, agents, PTYs, tasks, or active session identity.
- GUI main process owns host lifecycle and receives structured errors; visual host owns presentation only.
- Stale messages are rejected by host-generation and session identity.
- Dev and packaged use the same host lifecycle; only resource resolution differs.
- Every Pixi application, canvas, ticker, listener, and host process is disposed exactly once.

## Review Focus

- Electron may not provide a distinct renderer PID for an embedding API — witness in Task 1; stop if the requirement is not met.
- Host crash during async asset load must not report stale READY — test in Task 2.
- Old host messages after restart must not overwrite current state — test in Task 2.
- Missing packaged asset must produce GUI Recovery without taking down harness — test in Task 3.
- Window close/reopen must not leave orphan visual processes or duplicated GPU resources — witness in Task 4.

---

## Files and Responsibilities

- `src/main/worldPresentationSupervisor.ts` — create, control, observe, restart and dispose isolated host.
- `src/main/index.ts` — attach host bounds/lifecycle to the primary Electron window.
- `src/preload/index.ts` — typed, allowlisted visual host bridge.
- `src/shared/worldPresentationProtocol.ts` — serializable commands, projection, status and structured failures.
- `electron.vite.config.ts` / renderer entry files — build a packaged/dev visual-host entry using the same logical module.
- `src/renderer/src/worlds/*` — move Pixi host lifecycle behind child renderer entry; keep `WorldEngine` focused on presentation lifecycle.
- `test/world-presentation-protocol.test.cjs`, `test/world-presentation-supervisor.test.cjs` — protocol and failure tests.

### Task 1: Prove an Electron visual host can be separately restarted

**Files:**
- Create: `test/electron/world-presentation-fixture/package.json`
- Create: `test/electron/world-presentation-fixture/main.cjs`
- Create: `test/electron/world-presentation-fixture/renderer.html`
- Create: `test/world-presentation-pid.test.cjs`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add an Electron fixture** that creates a primary BrowserWindow and a candidate embedded visual WebContents, records both `getOSProcessId()` values, closes/recreates only the visual host, and exits nonzero unless the PIDs differ and the primary remains alive.
- [ ] **Step 2: Add `test/world-presentation-pid.test.cjs`** to launch the fixture and assert its structured witness; expose it as `npm run test:world-presentation-pid`.
- [ ] **Step 3: Run `npm run test:world-presentation-pid`** locally. On Linux CI run it under `xvfb-run -a`; run directly on Windows/macOS CI. Confirm separate PIDs, child-only restart, and stable primary PID.
- [ ] **Step 4: If the candidate shares a PID, test the next isolated Electron host option.** Do not continue with a component/iframe/worker substitute; stop and report if no supported host meets the contract.
- [ ] **Step 5: Commit the passing witness** as `test(worlds): prove isolated presentation process`.

### Task 2: Typed presentation IPC and main-process supervisor

**Files:**
- Create: `src/shared/worldPresentationProtocol.ts`
- Create: `src/main/worldPresentationSupervisor.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Test: `test/world-presentation-protocol.test.cjs`
- Test: `test/world-presentation-supervisor.test.cjs`

**Interfaces:**
- Commands: `bootstrap(profileId, generation, projection)`, `restart(generation)`, `dispose(generation)`.
- Events: `phase`, `ready`, `failed`, and typed `intent`, each carrying `profileId`, `generation`, and optional structured error.
- Supervisor API: `start`, `updateProjection`, `restartVisual`, `dispose`; never owns or restarts harness services.

- [ ] **Step 1: Add failing protocol tests** for schema validation, invalid profile/generation rejection, and stale-generation message rejection.
- [ ] **Step 2: Add failing supervisor tests** asserting only the visual WebContents is destroyed/recreated and main/harness adapters are untouched.
- [ ] **Step 3: Implement protocol types and main-process validation**; verify each incoming event's sender is the currently owned visual WebContents, reject stale generations, and expose only allowlisted methods through preload.
- [ ] **Step 4: Implement supervisor lifecycle** with monotonic generation tokens, structured error forwarding, and idempotent disposal.
- [ ] **Step 5: Run focused protocol/supervisor tests, `npm run typecheck`, and `npm run test:focused`.**
- [ ] **Step 6: Commit** as `feat(worlds): supervise isolated presentation host`.

### Task 3: Move Pixi rendering to the isolated host

**Files:**
- Create: `src/renderer/world-host.html` and its entry module (exact entry name set in `electron.vite.config.ts`).
- Modify: `electron.vite.config.ts`
- Modify: `src/renderer/src/worlds/WorldEngine.ts`
- Modify: `src/renderer/src/worlds/WorldHost.tsx`
- Modify: `src/renderer/src/worlds/WorldRuntimeSurface.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/worlds/WorldHost.tsx`
- Modify: `src/renderer/src/worlds/WorldRuntimeSurface.tsx`
- Modify: `src/renderer/src/worlds/WorldsView.tsx`
- Test: `test/world-presentation-runtime.test.cjs`

- [ ] **Step 1: Add failing presentation tests** for Office and Monster manifests, missing resource error structure, READY only after first complete frame, and repeated child restart cleanup.
- [ ] **Step 2: Create a separate renderer entry** that receives profile bootstrap/projection through the preload protocol and mounts one Pixi application.
- [ ] **Step 3: Move profile asset resolution and `WorldEngine` lifecycle into that entry.** Preserve identical manifest/resolution logic in dev and packaged modes.
- [ ] **Step 4: Make the primary renderer display host status/Recovery only; route typed intents back through main and do not expose semantic stores to the child.**
- [ ] **Step 5: Run visual runtime tests, `npm run typecheck`, `npm run build`, and `npm run test:focused`.** Confirm packaged output includes the child entry and referenced resources.
- [ ] **Step 6: Commit** as `feat(worlds): render Pixi worlds in isolated host`.

### Task 4: Session continuity and repeated failure witness

**Files:**
- Test: `test/world-presentation-session.test.cjs`
- Modify: `test/world-engine.test.cjs` and/or existing app integration witness only where appropriate.

- [ ] **Step 1: Add failing integration assertions** recording active profile/session ids, agent/PTy owners, task snapshot identity, primary GUI PID, visual PID, and Pixi ownership before/after visual crash/restart.
- [ ] **Step 2: Exercise three visual crashes/restarts** and assert session/profile/agent identities are unchanged, PIDs differ, every retired visual host exits once, and Pixi/listener/ticker counts return to baseline.
- [ ] **Step 3: Exercise missing dev and packaged resource cases** and confirm Recovery appears in the main GUI while the harness remains active.
- [ ] **Step 4: Run all world tests and build; manually verify resize/compositing and GPU behavior** in Electron.
- [ ] **Step 5: Commit** as `test(worlds): verify visual recovery preserves harness session`.

## Definition of Done

The renderer host has a witnessed distinct PID, can be restarted independently, restores the current profile projection, and never owns or resets harness state. Manual Electron GPU/window checks are documented separately from automated proof.
