# ISyCo Worlds — Roadmap

> Estado: **arquitectura portable demostrada** (rama `witness/worlds-on-current-main` verificada contra `main` actual). Falta *visual runtime witness* (swap manual en Electron) y pulido UX.

---

## ✅ Lo que YA está (completo y verde en main actual)

| Área | Qué incluye | Evidencia |
|---|---|---|
| **WorldEngine (núcleo puro)** | Máquina de estados transaccional `IDLE→VALIDATING→BOOTSTRAPPING→MOUNTING→READY→RECOVERY`; inyección `WorldResourceResolver`; sin deps de host | 19/19 tests `world-engine`, `world-projection`, `world-profiles` |
| **Proyección semántica** | Normaliza `agents`/`archivedAgents` (Zustand) + `hiveTasks` (IPC) → `CanonicalWorldSnapshot` + diff `VisualTransition`; identidades visuales deterministas por `agentId` | `useWorldProjection.ts`, `identityResolver.ts`, `worldProfiles.ts` |
| **Registry de mundos** | Allowlist tipada: `office` (fallback) + `monster-trainer` (experimental); cada mundo declara su `render()` y recursos | `worldRegistry.ts` 5/5 tests |
| **Adapter React** | `WorldHost` monta capas keyidas, hace swap atómico (candidato visible → retirado en layout turn), llama `markReady/Failed/Disposed` | `WorldHost.tsx`, `WorldRuntimeSurface.tsx` |
| **Monster Trainer (MVP)** | Escena Starter Village 24×16 (SVG atlas hecho a mano 384×256), 5 anclas semánticas, criaturas geométricas por seed de agente, 4 estados visuales (círculo/barra/triángulo/diamante), guía profesor, marcadores de tarea | `MonsterTrainerSurface/World/Scene/Scenario/Art` + atlas + 12/13 tests |
| **Feature gate UI** | `worldsEnabled` / `selectedWorld` en `HarnessConfig`; `WorldSelector` en titlebar; sección Settings reversible; i18n en/es/zh-CN/ar | `App.tsx`, `SettingsModal`, `WorldSelector`, `WorldsSettings`, locales |
| **Persistencia identidades** | `world-profiles.json` en `userData`; temp-file/rename atómico; lectura corrupta = vacía (no rompe); defaults deterministas en memoria | `main/worldProfiles.ts`, IPC `worlds:getProfiles` |
| **Office fallback adaptado** | `OfficeFloor` expone `onReady`/`onRenderFailure`; `reportReady` tras primer render, `reportFailure` en ticker/init/give-up; cast seguro en registry | `OfficeFloor.tsx` + 13/13 tests `office-world-lifecycle` |
| **Tests & CI** | 1071 pass + 7 skipped (`npm run test:focused`); `typecheck` limpio; `build` OK; `git diff --check` OK | Verificado en branch witness |

---

## 🟡 En progreso / Pendiente de validación manual

| Item | Qué falta | Bloqueador |
|---|---|---|
| **Visual Runtime Witness** | 1) `npm run dev` swap Office↔Monster↔Office fluido 2) Build empaquetado mismo swap 3) Vite muerto → selector Office → recovery surface | Entorno headless actual; necesita display real |
| **Office fallback real** | Verificar que Office pinta idéntico tras swap (sin parpadeo, inputs vivos) | Manual |
| **Monster Trainer UX** | Click criatura → selecciona agente; click marcador → abre tarea; scroll/zoom viewport | Manual |

---

## 🟠 Roadmap funcional (post-MVP)

### M1 — Pulido Monster Trainer (2–3 semanas)
- [ ] **Inventario/Artifacts**: panel lateral con items ganados (no commerce, solo display)
- [ ] **Mission Board**: tareas reales del hive como "misiones" con recompensa visual
- [ ] **Journal/Log**: historial de batallas/eventos por agente
- [ ] **Progresión determinista**: XP por tarea completada; evolución de criatura al umbral (idempotente, sin RNG)
- [ ] **Modo sin-texto QA**: flags visualesonly para tests automatizados de regresión visual

