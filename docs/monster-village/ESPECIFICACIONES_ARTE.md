# Monster Village: especificaciones de arte y de comportamiento

Este documento es el contrato entre el arte y el código del mundo Monster Village.
Sirve para generar sprites nuevos (con Codex o a mano) sin tocar la lógica.

## 1. Cómo se reemplaza un objeto

Los objetos de la tabla de la sección 3 hoy se dibujan por código
(`src/renderer/src/worlds/monster/villageProps.ts`). Para reemplazar uno:

1. Guarda un PNG llamado `<id>.png` en
   `src/renderer/src/assets/worlds/starter-village/objects/`.
2. Vuelve a compilar o reinicia `npm run dev`.

No hay que registrar nada: la carpeta se lee sola
(`villageObjectSprites.ts`) y el PNG gana sobre el dibujo por código.
Si se borra el PNG, vuelve el dibujo por código.

Un id que no esté en la tabla se ignora.

## 2. Reglas para todos los sprites

| Regla | Valor |
|---|---|
| Formato | PNG RGBA, fondo transparente |
| Escala de exportación | 8× el tamaño lógico (un barril de 16×18 se exporta a 128×144). Cualquier múltiplo entero sirve; 8× iguala el detalle del atlas actual |
| Proporción | Exactamente la del tamaño lógico; el código estira el PNG a ese tamaño |
| Reescalado | Vecino más cercano. Píxeles duros, sin suavizado ni degradados finos |
| Vista | Tres cuartos desde arriba, igual que las casas actuales |
| Luz | Desde arriba a la izquierda |
| Contorno | Oscuro de un píxel lógico (8 px a 8×) |
| Suelo | El borde inferior del PNG es la línea del suelo. Sin margen transparente abajo |
| Sombra en el piso | No dibujarla: el código la pinta |
| Colocación | Centrado en su huella y apoyado en el borde inferior de la huella. Lo que sobra de alto sale hacia arriba |
| Mosaico | 1 casilla = 16 px lógicos |

## 3. Objetos reemplazables

Tamaño lógico en píxeles del mapa. Huella en casillas (ancho × alto).

| id | Tamaño lógico | A 8× | Huella | Qué es |
|---|---|---|---|---|
| `library` | 64×64 | 512×512 | 4×4 | Biblioteca. Hoy es la casa del pueblo con techo morado y letrero de libro |
| `workshop` | 64×64 | 512×512 | 4×4 | Taller. Casa con techo verde y letrero de martillo |
| `observatory` | 48×84 | 384×672 | 3×4 | Torre de piedra con cúpula y telescopio |
| `portal` | 32×44 | 256×352 | 2×2 | Arco de piedra con remolino violeta |
| `notice-board` | 32×28 | 256×224 | 2×1 | Tablón de misiones con techito |
| `mailbox` | 16×22 | 128×176 | 1×1 | Buzón rojo en poste |
| `well` | 32×42 | 256×336 | 2×2 | Pozo de piedra con techo |
| `campfire` | 16×16 | 128×128 | 1×1 | Fogata: piedras y leños, sin fuego |
| `bench` | 32×16 | 256×128 | 2×1 | Banca de madera |
| `barrel` | 16×18 | 128×144 | 1×1 | Barril |
| `hay-bale` | 16×16 | 128×128 | 1×1 | Paca de heno |
| `anvil` | 16×16 | 128×128 | 1×1 | Yunque sobre tocón |
| `log-pile` | 16×16 | 128×128 | 1×1 | Pila de leños |
| `training-dummy` | 16×26 | 128×208 | 1×1 | Muñeco de entrenamiento |
| `market-stall` | 48×46 | 384×368 | 3×2 | Puesto con toldo a rayas |

### Zonas que el código anima encima

Coordenadas lógicas desde la esquina superior izquierda del sprite. Si el arte
nuevo mueve estos puntos, hay que ajustar el código indicado.

| id | Zona | Qué dibuja el código | Dónde se ajusta |
|---|---|---|---|
| `campfire` | Centro x=8, base y=9 | Llamas y chispas animadas, y el resplandor | `StarterVillageScene.ts` (`campfires`) |
| `notice-board` | Rectángulo x 4–27, y 9–19 | Una nota por tarea abierta, hasta 8, en 2 filas de 4 | `StarterVillageScene.ts` (`noticeBoards`) |
| `library`, `workshop` | Boca de chimenea en (44, 11) | Humo | `villageDressing.ts` (`CHIMNEYS`) |
| `library`, `workshop` | Centro a 2/3 del alto | Resplandor cálido de ventanas | `StarterVillageScene.ts` (`addGlow`) |
| `observatory` | Centro (24, 50) | Resplandor cálido de ventanas | `StarterVillageScene.ts` (`addGlow`) |
| `portal` | Centro (16, 24) | Resplandor violeta que pulsa | `StarterVillageScene.ts` (`addGlow`) |

Para el tablón: dejar la cara de madera limpia en esa zona. Para la fogata: no
pintar fuego, solo la base.

## 4. Arte que ya existe y su formato

Estos archivos ya son imágenes; se reemplazan sobrescribiendo el archivo y
respetando el formato.

### Personajes: `assets/worlds/characters/roster/<nombre>.png`

