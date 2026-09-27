# Starter Village Art Refresh — design spec

## Goal

Replace Starter Village's rough placeholder-looking atlas with a polished, original pixel-art environment atlas. This phase is scenery only: no monsters, workers, professor sprite, movement, Hive changes, training, or evolution.

## Preserve the approved scenario contract

- Scenario id remains `starter-village`; logical map remains 24 × 16 tiles at 16 × 16 source pixels.
- Preserve semantic anchors `professor`, `stable`, `training-grass`, `village-idle`, and `route-exit`; their identity and existing coordinate indirection remain intact.
- Preserve the composition: laboratory/Guide building northwest, stable east, training grass south, central path, route exit northeast, environmental boundaries and reusable props.
- Keep the current layer and z-order contract, integer camera scale (4×/3×/2×/1×), and manifest/resource validation.
- Use a project-original pixel-art atlas (PNG is acceptable); nearest-neighbour sampling and round-pixel rendering remain enabled. Do not claim pixel-perfect for a fractional scale.
- The atlas is only environment art. No creatures, characters, franchise references, or third-party assets.

## Asset and provenance

Create a replacement atlas at the current atlas resource boundary and compatible source dimensions/frame layout so scenario placements do not need magic coordinate changes. Record it in the world resource manifest and attribution file as original project art. Keep old assets unless a later, separately approved cleanup removes them.

## Acceptance witnesses

1. Automated tests prove the manifest resolves the new atlas, expected frame ids/dimensions are available, and scenario anchors/layers remain unchanged.
2. Build output contains the atlas and Monster Trainer boot remains READY.
3. Manual visual check at 1× and at least one larger integer scale confirms coherent scene composition, readable structures/path/grass, clean nearest-neighbour edges, and no characters/creatures.

## Scope boundary

Only replace and wire the Starter Village environment atlas/provenance. Do not change world bootstrap, map dimensions, anchors, worker identities, Hive/Harness semantics, camera policy, or add gameplay.
