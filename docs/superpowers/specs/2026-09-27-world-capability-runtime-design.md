# World Capability Runtime — Design

## Intent

Munder and Monster Trainer are not merely visual themes. Each is a world
profile that combines a semantic capability set (MCPs, skills, actions, and
other modules), isolated operational data, and a presentation package (HUD,
cursor, voice, skins, and scene assets). Future worlds such as a Cafeteria can
specialize the same foundation without adding world-specific conditionals
throughout the harness.

The application GUI, semantic harness session, and visual renderer have
different lifecycles. Restarting the visual presentation must not restart the
application or the harness session. Changing to a different semantic world
profile is an explicit harness-runtime restart, not a visual hot swap.

This specification supersedes
[`2026-09-26-worlds-global-surface-design.md`](./2026-09-26-worlds-global-surface-design.md),
which treated Worlds as a sibling visual surface and assumed Office remained
the shared operational home.

## Goals

1. Provide an explicit capability registry and resolution pipeline shared by
   all worlds.
2. Enable only the selected world's capabilities, plus capabilities explicitly
   declared shared.
3. Let Munder and Monster Trainer start with broad access independently, while
   allowing future profiles to specialize their MCPs, skills, actions, and
   presentation.
4. Isolate each world's Hive, roster, tasks, memory, and operational
   configuration while keeping the user's project/workspace common.
5. Keep the GUI alive and preserve the active semantic session when only the
   visual renderer/assets are restarted or fail.
6. Give the GUI supervisor authority to start, stop, recover, and update the
   isolated visual host without making that host the owner of harness truth.
7. Reuse one lifecycle for development and packaged builds; only resource
   resolution differs.
8. Preserve existing Munder data through a validated, recoverable migration.

## Non-goals

- Arbitrary third-party plugin discovery, installation, or hot code loading.
- Running multiple semantic world profiles concurrently.
- Automatically switching to Office/Munder when another profile fails.
- Replacing Hive, provider, MCP, or skill implementations wholesale; the
  registry adapts existing systems behind one profile-aware boundary.
- Changes to task semantics, worker progression, training, or campaign logic.

## Core Concepts

### World profile

A `WorldProfile` has a stable id, display metadata, required and optional
capability ids, an explicit list of shared capabilities, a presentation
manifest, and a profile storage identity. Initial profiles are `office` (the
Munder world) and `monster-trainer`. A future profile is added by registering
its profile and capabilities, not by adding world branches throughout the
application.

Munder and Monster Trainer may both declare the broad baseline set they need.
Their enablement/configuration and operational data remain independent.

### Capability descriptor

Each capability descriptor declares:

- stable id and semantic kind (`mcp`, `skill`, `action`, `hud`, `cursor`,
  `voice`, or another registered kind);
- owning world profile(s), or explicit shared status;
- required capabilities and conflicts;
- whether it is required or optional for a profile;
- the existing subsystem adapter that provides it;
- activation mode (`harness-restart`, `presentation-restart`, or `live`);
- defaults and user-configurable fields, without embedding secret values.

Descriptors are code-owned and imported through an explicit registry entry
point. There is no filesystem scan or arbitrary module execution. Adding a
module means implementing its adapter/descriptor and registering it once.

### Registry pipeline

```text
explicit module imports
        ↓
register descriptors → validate identities/dependencies/conflicts
        ↓
resolve selected profile + explicit shared capabilities
        ↓
prepare profile paths/configuration → activate adapters → HARNESS READY
        ↓
resolve presentation manifest → isolated visual host → WORLD VIEW READY
```

The registry resolves passive references and dependency metadata; adapters
remain the only way to call existing MCP, skill, or action systems. Modules do
not directly import one another's implementations. This adapts the useful
Registry/Engine and staged-bootstrap patterns from `bridge_core` without
copying its Python loader, authority system, or unrestricted capability model.

## Process and State Ownership

### Application GUI and harness supervisor

The Electron application remains the long-lived supervisor. Its main process
owns lifecycle authority and coordinates the harness runtime and the visual
host. The GUI can report harness/visual status and issue typed lifecycle
commands. It is not recreated just to change profiles or recover visuals.

