# Transactional World Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ad-hoc WorldHost switch with a transactional, resolver-agnostic lifecycle engine that preserves the last usable visual world.

**Architecture:** `worldRegistry` declares each world's manifest and React surface. A pure `WorldEngine` validates resources through an injected resolver and reports structured lifecycle state; `WorldHost` supplies staged/active DOM layers and commits a candidate only after its surface reports ready. Existing Office and Monster surfaces only acquire lifecycle callbacks.

**Tech Stack:** React 18, TypeScript, PixiJS 8, Vite asset URLs, Node `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-26-munder-worlds-visual-engine-design.md`

## Global Constraints

- Office is a registry-declared world and the sole fallback id; it receives no host-only world branch.
- No visual lifecycle code reads or writes Hive, agents, tasks, or profiles.
- Resource resolution is injected; dev and packaged differ only by resolver implementation/URL inputs.
- A current READY mount remains live until candidate `READY`, then is disposed once after an explicit swap.
- Fallback is finite: target failure -> retain READY; no READY -> Office once; failed Office -> Recovery Surface.
- Vite outage is an external resolver error, never a process restart attempt.
- No unrelated refactors.

## Review Focus

- A stale ready/failure callback from a superseded candidate must be ignored; Task 1 tests request tokens.
- A failed Office fallback cannot recursively retry Office; Task 1 tests the finite request flag.
- A candidate may allocate resources before ready; Task 2 tests cleanup once on failed/repeated staging.
- A successful swap disposes the old surface once, after—not before—the swap; Task 2 tests ordering.
- A resolver must carry its runtime kind only as diagnostic context, not a distinct engine path; Task 1 tests both kinds against one engine.

### Task 1: Pure lifecycle engine

**Files:**
- Create: `src/renderer/src/worlds/WorldEngine.ts`
- Create: `test/world-engine.test.cjs`

**Interfaces:**
- Produces `WorldEngine`, `WorldPhase`, `WorldLifecycleError`, `WorldResourceResolver`, and `WorldEngineState`.
- Consumes registry manifest metadata and injected `resolve(resource)` only.

- [x] Write failing tests for Office/Monster bootstrap, missing target resource retaining current READY, one Office fallback when no READY exists, no recursive Office retry, identical event path for `dev` and `packaged` resolvers, stale callback rejection, and repeated failed candidates releasing each staged handle once.
- [x] Run `node --test test/world-engine.test.cjs`; expect missing module failure.
- [x] Implement the finite request state machine and structured errors, with explicit candidate ids/tokens and no React/Hive imports.
- [x] Re-run `node --test test/world-engine.test.cjs`; expect pass.

### Task 2: Registry contract and transactional host

**Files:**
- Modify: `src/renderer/src/worlds/worldRegistry.ts`
- Modify: `src/renderer/src/worlds/WorldHost.tsx`
- Create: `src/renderer/src/worlds/WorldRuntimeSurface.tsx`
- Modify: `test/world-registry.test.cjs`
- Modify: `test/world-shell.test.cjs`

**Interfaces:**
- Registry produces a manifest and `render({ onReady, onFailure })` surface for every world.
- Host consumes `WorldEngine` state, keeps active/staging layers, and invokes the engine's ready/failure/dispose hooks.

- [x] Extend tests first to require manifests for Office and Monster, registry-declared fallback, staged/active layers, structured recovery, and no world-id conditional renderer selection in the host.
- [x] Run the targeted tests; expect failure against the old host.
- [x] Implement the minimal registry adapter contract, browser resolver, staged activation/swap, Recovery Surface, and single post-swap disposal signal.
- [x] Re-run targeted tests plus `npm run typecheck`; expect pass.

### Task 3: Make existing renderers lifecycle participants

**Files:**
- Modify: `src/renderer/src/scene/office/OfficeFloor.tsx`
- Modify: `src/renderer/src/worlds/monster/MonsterTrainerWorld.tsx`
- Modify: `src/renderer/src/worlds/monster/MonsterTrainerSurface.tsx`
- Modify: `test/monster-trainer-world.test.cjs`
- Create: `test/office-world-lifecycle.test.cjs`

**Interfaces:**
- Both surfaces accept `onReady` and `onRenderFailure(error)` and invoke exactly one terminal lifecycle callback per mount.
- Existing projection/state callbacks remain outside the engine.

- [x] Add failing source/behavior tests that require Office readiness only after textures/map setup, failure forwarding with cause, Monster readiness after first render, and async ticker/init failure forwarding.
- [x] Run these tests; expect failure for missing ready contract.
- [x] Add the minimal callbacks, mount cancellation guards, and one-shot failure reporting without refactoring renderer behavior.
- [x] Re-run renderer lifecycle tests and `npm run typecheck`; expect pass.

### Task 4: Integrated regression evidence

**Files:**
- Modify: `docs/pr-evidence/munder-worlds-visual-engine.md`

- [x] Run `npm run typecheck && npm run test:focused` and record exact results.
- [x] Inspect diff/status for scope and record the manual visual checks still required: packaged launch and active dev-server Office/Monster swapping.
- [x] Commit the coherent implementation and documentation.
