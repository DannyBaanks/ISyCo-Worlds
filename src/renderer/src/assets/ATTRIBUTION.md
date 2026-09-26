# Asset attribution

The office tilesets and Tiled maps in this directory are vendored from
[`shahar061/the-office`](https://github.com/shahar061/the-office) (project code: ISC).

## Pixel art from LimeZu (licensed)

The tilesets (`tilesets/*.png`) are from **Modern Interiors - RPG Tileset [16X16]** by
[LimeZu](https://limezu.itch.io/moderninteriors), used under the **Complete Version licence**
purchased on 2026-08-20 (see `tilesets/LIMEZUASSETS-LICENSE.txt`):

- ✅ May be **edited and used in any commercial or non-commercial project**.
- ❌ May not be resold, or edited and resold.
- ⚠️ **Credits are required**, linking to <https://limezu.itch.io/>. This obligation is live. The
  link must stay in the README acknowledgements, in the app's about/credits surface, and on the
  website. Removing it breaks the licence.

The three bundled tilesets are `interiors.png`, `office-tileset.png` and
`a5-office-floors-walls.png`. Each one is imported by `scene/office/themeRegistry.ts` and actually
drawn on the office floor. Nothing else in this directory is LimeZu art.

## The Office cast is *not* LimeZu art

Every character, meaning the card portraits and the walking sprites on the office floor, is drawn
procedurally in [`scene/office/portraitArt.ts`](../scene/office/portraitArt.ts) from per-character
recipes. These are original, fully custom-drawn busts, not recolours of anyone else's sprites, and
they carry no third-party licence.

This was not always true. The cast was once recoloured from LimeZu's `Adam/Alex/Amelia/Bob` walk
sheets; those sheets were deleted on 2026-08-20 once nothing referenced them any more. If you are
reading old commits or an old copy of this file, that is the change you are looking at.

## Starter Village atlas is original Munder Worlds art

`worlds/starter-village/starter-village-atlas.svg` is hand-authored source-pixel artwork created
for this project in 2026. It contains original terrain, route, laboratory, stable, vegetation and
prop tiles for Monster Trainer's Starter Village. It is not derived from, traced from, or licensed
from Pokémon, Nintendo, Game Freak, LimeZu, or any other third party.

## Tiled map

`maps/office.tmj` and `maps/brooklyn99.tmj` are Tiled JSON maps built on the LimeZu tilesets
above. Both are imported by `themeRegistry.ts`; a map that nothing imports is not shipped, and
should be deleted rather than left to imply an asset is in use.
