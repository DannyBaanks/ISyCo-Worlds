# Security Policy

## Scope

Munder Difflin is a **local-first desktop app**. It spawns local processes in PTYs and
reads/writes files under directories you register. It opens **no network listeners
beyond a local Unix domain socket** used for the in-app hook server, and has no auth or
remote surface by design.

## Supported versions

This is an early prototype. Security fixes target the `main` branch only.

| Version | Supported |
|---|---|
| `main` | ✅ |
| older tags | ❌ |

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

- Use GitHub's **private vulnerability reporting**: the *Security → Report a
  vulnerability* tab on https://github.com/chaitanyagiri/munder-difflin, **or**
- Email **girichaitanya11@gmail.com** with a description, reproduction steps, and
  impact.

You can expect an acknowledgement within a few days. Once a fix is available we'll
credit you (unless you prefer to stay anonymous).

## Notes for reviewers

- Renderer ↔ main IPC goes through a typed `contextBridge` (`window.cth`); the renderer
  has no direct Node access (`nodeIntegration: false`, `contextIsolation: true`).
- All `fs:*` / `git:*` IPC calls are sandboxed and path-validated in the main process,
  rooted at an agent's working directory.
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
