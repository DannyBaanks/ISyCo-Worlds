# Security Policy

## Scope

ISyCo Worlds is a **local-first desktop app**, not a network-free app. It spawns
local processes in PTYs and reads/writes workspace files using the user's OS permissions.
Its main process has several optional network surfaces:

- Local hook/control sockets and a loopback HTTP integration broker. The broker
  requires per-worker capability tokens and authorizes registered integrations.
- Slack and generic webhook HTTP receivers bind to `127.0.0.1`, but an enabled
  receiver can open a **public tunnel**. Loopback binding does not make a tunneled
  receiver private. Webhooks require an endpoint secret to submit work and a
  capability token to poll it; Slack has its own signing-secret gate.
- Webhooks are not enabled by default: the operator must enable an endpoint.
  Per-endpoint pre-auth limits bound rejected traffic; only authenticated requests
  clearing that budget consume the global admission budget. This is not a DDoS
  guarantee: exhausting multiple endpoints or the global authenticated budget can
  still limit service.
- Provider API calls, downloads, analytics when opted in, and update checks are
  outbound network activity. Optional CLI and mobile companion services add
  separate surfaces with their own configuration and authentication; consult their guides.

Do not expose a listener or tunnel without reviewing its authentication and the
authority of the agents receiving its messages.

## Supported versions

This is an early prototype. Security fixes target the `main` branch only.

| Version | Supported |
|---|---|
| `main` | ✅ |
| older tags | ❌ |

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Use GitHub's
[private vulnerability reporting form](https://github.com/DannyBaanks/ISyCo-Worlds/security/advisories/new).

You can expect an acknowledgement within a few days. Once a fix is available we'll
credit you (unless you prefer to stay anonymous).

## Notes for reviewers

- Renderer ↔ main IPC goes through a typed `contextBridge` (`window.cth`); the renderer
  has no direct Node access (`nodeIntegration: false`, `contextIsolation: true`).
- The four workspace content channels (`fs:listDir`, `fs:readFile`, `fs:readBinary`,
  `fs:writeFile`) require a live primary/floor WebContents, its main frame and the
  expected local document. Navigation/redirects away from that document are blocked.
  Requested roots must be confined beneath main-owned registered repositories,
  harness/profile homes or registered PTY/Hive working directories. Filesystem and
  whole-user-home roots are refused. The shared path guard also checks traversal
  and symlink containment. A supplied root alone is never a grant.
- `fs:statAbs` and `fs:revealPath` are separate metadata/OS reveal operations, not
  workspace content access. Git operations have their own validation; do not infer
  that every IPC operation uses the workspace content gate.
- The primary/floor renderer remains an operator interface: it can configure
  projects and launch local processes. This content-channel gate is **not** a claim
  that a fully compromised operator renderer is an OS-level sandbox. Protecting
  every configuration/spawn operation against such a renderer is a separate boundary.
- GUS proposals are inert until approved. Approval is bound to the exact pending
  proposal and current conversation generation, and consumed once before launch.
  New chats or stopping GUS invalidate in-flight approvals. Already-started launches
  are not retroactively cancelled.
- The hive commits to a local git repo from a **single committer** (the main process);
  agents only write plain files.

## Auto-update signatures — NOT_DEMONSTRATED (fork note, 2026-09-26)

No code or test in this repo verifies the cryptographic signature of a
downloaded update before install: `src/main/updater.ts` delegates fully to
electron-updater defaults (no `verifyUpdateCodeSignature`, no checksum
comparison), `test/update-download-asset.test.cjs` has no signature
assertions, and Windows has no signing config at all in
`electron-builder.yml`. Current fork builds also ship **unsigned** (no Apple
secrets, no Windows cert), so even platform-level signature matching does not
apply to them. Proving (or fixing) this needs a controlled experiment —
staged update feed, stripped-signature installer, revoked-cert cases — which
is researcher work with hypothesis and controls, not a blind code change.