- Hoja de 1980×792: 5 columnas × 2 filas de celdas de 396×396.
- Orden de celdas: reposo A, reposo B, caminar A, caminar B, trabajar A,
  trabajar B, esperar A, esperar B, bloqueado A, bloqueado B.
- Mirando a la derecha; el código refleja el sprite para caminar a la izquierda.
- Pies en y=371 de cada celda.
- Se dibuja a 33×33 px lógicos (396 / 12).
- Archivos: `agua`, `fuego`, `electricidad`, `oscuridad`, `luz`, `aire` y
  `profesor`. El Profesor es el coordinador y usa las mismas diez poses.

### Terreno y objetos chicos: `starter-village/starter-village-atlas.png`

- Atlas de 1448×1086. Los recortes están en `StarterVillageAtlasFrames.ts`.
- Mosaicos de terreno (128×128 de origen, 16×16 en pantalla): `grass`,
  `training-grass`, `dirt`, `road`, `water`. Deben repetirse sin costura.
- Objetos: `tree`, `shrub`, `flowers`, `rock`, `lantern`, `crate`, `sign`,
  `fence-horizontal`, `fence-post`.
- El tamaño en pantalla de los objetos está en `PROP_VISUALS`
  (`villageDressing.ts`): árbol 30×34, arbusto 20×19, roca 18×15, farol 10×18,
  caja 15×16, letrero 14×17.
- Si cambia el atlas, hay que actualizar los rectángulos de recorte.

### Edificios: `starter-village/starter-village-buildings.png`

- Atlas de 512×256, a escala 1:1 (un píxel del archivo es un píxel lógico).
- `laboratory` en (8, 8) de 96×80, huella 6×5.
- `stable-building` en (120, 8) de 96×80, huella 6×5.
- `village-home` en (232, 8) de 64×64, huella 4×4.
- Estos sí llevan margen abajo (unos 8–13 px) y su propia base de piedra.
- Chimeneas en `CHIMNEYS`: laboratorio (65, 15), establo (36, 9), casa (44, 11).
- La biblioteca y el taller se generan a partir de `village-home`. Si pones
  `library.png` o `workshop.png` propios, dejan de depender de esa casa.

## 5. Lo que seguirá dibujando el código

No necesita arte: variación del pasto, flores y matas, bordes de caminos,
orilla del lago y destellos del agua, sombras, anillo de bosque del borde,
resplandores, humo, mariposas, sombras de nubes, el entrenador del jugador y
las burbujas de estado con sus íconos.

## 6. Comportamiento: qué lugar significa qué

Una sola tabla decide a dónde va cada agente:
`src/renderer/src/worlds/monster/villagePlaces.ts`. La leen el movimiento, las
burbujas y el panel lateral.

| Dato del agente | Lugar (id) | Objeto que lo ancla |
|---|---|---|
| Estación `shelf` (Read, Grep, Glob) | `library` | `library` |
| Estación `desk` con Edit o Write | `workshop` | `workshop` |
| Estación `terminal` (Bash) | `stable` | `stable` |
| Estación `web` (WebFetch, WebSearch) | `observatory` | `observatory` |
| Estación `board` (TodoWrite) | `notice-board` | `notice-board` |
| Estación `mailbox` (Task, mensajes) | `post-office` | `mailbox` |
| Estación `mcp` | `portal` | `portal` |
| Trabajando sin herramienta | `training-grass` | Hierba alta junto al laboratorio |
| Estado `waiting` | `well` | `well` |
| Estado `idle` u otro | `village-idle` | `campfire` |
| Estado `blocked`, o tarea esperando al humano | `professor` | `laboratory` |

Coordinador (`isGod`): se dibuja con la hoja `profesor`. Va a `notice-board`
cuando trabaja con estación `board` o `mailbox`; en cualquier otro caso está en
`professor` (el laboratorio).

Cada ancla sigue a su objeto: si en modo construir se mueve la biblioteca, los
monstruos van a la nueva posición. Si un pueblo guardado no tiene el objeto,
van a un punto fijo del mapa base.

### Para agregar un lugar nuevo

1. `villagePlaces.ts`: agregar el id a `VILLAGE_PLACE_IDS`, la regla que lleva
   ahí y su clave de texto en `VILLAGE_PLACE_LABEL_KEYS`.
2. `StarterVillageScenario.ts`: definir el objeto (huella y `semanticAnchors`),
   agregarlo al catálogo, colocarlo en `STARTER_VILLAGE_PRESET`, darle un punto
   de respaldo en `anchorPlacements` y enlazarlo en
   `STARTER_VILLAGE_ANCHOR_BINDINGS`.
3. `monsterMovement.ts`: agregarlo a `SOLID_OBJECTS` si bloquea el paso.
4. `villageProps.ts`: un pintor provisional, o directamente el PNG en la
   carpeta `objects/`.
5. `StarterVillageScene.ts` (`drawActivityIcon`): ícono de la burbuja, opcional.
6. Los cinco archivos de `i18n/locales/`: el nombre del lugar.
7. `test/monster-village-places.test.cjs` comprueba que todo lugar tenga
   nombre, ancla caminable y ruta desde la plaza.

Reglas del mapa base que las pruebas exigen: los objetos no se enciman, toda
estructura tiene una entrada que toca un camino, y queda a 2 casillas o más del
borde.
