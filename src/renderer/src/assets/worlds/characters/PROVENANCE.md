# World roster portraits

Both source sheets were copied byte-for-byte from Danny's
`isyco-worlds-visual-handoff.zip`. The first sheet supplies the three static
starter portraits; the second sheet supplies the generated professor portrait
(rightmost sprite). The renderer crops each sprite with a fixed CSS viewport;
these assets do not add movement, evolution, or world behavior.

- `isyco-monster-starters.png` — `images/creature-sheets/leaf-fire-water-concepts.png`; SHA-256 `7921877e01641559c9cbe23691f6429e3042d94eb4745daf1c1972a9f34f6b9c`
- `isyco-professor-roster-sheet.png` — `images/codex-generated/exec-b2b2543d-7ce6-45bb-833f-fdd6f2f9a6d3.png`; SHA-256 `35c7f5b7e6774e7c26d23e38ae9a26c49e2fe3c6a3445d3aa861aab30a84566f`

## Playable roster (`roster/`)

The village actors use the seven sheets in `roster/`. Each file is a 1980×792 PNG,
five columns by two rows of 396×396 cells: idle, walk, work, wait, blocked, each
with an A and a B pose. Feet sit on y=371 in every cell so a 33px draw (396/12)
lands on the tile. Neighbor scraps that crossed the old grid cut were dropped;
the figures themselves are the ones from `/home/danny/Descargas/sprites-10-frames`.
The two sheets above stay as the earlier portraits. SHA-256 of the cleaned sheets:

- `roster/agua.png` — `bad0d3e1fd4985a0717b3d2b244a50b958e4d8675936577b30427ec07c5b2c39`
- `roster/aire.png` — `b80aa501f7ebe406645986d6cc9f22b62317528bab01008862d130306a144c82`
- `roster/electricidad.png` — `f01a37333cc922866545968fe7bdf72623528cdcac1419af9bd9eb5bbd94f163`
- `roster/fuego.png` — `21805cce75f15b5803804dfff24332c2cde221caf98f86cc79781c9af6313aec`
- `roster/luz.png` — `a23c66074d64676f066ee675f9be7742d0f4f2496cccf3bfab5bfdbf395ae7c3`
- `roster/oscuridad.png` — `24448625c47de1b2da2a5bd9994bca3913e1203847bacf37ca5ceaddd2c1b7a8`
- `roster/profesor.png` — `6e904ad0aef8d668cb3599f3177398f6694ff12407965fba74115e858964502f`
