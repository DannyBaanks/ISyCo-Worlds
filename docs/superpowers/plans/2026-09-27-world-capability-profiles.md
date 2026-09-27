# World Capability Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a typed registry pipeline that boots one isolated semantic world profile at a time while keeping the Electron GUI and common project workspace stable.

**Architecture:** Code-owned capability descriptors feed a deterministic resolver. A profile-aware harness supervisor binds existing Hive/services to a per-world data root, while `workspaceRoot` remains the agent cwd. Profile changes stop and rebind the harness runtime without silently enabling another profile.

**Tech Stack:** Electron 32, TypeScript, Node test runner (`.test.cjs`), existing Hive/MCP/skill adapters.

**Spec:** `docs/superpowers/specs/2026-09-27-world-capability-runtime-design.md`

## Global Constraints

- No arbitrary third-party plugin discovery, installation, or hot code loading.
- Only one semantic world profile may run at once.
- A failed profile must not silently fall back to Office/Munder.
- `workspaceRoot` is shared; `worldProfileRoot` is isolated per profile.
- Provider credentials remain global references and are never copied into profiles.
- Munder migration preserves the original data and is idempotent.
- Add new modules through explicit registry imports; do not scatter profile `if` branches.

## Review Focus

- Duplicate ids, unknown dependencies, cycles, and conflicts must fail before activation — pin in Task 1 resolver tests.
- Missing/corrupt profile config must not activate an unintended world — pin in Task 2 default/validation tests.
- A partial legacy-data copy must not switch roots or destroy source data — pin in Task 2 migration tests.
- Profile switch failure must not leave old and new services active together — pin in Task 3 lifecycle tests.
- Global CLI integrations must not be falsely claimed as world-scoped — pin in Task 3 session-config adapter tests.

---

## Files and Responsibilities

- `src/shared/worldCapabilities.ts` — serializable descriptor/profile/resolution types and validators.
- `src/main/worldCapabilityRegistry.ts` — explicit built-in imports, identity checks, dependency graph and profile resolution.
- `src/main/worldProfileRuntime.ts` — active profile, workspace/profile roots, config snapshot and validated migration.
- `src/main/index.ts` — harness stop/rebind/start lifecycle and IPC owned by Electron main.
- `src/main/config.ts`, `src/renderer/src/store/config.ts`, `src/preload/index.ts` — persisted preferences and narrow IPC types.
- `src/main/hive.ts` and service constructors in `src/main/index.ts` — consume profile roots for state, workspace root for cwd.
- `src/renderer/src/components/WorldsView.tsx` / `App.tsx` — initial profile selection and active-profile status; no live semantic swap.
- `test/world-capability-registry.test.cjs`, `test/world-profile-runtime.test.cjs`, `test/world-profile-lifecycle.test.cjs` — resolver, path/migration, lifecycle witnesses.

### Task 1: Typed capability registry and resolver

**Files:**
- Create: `src/shared/worldCapabilities.ts`
- Create: `src/main/worldCapabilityRegistry.ts`
- Test: `test/world-capability-registry.test.cjs`
- Modify: `src/shared/worlds.ts`

**Interfaces:**
- `CapabilityKind = 'mcp' | 'skill' | 'action' | 'hud' | 'cursor' | 'voice'`.
- `CapabilityDescriptor`: `id`, `kind`, `profiles`, `shared`, `requires`, `conflicts`, `required`, `activation`, `adapterId`.
- `WorldProfileDescriptor`: `id`, `labelKey`, `requiredCapabilities`, `optionalCapabilities`, `sharedCapabilities`, `presentationId`.
- `resolveWorldProfile(profileId, profiles, capabilities, overrides?)` returns a deterministic topologically ordered `ResolvedWorldProfile` or structured `WorldProfileResolutionError`.

- [ ] **Step 1: Add failing registry tests** for resolving `office` and `monster-trainer`, explicit shared capability inclusion, inactive foreign capabilities, duplicate identity, missing dependency, dependency cycle, and conflict.
- [ ] **Step 2: Run `npm run test:focused -- test/world-capability-registry.test.cjs`** and confirm the new tests fail because the registry API is missing.
- [ ] **Step 3: Implement serializable descriptors and `resolveWorldProfile`** with stable topological ordering and structured validation errors. Keep descriptors free of Electron and filesystem imports.
- [ ] **Step 4: Register initial profiles and built-in capability descriptors through one explicit registry entry point.** Both main profiles may declare broad independent baseline access; shared entries require explicit profile inclusion.
- [ ] **Step 5: Run the focused registry tests and `npm run typecheck`**; confirm all graph/identity cases pass without world-specific conditionals in resolver code.
- [ ] **Step 6: Commit** as `feat(worlds): add capability profile registry`.

### Task 2: Per-world roots and recoverable Munder migration

**Files:**
- Create: `src/main/worldProfileRuntime.ts`
- Create: `test/world-profile-runtime.test.cjs`
- Modify: `src/main/config.ts`
- Modify: `src/main/fs.ts`
- Modify: `src/main/index.ts`
- Modify: `src/main/hive.ts`
- Modify: service constructors that currently bind directly to `readConfig().harnessHome`.

