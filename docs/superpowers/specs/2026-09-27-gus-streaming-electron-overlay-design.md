# GUS Streaming and Electron Overlay — design spec

## Goal

Make GUS feel like a live TUI assistant while keeping every visible World surface and helper overlay under the owning Electron window. The generic World runtime remains reusable for future world templates; this change does not create a detached helper process, OS-priority scheme, or per-world fork of the engine.

## Existing boundary and observed cause

- `WorldHelperHost` and provider requests already run in Electron main, survive renderer reloads, and use existing main-owned approval/spawn authority.
- Provider adapters currently call non-streaming chat completions and return only after parsing the complete JSON response. The helper UI therefore cannot show generated text while the request is in flight.
- `WorldPresentationSupervisor` creates an isolated `WebContentsView` for the active visual world and attaches it to the primary `BrowserWindow` content view. Electron composes this child view above the parent renderer. A CSS `z-index` in the parent cannot raise GUS over that child, which is why the supplied screenshot shows the Starter Village covering the setup dialog.
- The world renderer is already Electron-owned and is not a detached OS window. Preserve its separately restartable visual lifecycle and keep its preload least-privileged.

## Design

### Live response stream

Provider adapters expose a streaming completion path for supported SSE endpoints (NVIDIA NIM/OpenAI-compatible chat completions and Anthropic Messages). The main-process host creates a request ID, keeps the API key and raw provider protocol in main, and emits typed, request-scoped text deltas through a dedicated preload subscription. UTF-8 and SSE frame boundaries may split arbitrarily; the decoder must handle partial lines/events and provider termination/error frames.

The model's final response remains the same strict JSON proposal contract. The host incrementally decodes only the JSON `reply` string for human-readable streaming; it does not display JSON scaffolding. The UI renders a temporary assistant draft as chunks arrive. Only after stream completion does the host validate the full response with the existing closed schema and publish the final transcript/proposal. Draft text is never authority and cannot launch workers or switch worlds. Invalid/truncated/provider-failed streams produce a visible error, discard the draft from the durable transcript, and create no proposal. A newer request, explicit cancellation, or host stop aborts the active request; stale deltas are ignored by request ID.

### Electron-owned overlay composition

Keep the active world's isolated `WebContentsView`; do not move Pixi or world lifecycle into the parent renderer. Add a narrow, sandboxed GUS overlay `WebContentsView` owned by the same primary `BrowserWindow`. Electron main owns view ordering and places the GUS overlay above the world view. The overlay uses a dedicated least-privilege preload exposing only the redacted GUS snapshot, streaming events, and existing explicit user actions. The main-process `WorldHelperHost` remains the sole owner of provider credentials, stream lifecycle, proposal validation, and worker approval.

The overlay is composited inside the app window, not a floating `BrowserWindow` or detached process. It can be minimized/hidden without disposing the world, Hive, PTYs, or Harness session. Overlay creation/disposal is tied to the primary window lifecycle and must not accumulate listeners or WebContents. All world templates continue through the same WorldEngine/bootstrap/supervisor path; there are no Office or Monster Trainer branches for GUS.

## Invariants and failures

- No provider key, raw request headers, or unredacted provider payload cross renderer IPC or enter persisted transcript/logs.
- Partial assistant text is explicitly non-authoritative; proposals are created only after complete response validation and still require explicit human approval.
- Provider failure ends only the GUS request and leaves the world, Hive, workers, and session unchanged.
- A missing/crashed overlay degrades GUS UI only; it must not dispose or restart the world renderer.
- Closing the primary window disposes overlay listeners/WebContents exactly once. Hiding/minimizing GUS preserves the main host and current world.
- The visible world remains within the owning Electron window; no detached/floating OS window is introduced.

## Acceptance witnesses

1. Provider decoder reconstructs frames across split UTF-8/SSE chunks for NVIDIA/OpenAI-compatible and Anthropic formats, streams only decoded `reply` text, and handles escaped JSON characters.
2. Renderer receives ordered deltas in real time; completion replaces the draft with the validated transcript and proposal.
3. Malformed, truncated, stale, cancelled, timed-out, or failed streams produce no proposal and no worker launch; secrets never appear in deltas or snapshots.
4. Electron view-composition test/witness confirms the GUS overlay is ordered above the world `WebContentsView` in the same `BrowserWindow`, and overlay teardown leaves the world READY and owned once.
5. Existing focused GUS/world tests, typecheck, build, and app launch pass. Manual visual check confirms GUS setup/chat is not occluded over Starter Village and text visibly streams before completion.

## Scope boundary

Do not change Hive storage/semantics, world-specific capabilities, Harness/session ownership, OS process priority, model authority, generic campaign abstractions, or world gameplay. This extends the existing World Helper and Electron view composition only.
