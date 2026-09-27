# Monster Trainer Village Skin and Free Build — Design Spec

## Goal

Make Monster Trainer feel like one coherent pixel-art world rather than a village canvas embedded in Munder's cream-colored office UI. Ship a polished curated Starter Village as the default layout and a separate free-build mode for arranging the village's visual composition. Give the laboratory and stable readable 2.5D volume at the scene's native pixel scale.

## Current architecture and evidence

- `App.tsx` owns the shared application shell, navigation, agent strip, and command-center panels. `WorldHost` selects the active visual world; Monster Trainer is mounted through an isolated world-presentation viewport.
- `worldRegistry.ts` already declares the Monster Trainer world and its manifest resources. The new skin is selected from the active world profile and must not mutate Office's appearance or the user's light/dark preference.
- Starter Village is a data-backed scenario with a 24 × 24 map, 16 logical pixel tiles, layers, and semantic anchor identities. Scene drawing is owned by `MonsterTrainerWorld` / `StarterVillageScene`.
- The current house source frames are 710 × 539 atlas pixels but are rendered at 64 × 48 logical pixels. The scale reduction is a concrete contributor to the pasted-sticker look; adding only a CSS shadow would not address it.
- Agent/task truth remains in the application/Hive projection. This feature changes only world composition and its visual projection.

## User intent and constraints

- The user wants both a curated default village and a free mode, not an editor-only screen.
- The world HUD should use a custom pixel-art treatment: wood framing, stone/plaster or laboratory-wall surfaces, and colors sampled from the existing village art instead of Munder's yellow/cream default.
- Buildings should read with Pokémon-like 2.5D depth while remaining original project art and consistent with the current environment atlas.
- Keep the change within Monster Trainer. Do not alter Office, Hive/Harness, agent/task semantics, or unrelated application styling.

## Approved direction

Use four coordinated layers, each with one responsibility:

1. Generic village composition mechanics: versioned placements, grid/footprints, collision validation, editor operations, semantic scene-object identities, authored local interaction points, and isolated visual-layout persistence. This layer knows only generic terrain/structure/prop definitions and optional metadata; it must not import Monster Trainer art, theme, preset, or worker/Hive code.
2. Monster Trainer content: the curated `starter-village` layout, asset catalog, profile-specific skin, and themed presentation. This layer supplies content through the generic composition contract; it does not fork or duplicate the editor/persistence mechanics.
3. A Monster Trainer-only application skin, driven by the active world profile and scoped at the renderer root. It supplies world-specific surface, border, accent, and control tokens to the shared HUD. Existing light/dark selection remains an independent preference and must retain readable contrast in both modes. Office continues to use its existing tokens unchanged.
4. Original building artwork designed for the same palette and camera: preserve the 16 × 16 logical terrain grid and use larger, readable building frames with foreground/facade, roof, side-wall/foundation, and contact-shadow depth. Terrain and reusable props can continue using the current atlas where it fits.

The house art can be prepared from newly authored project-original sprites and assembled as a small, explicit set of layers/frames. Do not simulate volume solely with a large CSS `drop-shadow`, skew an existing complete sprite, or blur/scale it fractionally. Record provenance for every added raster/vector asset.

## User experience

### Default village

- On first entry, show the curated Starter Village preset with no build controls over the scene.
- The preset preserves the approved spatial story: laboratory/Guide northwest, stable east, training grass south, central path, route exit northeast, and environmental props/boundaries.
- `Reset to Starter Village` restores the curated composition without changing semantic world state.

### Free Build mode

- An explicit control switches between `Explore` and `Build` modes; mode and selected tool are visibly indicated.
- Build mode provides a compact catalog for terrain brushes, props, and structures, plus place, move, remove, save, cancel/undo-last-edit, and reset-to-preset controls. These operations are generic composition mechanics; Monster Trainer contributes the catalog and authored preset only.
- Editing uses the existing logical tile grid. Objects declare footprints; placements outside map bounds or colliding with occupied cells are rejected with visible, local feedback. Invalid edits do not partially mutate the saved layout.
- Structures may optionally declare `stationKind`, `affinities`, and named interaction-slot definitions in data. This is descriptive metadata only: V1 does not assign workers to stations, mutate workers/Hive, or execute station behavior.
- Movable structures author interaction points relative to their own origin, with named semantic roles such as `entrance`, `work`, and `idle`. Moving a structure translates these points with it. Consumers must use these authored points rather than infer usable coordinates from sprite/raster geometry. V1 does not use the points for pathfinding or autonomous work.
- Laboratory and stable structures may be moved but not deleted in this first version. Their semantic anchors (`professor`, `stable`) are bound to stable scene-object identities and resolve relative to each moved structure, so identity survives coordinate changes. Other existing semantic anchors retain their identity and scenario-defined meaning.
- Worker sprites remain static and continue to be derived from the existing visual projection. Free Build cannot create, delete, reorder, or change agents or tasks.
- Persist only the custom visual layout and editor preference needed to reopen it. Keep it separate from Hive data and from operational world-profile lifecycle state. The curated preset remains immutable and can always be restored.

## Visual system

