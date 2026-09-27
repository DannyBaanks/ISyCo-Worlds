# Worlds Global Surface — Design

## Intent

Worlds are an optional visual projection of the existing Munder operational
state, not a replacement application running inside the Office floor. The
current title-bar selector stages two Pixi applications in one floor slot. That
creates a GPU/context failure mode during Office ↔ Monster Trainer switches and
makes a renderer reload look like a lost session.

Worlds will become a first-class global surface beside Office and Marketplace.
The user chooses a world there. At most one Pixi world renderer is mounted at a
time. A world transition may reconstruct that renderer, but must never alter a
Hive, task ledger, agent roster, PTY, selection, or visual identity profile.

## Goals

1. Make **Worlds** a global title-bar tab when the existing Worlds feature flag
   is enabled.
2. Give Worlds a catalog and a clear selected-world surface, rather than a
   compact select control embedded in the Office title bar.
3. Guarantee that only one Pixi `Application` is live for a world transition.
4. Preserve the semantic application state across a normal world transition and
   an intentional renderer reload.
5. Retain resource validation, structured errors, finite fallback, and cleanup
   from the existing WorldEngine.

## Non-goals

- No changes to Hive persistence, task semantics, agent activity, terminal
  processes, harness sessions, worker lifecycle, or visual-progression work.
- No movement, training, campaigns, new art, or replacement of Starter Village.
- No generic routing library or broad navigation refactor.
- No promise of a visually atomic canvas swap: the intentional boundary is one
  live renderer, not two simultaneous GPU contexts.

## Navigation and State

`GlobalView` gains `worlds` alongside `office` and `marketplace`.

- **Office** continues to be the operational home and renders Office directly.
- **Marketplace** is unchanged.
- **Worlds** contains the catalog and mounts the selected non-Office world.
- Choosing Office from the Worlds catalog returns to the existing Office tab;
  it does not create a second Office renderer inside Worlds.
- The old title-bar `WorldSelector` is removed. The existing Settings gate and
  `selectedWorld` preference remain the source of permission and selection.

The selected world is persisted as a visual preference. A renderer reload
restores it, then rebuilds its projection from the existing Zustand/Hive
sources. The global tab is also persisted as a visual preference so a reload
while looking at Monster Trainer returns to Worlds and the same selected world.
Neither preference is an operational fact.

## Lifecycle Boundary

```text
Global nav → Worlds surface → WorldEngine
                                │
                validate manifest and preload resources
                                │
                      dispose current world renderer
                                │
                     mount candidate renderer → READY
                                │
           failure → one Office attempt → Recovery surface
```

Resource validation happens before the existing world canvas is released where
possible. Once a renderer must be mounted, the currently live Pixi world is
disposed first. This is deliberate: a hidden candidate canvas may consume a
second GPU/WebGL context, the failure shape this design removes.

The host owns DOM unmounting and calls the renderer's one cleanup path exactly
once. The engine owns phase changes and structured `WorldLifecycleError`
records. No renderer calls `window.location.reload()` for a normal switch. If
the outer renderer has failed unrecoverably, a user-visible recovery action may
reload the renderer; the main process and Hive continue to own the semantic
session, so the next mount reconstructs the same state.

## Error Handling

- A missing manifest/resource produces the existing structured phase, world id,
  runtime, category, and cause.
- A target failure after an already-ready surface returns to that surface when
  it remains mounted; otherwise it makes exactly one Office fallback attempt.
- A failed Office fallback reaches Recovery. It never loops.
- Recovery says whether retrying reloads the selected visual surface or returns
  to Office. It must not imply that an agent or task was reset.

## Components

- `globalNavModel` and `GlobalNav`: add the Worlds tab and its labels/density
  rules.
- `WorldsView` (new): catalog, selected-world affordance, lifecycle status, and
  a single `WorldHost` slot. It is the only global surface that mounts
  alternative-world Pixi renderers.
- `App`: maps `globalView` to Office, Marketplace, or Worlds while leaving the
  sidebar, Command Center, agent strip, store, and terminal ownership intact.
- `WorldHost`/`WorldEngine`: replace hidden concurrent renderer staging with a
  serialized renderer mount contract while retaining manifest/resource and
  failure classification.
- Config/preload/main: persist only the last global visual view needed to resume
  Worlds after a renderer reload; validate it like the existing world id.

## Tests and Verification

Tests precede implementation and demonstrate:

1. Worlds is an enabled global tab, Marketplace remains unchanged, and the old
   compact selector is absent.
2. Selecting Monster Trainer affects visual preferences only and leaves the
   canonical agent/task projection untouched.
3. Office → Monster Trainer → Office has no simultaneous mounted world canvas,
   releases each prior renderer once, and preserves snapshot identity.
4. A resource failure performs the finite fallback/recovery policy without
   changing agents, tasks, or selected semantic session.
5. A renderer reload restores the persisted Worlds route and selected world
   through the same lifecycle path used by development and packaged builds.
6. Repeated switches do not accumulate Pixi applications, tickers, listeners,
   or loaded renderer-owned resources.

Manual verification will cover a real Electron window on this GPU: repeated
Office ↔ Monster Trainer transitions, then a renderer reload while viewing each
surface, checking that active terminals, agents, task details, and selection
remain intact.

## Design Difference from the Previous Transactional Host

The previous design's atomic visual swap required a candidate renderer to be
alive while the old renderer was still alive. That is appropriate for DOM-only
views but not demonstrated as safe for these Pixi/WebGL surfaces. This design
keeps resource prevalidation transactional but serializes canvas ownership.
Semantic continuity remains strict because visual renderers never own the
underlying state.
