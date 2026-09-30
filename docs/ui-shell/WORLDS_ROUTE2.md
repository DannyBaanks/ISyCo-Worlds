# ISyCo Worlds — presentación Ruta 2

Implementado el 2026-09-30 en el checkout principal (`main`). Los dos paquetes
visuales entregados por Danny sirven de referencia artística. Esta entrega
cambia la composición y los materiales de la interfaz existente.

## Qué cambia

- Mundo: marco de madera con enredaderas, cartel de escena, compañeros debajo
  del mundo y centro de comando a la derecha como libro con índice de marcadores.
- El registro del mundo cuenta agentes y estados del store real; no simula tareas.
- Ajustes: índice lateral, página de pergamino y acciones Guardar/Cerrar fijas.
  La tarjeta promocional existente queda dentro de «Acerca de ISyCo Worlds».
- Marketplace: toldo, estantes de categorías y hoja de contribución. Su aviso de
  catálogo no conectado y sus controles deshabilitados siguen presentes.
- Entrada y asistente inicial: escena de fondo y marca ISyCo Worlds, conservando
  la selección/creación de carpetas y los pasos funcionales existentes.
- Starter Village: atlas PNG suministrado, recortes explícitos, camino al edificio
  y vegetación perimetral. Escala entera con nearest-neighbor.
- Pixi conserva una aplicación por mundo montado al redimensionar. Antes, las
  recreaciones simultáneas podían fallar en `TexturePool.returnTexture`.

## Abrir la aplicación

Desde la raíz del repositorio, con sus dependencias instaladas:

```sh
npm run dev
```

También se puede usar `npm run build` y después `npm run preview`.
La aplicación real conserva su configuración y puede iniciar sus agentes como
antes. Para ver la aldea, activar Mundos en Ajustes y seleccionar Monster Trainer.
La Oficina sigue disponible; no se ha cambiado el mundo predeterminado guardado.

## Revisar únicamente la presentación

```sh
node test/visual/serve-worlds.cjs
```

Salida real:

```text
Visual fixture: http://127.0.0.1:5199/test/visual/worlds.html
```

Abrir esa dirección para la App con tres agentes de prueba. `?view=entry` muestra
el selector de espacio; `?view=onboarding` muestra el asistente inicial;
`?theme=dark` cambia el tema; `?lang=ar` permite revisar RTL. Esta vista usa IPC
inerte y no inicia agentes, terminales ni proveedores. Sus nombres, proyectos y
contadores son datos de prueba, no resultados de una sesión real.

## Validación reproducible

```sh
npm run typecheck
npm run build
node --test test/worlds-materials.test.cjs test/global-nav.test.cjs test/world-shell.test.cjs test/monster-trainer-world.test.cjs test/world-engine.test.cjs test/world-projection.test.cjs test/world-profiles.test.cjs test/world-config.test.cjs test/office-world-lifecycle.test.cjs test/spanish-ui.test.cjs test/japanese-ui.test.cjs test/arabic-ui.test.cjs test/settings-one-save.test.cjs test/agent-token-cap.test.cjs
```

Para ejecutar la prueba de navegador con el servidor anterior abierto:

```sh
PLAYWRIGHT_MODULE=/ruta/al/modulo/playwright \
CHROMIUM_EXECUTABLE=/ruta/al/binario/chromium \
VISUAL_OUTPUT=/ruta/nueva/para/evidencia \
node test/visual/check-worlds.cjs
```

Las variables de módulo/binario son opcionales si Playwright y su navegador ya
están disponibles por defecto. Usar una ruta nueva para conservar cada ejecución.
Resultados de esta entrega: 81 pruebas unitarias PASS; typecheck y build con
exit 0; 26 comprobaciones de distribución en navegador PASS, 0 excepciones JS.
El recorrido incluye las once secciones del libro, ventanas de 860/1024/1440 px,
cinco idiomas, dos temas, entrada, onboarding inicial, ajustes y Marketplace.
Comprueba la conservación del canvas y que las etiquetas del Monitor caben.
Las capturas se inspeccionaron para detectar recortes internos que una simple
comprobación de ancho de página no detecta.

Evidencia cruda y SHA-256 en `worlds-route2-evidence-20260930/`. Entorno probado:
Linux, Node 24.21.0 y Chromium headless; el proyecto declara Node 22. No se modificó
esa declaración. El build mantiene sus avisos existentes en el log.

## Alcance y arte pendiente

- GUS y el inicio unificado del otro worktree no existen en este `main`. Su
  integración y su captura quedan **NOT_DEMONSTRATED**. No se crearon pantallas
  vacías ni se mezclaron ramas para aparentar esas capacidades.
- Se conservan los pasos actuales del onboarding. Esta entrega no consolida
  todavía el flujo de alta completo del paquete de referencia.
- El guía y las criaturas del mapa siguen siendo gráficos procedurales
  provisionales; los retratos existentes de la Oficina siguen en las tarjetas.
  Falta sustituirlos por el elenco artístico definitivo cuando exista.
- La aldea es un mapa interactivo por tiles; no una captura del moodboard. Madera,
  escena de entrada y atlas proceden del primer ZIP. Los hashes de esos assets
  están en `src/renderer/src/assets/worlds/materials/PROVENANCE.md`.
- Las sesiones reales de proveedores, PTY, reinicio, instalación y envío de
  mensajes no se ejecutaron en la fixture: **NOT_DEMONSTRATED** en esta revisión.
  Las pruebas de contratos y persistencia pasan; no equivalen a una sesión real.
- El contraste probado corresponde a las rampas principales de texto sobre
  papel en ambos temas, no a una certificación de accesibilidad de toda la app.
- En ventanas estrechas los compañeros se desplazan horizontalmente y el índice
  del libro conserva iconos con nombre accesible y tooltip. La escala entera del
  mapa deja más margen a 860 px para mantener sus píxeles nítidos.

Los cambios preexistentes de `package-lock.json`, `src/renderer/index.html` y
`test/bundled-fonts.test.cjs` no forman parte del commit de esta entrega.