The active profile's semantic state remains owned by the harness/Hive and its
existing process/session owners. A presentation host receives a read-only,
serializable projection of the world and returns typed view events/intents; it
does not receive direct ownership of Hive, agent processes, task ledgers, or
provider credentials.

### Independent visual renderer

Today `WorldHost` and `WorldEngine` live in the primary React renderer. The new
design moves world presentation into an isolated Electron renderer host with a
distinct OS renderer PID, controlled by the GUI supervisor over a narrow IPC
contract. It owns Pixi, canvas, visual tickers/listeners, HUD and presentation
assets only.

The chosen Electron embedding API must be proven to give the visual host a
different OS renderer PID from the primary GUI renderer. A separate component,
iframe, or worker thread alone does not satisfy this requirement. If the
selected host cannot demonstrate process separation, implementation must stop
and choose an actually isolated renderer boundary rather than weakening the
guarantee.

Stopping/crashing the visual host must not stop the GUI, Hive services, agents,
PTYs, or active profile session. Closing the whole application performs normal
visual-host cleanup so it cannot leave an orphan process. Restarting the
visual host requests the same active profile and latest projection; it does not
re-bootstrap the harness.

## Data Boundaries

- `workspaceRoot`: the existing user-selected project/workspace, shared by
  worlds and retained as agent task cwd.
- `worldProfileRoot`: per-world operational data, proposed as
  `<workspaceRoot>/.munder/worlds/<worldId>/`.
- Profile-owned state includes Hive, roster, task ledger, memory/palace,
  action configuration, and profile capability settings.
- App-wide preferences and provider credentials remain outside per-world
  operational folders. Profiles refer to credentials by id; they do not copy
  secret values.
- Visual assets are selected by the world manifest and loaded by the visual
  host. Dev and packaged resource resolvers provide the same logical ids.

The current `harnessHome` combines project cwd and Hive root. The implementation
must split those meanings at the service boundary while keeping existing
workspace behavior. On first Munder activation, existing root-level `hive/`,
`palace/`, `roster.json`, and backups are copied into the new Munder profile,
validated, and left intact until the new profile has successfully started.
Migration is journaled/idempotent; source data is never deleted as part of the
migration.

## Lifecycle Contracts

### Harness runtime

1. Startup selector chooses an initial profile; the persisted selection is a
   preference, not evidence of which session is currently active.
2. Register modules and validate duplicate ids, missing dependencies,
   dependency cycles, and conflicts.
3. Resolve the selected profile, its required/optional capabilities, and
   explicitly shared capabilities. Capabilities belonging only to other
   profiles remain inactive.
4. Resolve the profile data root and recover/migrate that profile's state.
5. Start or resume that profile's Hive, actions, and services; publish active
   profile/session identity only after success.
6. Selecting a different semantic profile requires confirmation and a full
   harness-runtime stop/rebind/start. The GUI may remain open. The old profile
   is stopped before another starts; no two profiles' operational services run
   together. Persisted state remains isolated and can be resumed when returning
   to that profile, subject to each provider's supported session-recovery
   contract.

### Visual presentation

1. The GUI asks the isolated visual host to bootstrap the active profile's
   presentation manifest.
2. Validate manifest and resources, initialize the Pixi renderer, mount HUD
   and scene, then report `READY` for that profile and session projection.
3. The GUI may stop/recreate this host independently at any time. A visual
   restart keeps the same harness runtime, live agent processes, PTYs, Hive,
   task truth, and active session identity.
4. Only modules that explicitly declare `live` may be applied without restarting
   their owning runtime. MCP/skill/action changes default to
   `harness-restart`; visual-package changes default to `presentation-restart`.

## Failure and Recovery

- Registry/profile validation or a required harness capability failure blocks
  that profile's startup with a structured error (`phase`, `profileId`,
  capability id, category, cause). The GUI stays alive and offers retry,
  configuration, or explicit selection/restart of another profile.
- A failed target profile does not silently fall back to Office/Munder. An
  explicit user-selected recovery profile is a separate harness restart.
- A visual bootstrap/mount/renderer failure is reported to the GUI with phase,
  profile id, and cause. The selected harness session remains alive. Recovery
  retries only the visual host and rehydrates it from the current projection.