### M2 — Segundo mundo (4–6 semanas)
- [ ] Definir contrato `WorldDefinition` v2 (metadatos, versionado, migración)
- [ ] Nuevo mundo temático (ej. "Cyberpunk Office", "Fantasy Guild", "Space Station")
- [ ] Assets propios (atlas + tileset) + anclas semánticas propias
- [ ] Selector con preview miniatura

### M3 — Multi-mundo & persistencia (4–6 semanas)
- [ ] Guardar último mundo por hive/proyecto
- [ ] Transiciones animadas entre mundos (fade/slide)
- [ ] Hot-reload de mundos en dev (sin reiniciar app)
- [ ] World marketplace local (instalar mundos desde `.isyco/worlds/`)

### M4 — Integración profunda (ongoing)
- [ ] **Contrato semántico versionado** (`WorldState v1`): desacoplar `useWorldProjection` del store interno (adapter inyectable)
- [ ] **WorldResourceResolver** genérico (Vite dev / empaquetado / CDN / local)
- [ ] **Office as plugin**: mover OfficeFloor completo a `worlds/office/` (fuera de `scene/office/`)
- [ ] **Mobile/Remote**: render remoto de mundos vía `munder-remote` (ya existe infraestructura)

---

## 🔴 Fuera de alcance explícito (no-go)

| Qué | Por qué |
|---|---|
| Combate real con mecánicas RPG | Munder es harness de agentes, no juego |
| Economía / comercio / NFT / monetización | Local-first, sin backend |
| Multijugador / mundos compartidos | Arquitectura single-user |
| Editor de mapas / tilesets en-app | Herramientas externas (Tiled, Aseprite) |
| Reemplazar runtime de agentes (Hive/Harness) | Worlds es *capa visual*, no motor |
| IA generativa para assets | Arte original intencional (pixel-art humano) |

---

## 📦 Cómo probar la rama actual

```bash
# En el repo munder-difflin:
git fetch origin witness/worlds-on-current-main
git checkout witness/worlds-on-current-main
npm ci        # respeta engines: node 22 (usa nvm/fnm)
npm run typecheck
npm run test:focused
npm run build
npm run dev   # abre Electron; Settings → Worlds → Enable → Monster Trainer
```

**Checks automáticos ya pasan**: typecheck, 1071 tests, build, diff-check.

---

## 🧭 Decisiones de arquitectura (para revisión en PR)

1. **WorldEngine = puro** (TS plano, 0 deps host). Portable a cualquier host React+Pixi.
2. **Registry = allowlist cerrada** (no plugin dinámico aún). Seguridad: id persistido nunca ejecuta código arbitrario.
3. **Semantic bridge = inline** (`useWorldProjection` lee Zustand del host). *Deuda técnica declarada*: extraer a adapter inyectable v2.
4. **Office fallback = host scene adaptado**. No es un "mundo" separado; es la oficina actual con 75 líneas de lifecycle. Migración futura: mover a `worlds/office/`.
5. **Config flags en HarnessConfig global**. Simple hoy; v2: config por-mundo aislada.
6. **Atlas SVG + escalas enteras (1×/2×/3×/4×)**. Sin escalado fraccional → pixel-perfect.
7. **Criaturas = código, no sprites**. Identidad = `seed = "munder-worlds:v1:<agentId>"` → determinista, sin assets, accesible (forma ≠ color).

---

## 📝 Próximo paso sugerido

1. **Mergear esta rama** (o cherry-pick a `feat/isycoworlds-integration`)
2. **QA manual** con display real (los 3 checks del witness)
3. **Tag `v0.5.3-ISyCo.0-worlds-preview`** para distribución temprana
4. **Abrir issue M1** con tareas concretas y owner

---

*Roadmap generado tras auditoría READ-ONLY + witness de port completo (2026-09-26). Rama de integración: `witness/worlds-on-current-main`.*