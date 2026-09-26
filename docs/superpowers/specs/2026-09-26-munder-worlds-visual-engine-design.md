# Munder Worlds Visual Engine — Design

## Intent

Munder Worlds must let the application express the same operational state through different visual worlds without a renderer becoming a source of operational truth. This first increment establishes the reusable visual engine and validates it with a small Monster Trainer canvas. It deliberately does not implement a full game, an asset generator, progression, or a new backend protocol.

The product outcome is a safe foundation for agent-specific visual identities. A future user or model may propose a customized appearance for an agent, and each world may render that identity differently. That future workflow must not depend on Office cast slots or silently mutate user-owned visual data.

## Evidence in the Current Application

- The desktop app is Electron + React + PixiJS with Zustand renderer state.
- `useHive` updates agent activity from real hook, PTY, breaker, and hive events. The active roster is held in `store/store.ts`.
- Tasks are persisted in the hive ledger and currently expose one assignee plus `todo`, `doing`, `blocked`, and `done`. Existing UI consumers poll `window.cth.hiveTasks()` independently.
- A pending human question is reliably represented as a `blocked` task with an unanswered `humanQA` record.
- `OfficeFloor` owns a Pixi lifecycle and currently polls the task ledger directly. It remains unchanged in this increment.
- The avatar system already composes deterministic human portraits from recipes and can persist Office-only overrides in `avatar-overrides.json`. Those overrides are keyed by Office cast slot, not `agentId`, so they are not a cross-world identity system.

## Goals

1. Create one renderer-side canonical visual projection of real agents and task data for new worlds.
2. Provide a world registry and selected-world host with Office as the default and fallback.
3. Introduce versioned visual identity profiles keyed by `agentId`, separate from runtime data and Office cast slots.
4. Render a minimal Monster Trainer world using the existing PixiJS dependency and one or two original, procedural placeholder creature sprites tied to real agents.
5. Preserve the current Office UI and its behavior when Worlds is disabled or the selected world cannot render.
6. Establish testable boundaries for later asset banks, user-approved generated appearances, richer task state, and more worlds.

## Non-goals

- Do not replace the hive, its task ledger, hooks, leases, bridges, permissions, or IPC protocols.
- Do not migrate or modify `avatar-overrides.json`.
- Do not add an avatar editor, image-generation workflow, downloadable asset packs, or automatic profile mutation.
- Do not claim artifact, collaboration, remote-node, completion-by-agent, or evolution state before a real canonical source exists.
- Do not add a game engine, a new frontend state-management library, or external sprite assets.

## Architecture

```text
Munder operational sources
  ├─ Zustand agent roster and activity
  └─ hive task ledger through preload IPC
           │
           ▼
WorldProjectionController
  ├─ CanonicalWorldSnapshot
  └─ derived VisualTransition[]
           │
     ┌─────┴─────────────────┐
     ▼                       ▼
VisualIdentityRepository   WorldRegistry
  agentId → profile          office / monster-trainer
     │                       │
     └───────────┬───────────┘
                 ▼
              WorldHost
                 │
       Office legacy or Pixi Monster canvas
```

`WorldProjectionController` is a read model. It may derive an in-memory transition after comparing two authoritative snapshots, but the next snapshot always wins. It neither writes the hive nor changes agent state.

The initial controller receives agent changes through the existing Zustand store and owns the sole task-ledger polling loop for Worlds. It must start only while a Worlds renderer is mounted and clean up its subscription and timer on unmount. Existing Office and Command Center polling are intentionally left alone in this increment; their consolidation is a future regression-safe change.

## Canonical Snapshot

The exact TypeScript names may be refined to match local conventions, but the boundary has these semantics:

```ts
type WorldAgentState = 'idle' | 'working' | 'waiting' | 'blocked' | 'other';

interface WorldAgent {
  id: string;
  displayName: string;
  provider?: string;
  operationalState: WorldAgentState;
  archived: boolean;
}

type WorldTaskState = 'todo' | 'doing' | 'blocked' | 'done';

interface WorldTask {
  id: string;
  title: string;
  assigneeId?: string;
  state: WorldTaskState;
  awaitsHuman: boolean;
}

interface CanonicalWorldSnapshot {
  agents: readonly WorldAgent[];
  tasks: readonly WorldTask[];
}
```

`awaitsHuman` is true only for the current proven condition: a `blocked` ledger task with an unanswered, undismissed `humanQA` item. A task being done does not imply that an individual agent succeeded; it only means the task ledger says `done`.

The initial transitions may cover agent arrival/removal and changes to the normalized agent or task state. They exist solely for short-lived renderer effects and cannot be persisted as operational facts.

## Visual Identity Profiles

Visual identity is user-owned presentation metadata. It is keyed by a stable `agentId`, not display name, provider, Office character, or task id.

```ts
interface VisualIdentityProfileV1 {
  version: 1;
  agentId: string;
  seed: string;
  appearances: Record<string, unknown>;
  updatedAt: string;
}
```

- `seed` is deterministic and allows a renderer to produce a stable fallback before bespoke art exists.
- `appearances` is namespaced by world id. Its payload is owned and validated by that world's adapter; the generic repository preserves it without interpreting it.
- The repository returns a derived default profile for an agent that has no stored record. Reading a default must not write to disk.
- Stored profiles live in a dedicated, versioned user-data file, separate from both `config` and `avatar-overrides.json`.
- Only an explicit, validated update API may persist a profile. A future agent/model workflow submits a proposal; a human-approved caller invokes the update API.
- Profiles for no-longer-present agents are retained until an explicit future cleanup action. This prevents identity loss when a session is restored.

