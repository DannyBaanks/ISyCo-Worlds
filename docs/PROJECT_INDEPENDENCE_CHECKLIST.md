# ISyCo Worlds — checklist de independencia del proyecto

Auditoría inicial: 2026-10-01

Estado: saneamiento de archivos públicos de GitHub completado en una primera tanda; quedan pendientes las superficies de producto, CLI, móvil, assets y documentación editorial.

## Objetivo acordado

ISyCo Worlds debe presentarse y operar como producto independiente. Munder Difflin se conserva únicamente como **provenance histórico del fork y crédito de origen**, junto con los avisos de autoría y licencia que correspondan. No debe seguir apareciendo como mundo activo, marca del producto, nombre de la aplicación ni destino de configuración.

El crédito de origen debe ser claro y acotado: ISyCo Worlds nació de un fork del proyecto [Munder Difflin](https://github.com/chaitanyagiri/munder-difflin), creado por Chaitanya Giri. Esto no atribuye a ese proyecto el trabajo propio de ISyCo Worlds ni convierte automáticamente a todas las personas contribuyentes del upstream en contribuyentes de este repositorio.

## Reglas para sanear sin perder historia ni romper usuarios

- [x] Distinguir marca activa de provenance, licencia, copyright y registro histórico.
- [x] No reescribir ni filtrar el historial Git para esconder el origen del fork.
- [x] No eliminar avisos de licencia, atribuciones de assets ni créditos exigidos por sus términos.
- [x] No hacer reemplazos globales de `Munder`, `Dunder`, `office` o `munder-*`: varios son IDs persistidos, rutas de importación, deep links o evidencia histórica.
- [ ] Antes de retirar un ID activo, definir migración, compatibilidad y pruebas para instalaciones existentes.
- [ ] Revisar cada borrado o movimiento con manifiesto exacto de archivos y su estado (tracked/untracked); preservar datos no entendidos.

## Hallazgos medidos

Medidos en este checkout de `main`; son conteos de archivos versionados, no una auditoría legal ni una inspección del contenido binario.

| Hallazgo | Evidencia | Consecuencia |
|---|---|---|
| 468 rutas versionadas contienen `munder` o `dunder` en su nombre | `git ls-files | rg -i 'munder|dunder' | wc -l` | La limpieza requiere lotes por dominio y no un rename masivo. |
| 876 archivos de texto versionados contienen una mención | `git grep -Il -i -E 'munder|dunder mifflin' | wc -l` | Hay menciones activas, históricas y de licencia mezcladas. |
| El registro heredado contaba PR del upstream como contribuciones del proyecto | `CONTRIBUTORS.md` y archivos de generación heredados (retirados en `d428ffa3`) | Reemplazado por contribuciones verificadas de `DannyBaanks/ISyCo-Worlds` y un crédito de provenance separado. |
| El scaffolding de contribuyentes y rol de Discord estaba ligado al upstream | `.github/contributors-extra.json`, `scripts/generate-contributors.mjs`, `.github/workflows/contributors.yml`, `.github/workflows/contributor-role.yml` (retirados en `d428ffa3` y `c0dc7d64`) | Retirado; no se cuenta a personas ni actividad del upstream como contribución a Worlds. |
| CODEOWNERS apuntaba al mantenedor upstream | `.github/CODEOWNERS` | Actualizado para enrutar al responsable actual y conservar reglas específicas de seguridad, CI, releases, licencias y provenance. |
| Configuraciones/templates de GitHub usaban enlaces o marca upstream | `.github/FUNDING.yml`, `.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE.md`, `CONTRIBUTING.md`, `SECURITY.md` | Templates y canales actualizados a ISyCo Worlds; se retiró el destino de donación de Munder. |
| El producto todavía ofrece el mundo `office`/Munder | `src/shared/worlds.ts`, `src/shared/worldManifests/office.world.json`, pantalla de selección, registro de capacidades, locales y docs | Retirar de la lista activa y archivar su provenance; primero migrar `preferredWorldProfile: 'office'` y otros datos persistidos. |
| Hay superficies de aplicación, CLI y móvil con identidades heredadas | `tools/munder/`, `src/mcp/munder-chatgpt-link`, `ios/MunderMobile`, `android/MunderMobile`, workflows móviles y configuración Electron | Distinguir etiqueta visible de IDs de paquete, protocolo, almacenamiento y rutas usadas por instalaciones existentes. |
| Hay contenido editorial y sitio generado sobre Munder | `blog/src/posts/`, `blog/src/assets/media/`, `docs/blog/` | Decidir página por página si es historia, tutorial vigente o comparación obsoleta; preservar URLs útiles mediante actualización o redirección. |

## Checklist de saneamiento

### 1. Crédito, colaboradores y gobernanza

- [x] Rehacer `CONTRIBUTORS.md` con PR verificables de `DannyBaanks/ISyCo-Worlds` (59 PR fusionados al 2026-10-01; verificado contra GitHub).
- [x] Añadir un crédito de origen independiente y explícito para Munder Difflin / Chaitanya Giri; separado del conteo de contribuciones de Worlds.
- [x] Auditar y retirar `.github/contributors-extra.json`, que contenía referencias a PR del upstream.
- [x] Retirar `scripts/generate-contributors.mjs` y `.github/workflows/contributors.yml`, que fijaban el upstream como fuente de contribuciones.
- [x] Actualizar `.github/CODEOWNERS` para el repositorio y responsable actuales.
- [x] Verificar el registro propio de contribuciones contra la lista de PR fusionados del repositorio actual.
- [x] Retirar `.github/workflows/contributor-role.yml`, automatización heredada que asignaba un rol en Discord ajeno al proyecto.

### 2. GitHub público y contribución

- [x] Actualizar `CONTRIBUTING.md`, incluyendo nombre, clone URL, desarrollo, pruebas y canales propios de Worlds.
- [x] Actualizar `.github/PULL_REQUEST_TEMPLATE.md` y todos los issue templates/configuración para el repositorio actual.
- [x] Actualizar `SECURITY.md` con el producto y canal de reporte vigente; retirar las instrucciones heredadas del upstream.
- [x] Retirar `.github/FUNDING.yml`, que sólo contenía el destino de donación de Munder.
- [ ] Buscar reglas de etiquetas, releases y automatizaciones que todavía digan “Munder Difflin version” o usen el repositorio upstream.
- [ ] Revisar badges, links de Discussions, releases y documentación externa en el README y el sitio.

### 3. Worlds activo y migración de datos

- [ ] Definir la pantalla de bienvenida y el mundo predeterminado después de retirar Munder; Monster Village es un mundo de ISyCo Worlds, no el nombre del producto.
- [ ] Eliminar `office` del selector y de los registros de mundos activos una vez que exista un destino de archivo separado para su manifiesto y provenance.
- [ ] Migrar instalaciones con `preferredWorldProfile: 'office'` a un valor válido con una transición versionada; no descartar otros datos guardados.
- [ ] Buscar IDs `office`, claves de localización, rutas, capabilities, test fixtures y referencias de arranque para distinguir runtime de historia.
- [ ] Actualizar README, ayuda, Settings/Inspiraciones y Marketplace: mostrar el origen de Munder sólo en “Provenance / Inspiraciones y licencias”, no como mundo seleccionable.
- [ ] Añadir pruebas de migración para perfiles viejos y pruebas de que Worlds inicia/selecciona un mundo válido tras la migración.
- [ ] Conservar el manifiesto de Munder como registro histórico fuera del catálogo runtime, o documentar otra ubicación que mantenga sus fuentes y hashes.

### 4. Aplicación de escritorio, identidad y CLI

- [ ] Revisar título de ventana, nombre de menú, instaladores, icono, nombre de producto, páginas de ayuda y artefactos de release para que la marca visible sea ISyCo Worlds / Worlds.
- [ ] Auditar `electron-builder.yml`, `build/linux/`, protocolos y recursos empaquetados. Separar marca visible de `appId`, esquemas URL y rutas que podrían requerir migración o compatibilidad.
- [ ] Revisar `tools/munder/`, launcher `worlds`, documentación del CLI, mensajes, variables de entorno y carpetas de configuración.
- [ ] Mantener alias o migración para comandos, configuración y datos antiguos mientras puedan existir instalaciones de usuarios; retirar alias sólo tras anunciar y probar el camino nuevo.
- [ ] Revisar `src/mcp/munder-chatgpt-link`: si el identificador es parte del protocolo/import público, crear una transición compatible antes de renombrarlo.
- [ ] Identificar telemetría y métricas donde “Munder” sea etiqueta visible; no cambiar nombres históricos de eventos si afecta consultas o series almacenadas sin plan de transición.

### 5. Apps móviles

- [ ] Cambiar nombres visibles, títulos de workflows y nombres de artefactos de Android/iOS a Worlds.
- [ ] Revisar `ios/MunderMobile` y `android/MunderMobile` para nombres de proyecto, recursos, documentación y tareas de build.
- [ ] Decidir bundle ID / application ID nuevos y la estrategia de publicación: cambiarlo crea una app distinta para las tiendas y no actualiza automáticamente la instalación anterior.
- [ ] Mantener o versionar `munder-remote@1` y otros protocolos persistidos hasta tener compatibilidad probada con clientes existentes.
- [ ] Inventariar personajes, sprites, capturas y tarjetas del cast de Munder en móvil; distinguir assets redistribuibles con avisos obligatorios de contenido que debe retirarse del producto activo.
- [ ] Probar actualización, enlace remoto y emparejamiento entre versiones antes de cambiar identificadores de almacenamiento o red.

### 6. Assets, licencias y provenance

- [ ] Inventariar assets de Munder por ruta, origen, autor, licencia, uso actual y dependencias de build antes de mover o eliminar cualquiera.
- [ ] Mantener `LICENSE`, `LICENSE-ASSETS`, atribuciones de LimeZu y otros autores, avisos de copyright y términos de distribución que sigan aplicando.
- [ ] Mantener un registro de origen de código/assets: proyecto upstream, commit/base de fork conocida si está documentada, autoría y cambios propios; separar hechos verificables de inferencias.
- [ ] Separar assets de oficina/Munder del bundle y de la experiencia activa cuando deje de existir el mundo, sin borrar todavía la evidencia ni los archivos fuente.
- [ ] Conservar la atribución de arte generado y su provenance, aunque el arte deje de usarse en una pantalla activa.
- [ ] Revisar avisos requeridos dentro del instalador, Settings, documentación y paquetes distribuidos, no sólo en el repositorio.

### 7. README, docs, blog y SEO

- [ ] Mantener el README enfocado en el producto actual, arquitectura y estado del proyecto; Munder aparece sólo en el párrafo de origen y créditos.
- [ ] Marcar `RELEASE.md` y notas viejas como archivo histórico; no mostrarlas como la versión actual de Worlds.
- [ ] Clasificar cada artículo de `blog/src/posts/`: historia de versiones, tutorial todavía aplicable, comparativa ya obsoleta o material que debe archivarse.
- [ ] Actualizar tutoriales y comparativas vigentes; para artículos retirados, preservar una página histórica o publicar redirecciones explícitas antes de retirar la URL.
- [ ] Regenerar `docs/blog/` desde fuentes; no editar manualmente cientos de salidas generadas salvo que el flujo del sitio lo requiera.
- [ ] Verificar enlaces internos/externos, sitemap, RSS, metadatos SEO, capturas y alt text después de la migración editorial.
- [ ] Revisar `ROADMAP.md`, `.opencode/plans/` y guías de desarrollo: archivar lo que documente el fork y actualizar cualquier plan que describa Munder como producto activo.

### 8. Herramientas, nombres internos e historial

- [ ] Buscar menciones en workflows, scripts, tests, fixtures, snapshots, paquetes, directorios y docs ocultos; marcar cada resultado como activo, histórico, licencia o falsa coincidencia.
- [ ] Revisar `.claude/`, `.opencode/` y configuraciones de agentes por comandos, nombres de repos y ejemplos copiados del upstream.
- [ ] Revisar `package.json`, lockfiles, metadatos, telemetry, nombres de servicios y archivos `.desktop` para evitar que el producto instalado siga presentándose como Munder.
- [ ] Actualizar la identidad local de Git para commits futuros si aún usa `danny@munder-difflin.local`; no cambiar autoría ni reescribir commits ya publicados.
- [ ] Revisar el remote llamado `fork` y sus referencias: quitarlo sólo cuando deje de ser necesario para consultar provenance/upstream; el remote local no es parte del producto publicado.
- [ ] Mantener los mensajes de commit y el historial original; los nombres heredados en commits antiguos son parte de la historia del fork.

## Orden sugerido

1. [x] Criterio de identidad confirmado por el usuario: Munder sólo provenance/crédito.
2. [x] Corregir gobernanza pública y archivos de contribución de GitHub con datos propios.
3. [ ] Preparar la migración del mundo `office` y probar perfiles existentes.
4. [ ] Retirar Munder de la experiencia activa y de la identidad visible del desktop/CLI.
5. [ ] Sanear las apps móviles con estrategia explícita para IDs y protocolos.
6. [ ] Hacer el inventario legal/técnico de assets y separar sólo lo que ya no se distribuye.
7. [ ] Curar blog/docs, regenerar sitio y comprobar enlaces, SEO y releases.
8. [ ] Ejecutar búsqueda final, pruebas relevantes, build/package de cada plataforma disponible y revisión de cambios/deletes.

## Fuera de alcance de esta auditoría

- Se retiraron cinco archivos rastreados de scaffolding de contribución, automatización Discord heredada y financiación de Munder; su historia permanece en Git.
- No se cambiaron identificadores ni datos de usuario.
- Se actualizaron nueve documentos/configuraciones públicos de contribución, soporte y seguridad; no se modificaron workflows operativos de apps ni branding/runtime.
- No se tocaron el motor, mundos runtime, assets, datos persistidos ni protocolos.
- No se hicieron afirmaciones legales sobre licencias; cada asset debe verificarse contra su licencia y su uso de distribución.
- Los conteos de menciones son una fotografía del checkout y pueden cambiar con nuevos commits.