- Scope theme tokens to the active Monster Trainer profile, not to `body` globally and not to the Office surface. Prefer CSS variables consumed by the current shared controls; isolate any remaining world-only chrome styles under the profile selector.
- Use a restrained field palette: warm timber frame, pale stone/plaster wall, darker inset terminal glass, green/earth accents, and high-contrast text. The TUI remains legible and visually dominant; texture must not sit behind terminal glyphs.
- Present the command-center/terminal as a framed lab or timber workstation, with simple pixel-corner construction rather than rounded SaaS cards. The bottom agent strip and navigation receive matching trim/surface treatments while preserving their existing interaction and layout.
- Light/dark mode remains orthogonal. Each skin token needs a readable counterpart in both modes; do not save a forced global theme when selecting Monster Trainer.
- Houses use layered 2.5D art: visible foundation/contact shadow, a discernible side plane, facade, and roof overhang/highlights. Buildings render at an intentional multi-tile logical size without reducing their detail to the current 64 × 48 squeeze. Depth ordering is deterministic: ground, foundation/side planes, rear roof/props, facade, agents/anchors, then foreground eaves/foliage where needed.
- Keep nearest-neighbour sampling, integer world scale, and rounded pixel coordinates. The layout editor may use pointer overlays, but they must not filter or fractional-scale the world canvas.
- On narrower viewports, retain the existing scrollable/integer-scale world policy. The skin can compact controls or allow horizontal navigation overflow; it must not shrink the scene fractionally to force-fit.

## Data and persistence contract

- Scenario identity stays `starter-village`; semantic anchor IDs remain stable.
- Add explicit object identities and footprints to the editable layout representation. Anchor locations are resolved from object identity plus authored local offsets for structures that carry anchors; arbitrary scene coordinates are not the identity.
- Structure definitions may include optional `stationKind`, `affinities`, interaction-slot definitions, and named local interaction points. These fields are inert declarative data in V1 and must be validated/serialized without introducing worker behavior.
- Store `{ version, scenarioId, placements }` as a validated, versioned visual-layout document. Reject malformed, unknown asset IDs, out-of-bounds positions, footprint overlaps, and incompatible scenario versions without replacing the last valid saved layout.
- Resource manifest lists the new house sprite resource(s). Both the regular development resolver and packaged resolver use the established WorldEngine/bootstrap route.
- Layout reset returns to the authored immutable preset; saving a build-mode layout does not modify the preset source.

## Failure behavior

- Missing/invalid house resources follow the existing WorldEngine structured failure and Office/recovery fallback. Do not add an independent retry loop or reload Vite.
- Invalid layout data fails closed to the curated preset and surfaces a recoverable notice; never leave a half-painted map or partially-mutated placement list.
- A rejected placement leaves the last valid in-memory and persisted layout intact.
- If local persistence is unavailable, Explore mode and the curated preset remain usable; Build mode reports that the layout could not be saved rather than implying persistence succeeded.

## Acceptance witnesses

1. Tests prove first run resolves to curated Starter Village, Free Build can place/move/remove supported objects, rejects overlap/out-of-bounds edits, saves/reloads a valid versioned layout, and reset restores the preset.
2. Tests prove structure movement preserves `professor` / `stable` semantic anchor identity while resolving their positions relative to their owning objects; agents/tasks/Hive projection is unchanged by every edit action.
3. Tests prove new house resources are manifest-backed and development and packaged resource resolution use the same world lifecycle path.
4. Theme tests prove active Monster Trainer selects the pixel-art skin; Office retains its prior token values; light/dark switching remains independent and readable.
5. Renderer/scene tests prove layered house z-order and deterministic multi-tile footprint placement at supported integer scales.
6. Build succeeds and includes the new original art assets.
7. Manual visual witness at 1× and a larger integer scale verifies the houses read as dimensional structures, the TUI remains readable in the themed frame, and the world still fits/scrolls as specified.
8. ORGANIC COMPOSITION witness: the authored default and an edited layout have no dominant rectangular terrain blocks; major buildings are not corner-clamped; terrain boundaries are irregular; negative space is intentional; entrances connect naturally to paths; props appear in deliberate clusters; structures have varied spacing; and training grass is integrated into the village instead of reading as a pasted rectangular field. Verify this in the scene data/layout review and in a manual visual check.

## Explicitly out of scope

- Pathfinding, gameplay/runtime collision behavior, autonomous worker activity, training, evolution, or changes to Hive/Harness/agent/task truth. Grid-footprint occupancy validation exists only in the composition editor.
- Executing `stationKind`, `affinities`, slots, or interaction points as behavior; the metadata and authored coordinates exist only as follow-up-compatible data contracts.
- Campaign/chapter/gym frameworks, new worlds, multiplayer or community sharing of layouts.
- A general-purpose world skin marketplace or user-authored asset import pipeline.
- Editing the Office layout or applying Monster Trainer tokens to Office, settings, or other profiles.
- Reworking the shared command-center information architecture; only the Monster Trainer presentation is themed.

## Open implementation boundary

Before implementing persistence, map the existing local world-profile storage and IPC seams. Reuse a world/profile-scoped store if one already fits; otherwise add the smallest validated storage bridge for this versioned visual-layout document. Do not place layout state in Hive folders or in agent identity profiles. Keep generic layout types/runtime independent of Monster Trainer content; the Monster Trainer integration may depend on the generic composition API, never the reverse.