The first Monster Trainer adapter owns a small `monster-trainer` appearance payload. It may include a palette and a creature variant. It must have a deterministic fallback derived from the profile seed, and no external asset loading.

## World Registry and Host

The registry is the only list of available worlds. Each entry contains a stable id, title, availability flag, and a React render surface. A world receives the canonical snapshot and a read-only identity resolver; it does not import the hive, preload bridge, or Zustand store directly.

The host keeps the existing Office floor as the default. Worlds are gated behind a dedicated configuration flag and selected world id; these are not aliases for the existing Office-theme settings. If a non-Office renderer fails at mount time, the host must show a recoverable fallback that returns to Office without changing operational state.

The selected world is a local user preference. The current selected world is shared across a window's render surfaces, but changing it never changes a hive, agent, task, lease, or bridge.

## Monster Trainer Vertical Slice

The Monster Trainer world validates the engine rather than the final art direction:

- It mounts a Pixi canvas in the main world area.
- It renders an original small region and at most two agents from the canonical snapshot.
- Each represented agent receives a compact, original procedural creature sprite derived from that agent's visual identity seed and Monster Trainer appearance.
- It communicates only supported state: idle, working, blocked, and awaiting human input. The last condition is visually distinct from idle and is driven by a real task relationship.
- Clicking a creature selects the underlying real agent; clicking a task marker opens the existing task detail flow where available.
- It has no combat, invented meters, fake artifact drops, progression, evolution, copyrighted characters, or franchise assets.

## Failure Handling and Accessibility

- Missing, malformed, or unsupported visual profiles fall back to a deterministic placeholder; they cannot prevent an agent or task from rendering.
- A failed Monster renderer falls back to Office and logs a scoped error for debugging.
- The renderer must not encode a critical state through color alone. Its initial state markers pair shape or animation with color.
- A reduced-motion preference must allow effects to become static state markers.
- The technical task and agent detail surfaces remain the accessible source for exact textual information.

## Testing and Verification

Tests precede implementation. The plan must cover at least:

1. Normalization of real agent and task data, including malformed ledger fields.
2. The exact `awaitsHuman` condition and its false cases.
3. Snapshot-to-transition derivation without duplicate transition for unchanged input.
4. Stable default identity derivation for the same `agentId`, without an implicit persistence write.
5. Stored profile validation, malformed-file fallback, and per-agent isolation.
6. Registry selection, Office default, and disabled-world fallback.
7. Monster adapter state mapping for the supported states only.
8. Type checking and the project’s focused test suite after implementation.

## Rollout and Rollback

Worlds starts disabled and Office remains default. The work is reversible by disabling the Worlds flag or selecting Office; neither action writes to the runtime or destroys visual profiles. Existing Office avatar overrides remain untouched and continue to work as they do today.

## Future Extensions

Once the vertical slice is stable, future work may add an approved profile editor, model-generated asset proposals, an asset bank with provenance, richer semantic contracts for artifacts and collaboration, an Office identity adapter, more Monster creature variants, progression, and additional worlds. Each addition must consume real state or explicitly labeled presentation metadata.

## Transactional World Runtime Amendment

### Boundary

`WorldEngine` owns only visual lifecycle: resource validation, renderer bootstrap,
mount, atomic activation, rollback, and disposal. It does not read or write Hive,
agents, tasks, profiles, or configuration directly. The existing world surfaces
remain the boundary to live read models and interaction callbacks.

Every registry entry, including Office, declares a resource manifest and a visual
surface. The resource resolver is injected into the engine. In development it
preflights Vite-generated `?url` addresses; in a packaged app it preflights the
bundled addresses. Both paths execute the same `WorldEngine` state machine.

### Lifecycle and Transaction Rule

The engine emits structured lifecycle state with a phase, world id, and optional
cause:

`VALIDATING -> BOOTSTRAPPING -> MOUNTING -> READY`.

The selected world is a candidate until its surface reports `READY`. The currently
READY world stays mounted and undisposed during candidate validation/bootstrap/mount.
On candidate readiness, the host performs one explicit visual swap, then disposes
the previous world exactly once. React does not provide an offscreen DOM staging
primitive suitable for both existing Pixi surfaces, so the boundary is: candidate
preflight is transactional; the React surface is mounted in a hidden staging layer;
the visible-layer swap occurs only after that surface signals ready. A world that
cannot signal ready is never committed.

### Finite Failure Policy

1. A target candidate fails: retain the last READY world and show a structured,
   recoverable error.
2. If no READY world exists, attempt the registry-declared Office fallback once.
3. If that Office attempt fails, render the engine Recovery Surface.

The fallback attempt is carried in the request, so Office cannot recursively
fallback to itself. An async renderer failure after READY is handled as a failed
replacement request under this same finite policy; it cannot leave a blank canvas.

An unavailable Vite server is classified as an external resource-resolver failure.
The engine never tries to start or revive Vite; it preserves the current valid
world or shows Recovery Surface. `npm run dev` remains responsible for the dev
server process.

### Semantic-State Invariant

Switches affect only the visual projection. The Zustand/Hive/task data and their
existing subscriptions stay outside `WorldEngine`; surfaces receive their existing
read-only projections and callbacks. A world switch therefore cannot mutate
operational truth.

### Verification Contract

The runtime must prove: Office bootstrap; Monster Trainer bootstrap; successful
Office -> Monster -> Office swaps without semantic-state mutation; missing-resource
closed failure and fallback; equivalent engine path with dev and packaged resolvers;
async renderer failure recovery without a blank screen; and repeated failed switches
that neither dispose the prior READY mount nor accumulate staged resources/listeners.
