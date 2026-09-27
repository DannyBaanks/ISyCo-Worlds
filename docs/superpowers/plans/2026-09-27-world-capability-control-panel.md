# World Capability Control Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users inspect and configure skills, MCPs, actions, and presentation packs independently for each registered world profile.

**Architecture:** The panel reads resolved capability descriptors from the shared registry and edits profile-scoped overrides. Existing MCP consent, bundled skill provisioning, and action adapters are reused. The panel reports each module's activation mode and applies changes only through the owning harness or presentation lifecycle.

**Tech Stack:** React, TypeScript, Electron IPC/preload, existing MCP catalog and skills/action implementations, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-27-world-capability-runtime-design.md`

**Prerequisites:** Complete `2026-09-27-world-capability-profiles.md` and `2026-09-27-isolated-world-presentation.md` first; the panel consumes their registry, profile settings, and presentation descriptors.

## Global Constraints

- The panel cannot activate capabilities absent from the selected profile or explicit shared set.
- Required capabilities cannot be disabled while a profile depends on them.
- MCP/skill/action changes default to a harness restart; visual package changes default to a presentation restart; only explicit `live` modules apply live.
- Provider credentials remain global references and are never copied into world profiles.
- App-managed MCPs/skills must be injected per profile without modifying shared user-level CLI configuration.
- Unscoped user-global integrations are labeled external/shared and are not reported as world-isolated.

## Review Focus

- Hand-edited or stale override files must not enable secret/write MCPs without explicit consent — test in Task 1.
- A required dependency cannot be disabled through the UI or IPC — test in Task 1.
- Unscoped global CLI integrations must not be represented as isolated — test in Task 2.
- Skills installed for one world must not be copied into another profile's agent session — test in Task 2.
- Changing panel context must not write settings to the previously selected world — test in Task 3.

---

## Files and Responsibilities

- `src/main/worldProfileSettings.ts` — validated per-profile overrides and atomic persistence under the profile root.
- `src/main/hive.ts` — receive the resolved per-profile MCP/skill configuration at session creation.
- `src/shared/mcpCatalog.ts` — adapt existing MCP definitions to registry descriptors without duplicating launch specs.
- `src/main/skills.ts` — provide profile-scoped bundled/managed skill roots while retaining external global skill discovery labels.
- `src/main/realtimeActions.ts`, `src/renderer/src/realtime/actions.ts`, `src/renderer/src/realtime/tools.ts` — register existing action modules through descriptors and enforce resolved profile enablement.
- `src/renderer/src/components/WorldCapabilityPanel.tsx` — grouped UI, dependency explanation, scope labels, and restart state.
- `src/renderer/src/components/SettingsModal.tsx` / existing Settings navigation — mount the panel without replacing unrelated settings.
- `src/preload/index.ts`, `src/renderer/src/store/config.ts`, locale files — typed IPC and localized UI.
- `test/world-profile-settings.test.cjs`, `test/world-capability-adapters.test.cjs`, `test/world-capability-panel.test.cjs` — persistence, adapter, and UI behavior.

### Task 1: Profile-scoped capability settings and safe validation

**Files:**
- Create: `src/main/worldProfileSettings.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/main/index.ts`
- Test: `test/world-profile-settings.test.cjs`

**Interfaces:**
- `getWorldCapabilitySettings(profileId)` returns validated enabled overrides and secret references only.
- `setWorldCapabilityEnabled(profileId, capabilityId, enabled)` returns `{ ok, pendingRestart, error? }` after checking registry ownership, requirements, and consent tier.
- Settings persist atomically to `<worldProfileRoot>/capabilities.json`.

- [ ] **Step 1: Add failing tests** for independent Office/Monster settings, unknown id refusal, required-capability refusal, dependency-blocked disable, corrupt-file defaults, and secret/write consent defaults.
- [ ] **Step 2: Run `npm run test:focused -- test/world-profile-settings.test.cjs`** and verify failure before implementation.
- [ ] **Step 3: Implement profile-scoped read/validate/write functions** using temp-file + rename; preserve unknown metadata only if schema allows it.
- [ ] **Step 4: Add validated IPC handlers** that derive the profile root in main rather than trust a renderer-supplied path.
- [ ] **Step 5: Run focused settings tests, `npm run typecheck`, and `npm run test:focused`.**
- [ ] **Step 6: Commit** as `feat(worlds): persist profile capability settings`.

### Task 2: Adapt MCP, skills, and actions to the resolved profile

**Files:**
- Modify: `src/shared/mcpCatalog.ts`
- Modify: `src/main/hive.ts`
- Modify: `src/main/skills.ts`
- Modify: `src/main/realtimeActions.ts`
- Modify: `src/renderer/src/realtime/actions.ts`
- Modify: `src/renderer/src/realtime/tools.ts`
- Test: `test/world-capability-adapters.test.cjs`

- [ ] **Step 1: Add failing adapter tests** proving `office-bridge` receives the selected Hive root, filesystem/git receive the common workspace cwd, profile MCP consent does not bleed, profile skills provision only into that profile's agents, and disabled actions are absent.
- [ ] **Step 2: Register existing MCP catalog entries as capability descriptors** while retaining tier consent checks and existing server launch specs.
- [ ] **Step 3: Thread resolved profile MCP/skill context into per-session settings**; do not mutate `~/.claude` or copy secret values into profile files.
- [ ] **Step 4: Register current harness and realtime action surfaces by stable action id** and filter them from the resolved active profile; do not add per-world branches to each action body.
- [ ] **Step 5: Mark unscoped user-global MCPs/skills as external/shared and expose only what the current provider can safely scope.** If the provider does not support the declared isolation, return a structured unsupported scope instead of claiming isolation.
- [ ] **Step 6: Run adapter tests, existing MCP/skills/realtime tests, `npm run typecheck`, and `npm run test:focused`.**
- [ ] **Step 7: Commit** as `feat(worlds): scope mcp skills and actions by profile`.

### Task 3: World Capability Control Panel

**Files:**
- Create: `src/renderer/src/components/WorldCapabilityPanel.tsx`
- Modify: `src/renderer/src/components/SettingsModal.tsx`
- Modify: `src/renderer/src/store/config.ts`
- Modify: `src/renderer/src/i18n/locales/en.json`
- Modify: `src/renderer/src/i18n/locales/es.json`
- Test: `test/world-capability-panel.test.cjs`

- [ ] **Step 1: Add failing UI tests** for profile-scoped grouping, explicit shared/external labels, required/dependency/conflict states, enable/disable controls, and pending harness/presentation restart badges.
- [ ] **Step 2: Implement the panel using registry descriptors and validated IPC only.** Do not duplicate the MCP catalog or skill inventory in React.
- [ ] **Step 3: Add localized control copy** and preserve current Settings navigation/content outside the new panel.
- [ ] **Step 4: Run panel tests, `npm run typecheck`, and `npm run test:focused`; verify switching panel context cannot write into the previous profile.**
- [ ] **Step 5: Commit** as `feat(settings): add world capability control panel`.

### Task 4: Presentation pack controls and end-to-end profile witness

**Files:**
- Modify: the registered world presentation descriptors/manifests from Plan 2.
- Modify: `src/renderer/src/components/WorldCapabilityPanel.tsx`
- Test: `test/world-capability-e2e.test.cjs`

- [ ] **Step 1: Add failing end-to-end profile tests** selecting Office and Monster, changing one MCP/skill/action/presentation setting in one profile, and proving the other remains unchanged.
- [ ] **Step 2: Expose HUD/cursor/voice/skin presentation modules** from the same registry, with `presentation-restart` as their default activation mode unless a module proves `live`.
- [ ] **Step 3: Verify the panel marks the correct pending restart and that restart affects only its owning runtime.**
- [ ] **Step 4: Run all world/capability tests, `npm run typecheck`, `npm run build`, and `npm run test:focused`; manually check the settings UI in Electron.**
- [ ] **Step 5: Commit** as `test(worlds): verify profile-scoped capability controls`.

## Definition of Done

Users can see and configure the capabilities of a profile without hidden cross-world activation. Existing MCP/skills/action systems are adapted rather than forked, restart requirements are explicit, and the same panel can accommodate future registered worlds without UI world branches.
