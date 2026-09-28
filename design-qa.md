# Startup screen design QA

Status: implementation is built and statically checked; visual comparison is pending.

## Target

The approved references are the user's pixel-art/wood-and-parchment ISyCo World
screen mockups from 2026-09-27. The implemented direction uses a timber frame,
parchment workspace panel, the project's original Starter Village building art,
and a single page for world, workspace, and first-run choices.

## Checks completed

- The first-run, workspace selection, and missing-world recovery routes now share
  `WorldStartScreen`.
- World + workspace selection coalesces into one Harness relaunch; a same-workspace
  world change uses the existing profile activation lifecycle.
- Responsive layout rules exist for narrow windows, and setup remains scrollable.
- TypeScript, production build, focused test suite, and targeted world/start tests
  pass.

## Visual checks still required

- Compare screenshots at desktop and narrow viewport sizes against the approved
  references.
- Confirm the building strip's crop/scale and wood/parchment contrast in Electron.
- Walk first-run setup, current/recent workspace selection, browse/create, world
  confirmation, and failed profile recovery in the running app.

No native app window was available to the visual inspection surface during this
implementation session, so no screenshot comparison is claimed.