- Repeated visual restarts dispose the prior host and all Pixi-owned resources
  exactly once; stale messages are rejected by host/session generation tokens.
- A visual host crash cannot be described as a harness/session failure unless
  independent evidence shows that the harness runtime also failed.

## Capability Control Panel

The control panel is scoped to a profile and groups registered modules by kind:
MCPs, skills, actions, presentation, and future categories. It distinguishes
available, enabled, required, blocked by dependency/conflict, active, and
pending-restart states. Shared capabilities are visibly marked and explicitly
opted into by profiles.

Per-profile enablement/configuration is stored under that profile's data root.
Credentials remain global references. The panel reuses/adapts current Munder
MCP consent and skill management rather than maintaining competing toggles.
Changing profile selects a profile; it does not hot-swap the currently active
harness. Capability changes respect each descriptor's activation mode and show
when a harness or presentation restart is required.

App-managed MCPs and skills must be injected through profile-aware session
configuration, not by mutating shared user-level CLI configuration. Existing
user-global CLI integrations that cannot yet be scoped are identified as
external/shared; they are not falsely reported as isolated world capabilities.
Munder and Monster may explicitly include those in their broad baseline. A
specialized future profile may include them only by explicit declaration.

## Components and Boundaries

- **Capability descriptors/registry:** explicit imports, identity validation,
  dependency and conflict graph, passive resolution.
- **Profile resolver:** composes one selected world plus explicit shared
  capabilities and profile-scoped overrides.
- **Harness supervisor/adapters:** binds existing Hive, actions, MCP, skills,
  providers and persistence to the active profile root; owns stop/rebind/start.
- **Presentation supervisor:** main-process lifecycle authority for the
  isolated visual renderer, typed IPC and recovery state.
- **Presentation runtime:** profile manifest/resource resolver, Pixi ownership,
  HUD and visual host. No direct semantic-state ownership.
- **Capability panel/startup selector:** selects profiles at startup and manages
  registered profile-specific settings.

## Test and Witness Requirements

Automated tests must demonstrate:

1. Office/Munder and Monster Trainer both resolve and start their own profile.
2. A Cafeteria-style fixture can register a specialized MCP/skill/action set
   without adding world branches to the generic harness.
3. Only selected-profile and explicitly shared capabilities activate.
4. Duplicate identities, missing requirements, cycles, conflicts, and missing
   required resources fail with structured errors before incorrect activation.
5. Two profiles have distinct Hive/roster/task/memory/action-config roots while
   resolving the same workspace cwd.
6. A visual host restart/crash leaves the GUI renderer alive and preserves the
   same harness session identity and agent/PTy ownership; the view recovers from
   the current projection.
7. The visual host has a distinct OS renderer PID, verified in the Electron
   witness, not inferred from separate React roots.
8. Repeated visual restarts release each Pixi application/canvas/ticker/listener
   once and return resource counts to baseline; no orphan host remains on app
   shutdown.
9. Harness-profile changes stop/rebind the runtime only after explicit
   confirmation; failed startup never activates a different profile silently.
10. Development and packaged builds follow the same registry/lifecycle path;
    only resource resolution differs.
11. Munder migration is idempotent, validated, and preserves the legacy source.

Manual Electron verification is still required for actual GPU/canvas behavior,
window compositing/resizing, process death/recovery, and a real migration with
user data. Those are not replaced by fake-renderer unit tests.

## Design Boundaries and Open Implementation Proofs

- Electron host API selection is deferred to the implementation plan's first
  feasibility witness. The hard requirement is a distinct renderer PID and
  independent restart, not a particular class name.
- The exact profile-root storage mechanism must respect existing workspace
  layouts and avoid writing generated runtime data into source-controlled paths
  unintentionally; the proposed `.munder/worlds/` location is subject to a
  path/migration test before implementation is finalized.
- Existing Munder session continuity is preserved for visual restarts. A
  semantic profile switch is a full harness-runtime restart; whether a provider
  can reattach to an old live CLI session is provider-specific and must not be
  promised beyond its demonstrated contract.
- The profile-aware session adapter must prove which app-managed and
  user-global MCP/skill sources it can scope without overwriting the user's
  global configuration. Until then, only capabilities demonstrably injected
  per profile count as world-isolated.