**Interfaces:**
- `WorldRuntimeRoots = { workspaceRoot: string; profileRoot: string }`.
- `resolveWorldRuntimeRoots(workspaceRoot, profileId)` resolves a profile path under `.munder/worlds/<profileId>` and rejects traversal/overlap escapes.
- `migrateLegacyMunderState(workspaceRoot, profileRoot)` returns `{ status: 'not-needed' | 'copied' | 'already-migrated'; copied: string[] }` or a structured error; it never deletes legacy inputs.

- [ ] **Step 1: Add failing root tests** asserting Office and Monster roots differ, workspace cwd is identical, path traversal ids are rejected, and profile folders do not overlap.
- [ ] **Step 2: Add failing migration tests** for absent legacy data, successful copy of `hive/`, `palace/`, `roster.json`, and `roster-backups`, interrupted-copy recovery, conflict refusal, and idempotent rerun.
- [ ] **Step 3: Run `npm run test:focused -- test/world-profile-runtime.test.cjs`** and confirm the new tests fail before implementation.
- [ ] **Step 4: Implement root resolution and journaled copy/validation.** Preserve source files; switch the profile's active root only after validation succeeds. Safely add `.munder/` to the app-managed harness gitignore without replacing user content.
- [ ] **Step 5: Route Hive, memory, roster, action configuration, and profile-owned services to `profileRoot`; keep agent cwd and workspace-scoped filesystem/git MCP arguments on `workspaceRoot`.** Use one runtime-root provider instead of new per-world branches.
- [ ] **Step 6: Run runtime tests, existing Hive/config tests, `npm run typecheck`, and `npm run test:focused`.** Confirm legacy root reads remain compatible until migration completes.
- [ ] **Step 7: Commit** as `feat(worlds): isolate per-profile runtime data`.

### Task 3: Harness profile lifecycle without application relaunch

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/main/config.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/store/config.ts`
- Create: `test/world-profile-lifecycle.test.cjs`

**Interfaces:**
- `activateWorldProfile(profileId): Promise<{ ok: true; activeProfileId: string } | { ok: false; error: WorldProfileLifecycleError }>`.
- `WorldProfileLifecycleError`: `phase`, `profileId`, optional `capabilityId`, `category`, and `cause`.
- `getActiveWorldProfile(): WorldProfileRuntimeStatus` reports active profile/session identity separately from the persisted startup preference.

- [ ] **Step 1: Add failing lifecycle tests** for success, structured required-capability failure, confirmation-required profile change, no two profiles active at once, cleanup after partial service startup, preservation of the prior runtime when pre-activation fails, and no silent Office fallback.
- [ ] **Step 2: Run the focused lifecycle tests** and verify failure against the current `app.relaunch()`-only `config:changeHome` path.
- [ ] **Step 3: Implement a main-process stop/rebind/start coordinator.** Stop old profile services/workers before activating the new profile; retain the Electron GUI. If validation/preparation fails before teardown, preserve the previous active runtime.
- [ ] **Step 4: Separate persisted `preferredWorldProfile` from read-only `activeWorldProfile` status.** Do not use the preference as proof that activation succeeded.
- [ ] **Step 5: Add narrow preload IPC methods** for selecting, confirming, activating, and querying the profile; validate every id in main.
- [ ] **Step 6: Run lifecycle/config tests plus `npm run typecheck` and `npm run test:focused`.** Confirm profile switching does not call `app.relaunch()` and failed activation does not publish the new active id.
- [ ] **Step 7: Commit** as `feat(worlds): restart harness runtime by profile`.

### Task 4: Startup world selector integration

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/worlds/WorldsView.tsx`
- Modify: `src/renderer/src/components/GlobalNav.tsx`
- Modify: `src/renderer/src/i18n/locales/en.json`
- Modify: `src/renderer/src/i18n/locales/es.json`
- Test: `test/world-profile-selector.test.cjs`

- [ ] **Step 1: Add failing UI tests** that select a startup profile, show active versus preferred profile, require confirmation for changing an active profile, and never switch the current scene before activation reports success.
- [ ] **Step 2: Implement startup selection against `activateWorldProfile`** and replace the current global visual tab behavior. Keep profile selection in startup/onboarding and explicit restart controls only; remove the Worlds sibling global-navigation tab once a profile is active, while keeping Marketplace navigation unchanged.
- [ ] **Step 3: Add translated lifecycle/loading/error/confirmation copy** for English and Spanish.
- [ ] **Step 4: Run selector tests, `npm run typecheck`, and `npm run test:focused`.** Manually verify startup choice and semantic profile confirmation in Electron.
- [ ] **Step 5: Commit** as `feat(worlds): select semantic profile at startup`.

## Definition of Done

Office and Monster Trainer resolve to independent runtime roots and capability plans, the project workspace remains shared, Munder migration is recoverable, the GUI survives a harness profile rebind, and no profile silently activates another after failure. The separate visual-process requirement is implemented by Plan 2.
