# Worlds Reviver

> **ISyCo Worlds puede morir. Su capacidad de arrancar no debe morir con él.**

El Xeon seguía prendido, pero ISyCo Worlds se cerró. Desde ChatGPT ya no había cómo revivirlo: el MCP normal le habla a ISyCo Worlds Link y a la app, y el control murió junto con lo que controlaba.

El Reviver es un proceso aparte, pequeño y aburrido, que vive junto a ISyCo Worlds y hace solo cuatro cosas con **un** ISyCo Worlds configurado:

| Operación | Qué hace |
|---|---|
| `status` | Dice si ISyCo Worlds está vivo **y sano**, con qué pid, qué versión, si la identidad de la oficina coincide, el estado del watchdog y la última acción. |
| `start` | Si ya está sano: no hace nada y lo dice. Si no: lo lanza, espera a que conteste sano con la oficina correcta y devuelve un recibo. |
| `restart` | Verifica que el proceso es el ISyCo Worlds configurado, lo para, lo vuelve a lanzar y verifica igual que `start`. |
| `stop` | Lo para y deja claro que fue a propósito, para que el watchdog no lo reviva. |

No hay `exec`. Quien llama no puede mandar rutas, comandos ni argumentos: el destino vive en `config.json`, y ese archivo solo lo edita el usuario local.

## Qué cuenta como «sano»

Que exista un pid no basta. Hacen falta las cuatro cosas:

1. Un proceso corre **el ejecutable configurado con los argumentos configurados**. Los helpers de Chromium (`--type=`) no cuentan.
2. El canal de control de ISyCo Worlds (`munder-control.json` en su userData) contesta `GET /salud` con el token de ese arranque.
3. `/salud` dice que es **ese mismo pid**.
4. `/salud` dice que es **la oficina fijada** en `init`: el `office_id` de ISyCo Worlds Link.

| Estado | Significa |
|---|---|
| `healthy` | Las cuatro. |
| `down` | Ni proceso ni nadie contestando. |
| `starting` | Nuestro proceso existe, pero `/salud` no contesta (arrancando, o colgado). |
| `wrong_identity` | Contesta otra oficina. Nunca cuenta como sano. |
| `foreign` | Contesta un ISyCo Worlds con este userData que no es el destino configurado (p. ej. un `npm run dev`). No se lanza un gemelo ni se mata. |
| `ambiguous` | Hay más de un proceso del destino. No se adivina: falla cerrado. |
| `unverified` | Contesta, pero sin identidad (un build anterior a este PR). |

## Instalar

### Linux (Victus): systemd --user

```bash
worlds reviver init           # fija este checkout, su userData y el office_id de Link
worlds reviver instalar       # ~/.config/systemd/user/munder-reviver.service, enable --now
worlds reviver status
```

- `init` toma el mismo destino que `start.sh`: `node_modules/electron/dist/electron [--no-sandbox] <checkout>`. Guarda también `DISPLAY`, `WAYLAND_DISPLAY`, etc., porque un servicio de usuario no hereda la sesión gráfica. Corre `init` desde la terminal del escritorio.
- La unidad usa `KillMode=process`: reiniciar o parar el Reviver **nunca** tumba al ISyCo Worlds que lanzó.
- Para que siga vivo sin sesión abierta: `loginctl enable-linger`. ISyCo Worlds es una app gráfica, así que necesita la sesión para mostrar ventana.

### Windows (Xeon): tarea al iniciar sesión

```powershell
worlds reviver init
worlds reviver instalar       # tarea «Worlds Reviver»: al iniciar sesión, oculta, se reinicia si se cae
worlds reviver status
```

- Es una tarea programada y no un servicio de Windows porque ISyCo Worlds es una app de escritorio: un servicio corre en la sesión 0 y ahí no puede abrir ventanas.
- La tarea lanza `wscript` → `node reviver.cjs servir` sin ventana, y **espera** a node. Si el Reviver muere, la tarea lo ve y `RestartOnFailure` lo levanta.
- En una instalación empaquetada (`.exe`) no hay node: el Reviver corre con el Electron de la propia app como node (`ELECTRON_RUN_AS_NODE=1`), desde `resources/munder/reviver.cjs`.

### Opciones de `init`

| Opción | Para qué |
|---|---|
| `--app DIR` | Otro checkout. |
| `--exe RUTA --arg A --arg B` | Un destino explícito: la app empaquetada o un AppImage. |
| `--user-data DIR` | Un userData propio (sesiones paralelas de `start.sh`). |
| `--autostart` | Arranca ISyCo Worlds cuando arranca el Reviver, es decir, al iniciar sesión. |
| `--bind IP` / `--port N` | Dónde escucha. Por defecto `127.0.0.1:47833`. Para llegar desde otra máquina usa la IP de Tailscale. |
| `--sin-watchdog` | Solo recuperación manual. |

## Llamarlo desde fuera

Cada cliente tiene su propia llave Ed25519. El Reviver guarda solo la parte pública.

```bash
# en el Xeon: una credencial para la Victus (o para el MCP de ChatGPT)
worlds reviver cliente nuevo victus --direccion 100.64.0.7:47833 --salida victus-xeon.json

# en la Victus, con ese archivo
worlds reviver llamar victus-xeon.json status
worlds reviver llamar victus-xeon.json start

# quitarla
worlds reviver cliente quitar victus
```

Esto **no** pasa por ISyCo Worlds Link: habla directo con el Reviver del Xeon, que sigue vivo aunque ISyCo Worlds y Link no lo estén.

## ChatGPT: un conector aparte

`tools/munder/reviver-mcp.cjs` es un servidor MCP por stdio con tres tools: `munder_status`, `munder_start` y `munder_restart`. Su único argumento es `machine`, que sale de un enum con los nombres de tu archivo de máquinas:

```json
{ "machines": {
    "xeon":   { "credential": "xeon.json",   "address": "100.64.0.7:47833" },
    "victus": { "credential": "victus.json" } } }
```

```bash
export MUNDER_REVIVER_TARGETS=~/.config/munder/reviver-targets.json
src/mcp/munder-chatgpt-link/chatgpt-tunnel.sh --reviver     # :8094 → https://….trycloudflare.com/mcp
```

- Es un **segundo conector** en chatgpt.com («Worlds Reviver»), separado de `munder-chatgpt-link`: si ISyCo Worlds muere, este sigue.
- Usa el mismo filtro de red que `munder-chatgpt-link` (`network-gate.mjs`: loopback, misma LAN o Tailscale, con los mismos `MUNDER_CHATGPT_ALLOW_*`).
- Toda respuesta tiene que venir firmada por el Reviver fijado en la credencial.

Ejemplo, de ChatGPT al Xeon:

```text
munder_status({ machine: "xeon" })
→ xeon: ISyCo Worlds DOWN; identity NOT verified; watchdog failed; last watchdog → failed
munder_start({ machine: "xeon" })
→ xeon: start → healthy; receipt 2684b927aae3c77a
```

## El protocolo (`munder-reviver@1`)

`POST /reviver/v1/{status|receipts|start|restart|stop}` con un cuerpo JSON firmado:

```json
{ "v": 1, "op": "restart", "reviver_id": "3364e0165d426a4c", "office_id": "d57064f200e341bb",
  "client": "a6baa7db0e20788d", "ts": 1790000000000, "nonce": "Ym9ndXMtbm9uY2UtZXhhbXBsZQ" }
```

- **Cabecera** `x-reviver-sig`: firma Ed25519 del cliente sobre `munder-reviver@1|req\n` + el cuerpo exacto.
- **Qué rechaza el Reviver (401):**
  - un cliente que no está en `clients.json`;
  - una firma inválida;
  - `op` distinta de la ruta;
  - otro `reviver_id` u otro `office_id`;
  - más de 60 s de diferencia de hora;
  - un nonce repetido;
  - una petición firmada antes de su propio arranque.
- **Respuesta:** `{ ok, op, result, reviver_id, ts, re }`. `re` repite el nonce, y la cabecera `x-reviver-sig` trae la firma del Reviver sobre `munder-reviver@1|res\n` + el cuerpo.
- **Qué rechaza el cliente:** una respuesta sin esa firma, o con otro `re`.
- **`GET /reviver/v1/hello`:** es lo único sin firma. Devuelve el nombre, la llave pública y el `office_id`.

Solo hay una operación a la vez: si llega otra mientras tanto, la respuesta es `409 busy` y no se encola.

## Recibos

Cada acción que cambia algo deja un recibo en `receipts.jsonl`. `worlds reviver recibos` muestra los últimos.

```json
{
  "receipt_id": "705d1e3b641fa992", "action": "restart", "caller": "local (a6baa7db0e20788d)",
  "requested_at": "…", "accepted": true, "target_office": "d57064f200e341bb",
  "before": { "state": "healthy", "pids": [7428], "health_ok": true, "identity_verified": true, "version": "0.5.2-ISyCo.1" },
  "stop":   { "verified_target": true, "verified_by": "salud+pid+oficina", "pid": 7428,
              "tree": [7428, 7430, 7431, 7588, 7591, 7637], "graceful": true, "forced": [7430, 7431],
              "exit_confirmed": true, "left_running": [] },
  "start":  { "spawned": true, "pid": 9430, "log_file": "…/runs/munder-….log" },
  "after":  { "state": "healthy", "pids": [9430], "health_ok": true, "identity_verified": true },
  "verdict": "healthy", "ok": true, "completed_at": "…"
}
```

- **`verdict`** es uno de:
  - `healthy`;
  - `noop_healthy` («ya estaba sano»);
  - `stopped`;
  - `noop_stopped`;
  - `failed`, y en ese caso `reason` dice por qué.
- **Lanzar no es recuperar:** un restart con el proceso lanzado pero sin salud e identidad termina en `failed`.
- **Qué nunca guarda:** tokens ni llaves. El token de `munder-control.json` solo se usa para preguntar `/salud`.

## Qué para y qué no

`restart` y `stop` le piden al proceso principal que termine: SIGTERM en Linux, `taskkill` sin `/F` en Windows. Si no termina a tiempo, fuerzan **solo** al proceso principal y a sus helpers de Chromium (mismo ejecutable, `--type=`). Cada uno se verifica por pid y por hora de arranque, para no darle a un pid reciclado.

**No toca:**
- **Un `opencode`** o cualquier proceso que solo comparta nombre o binario.
- **Otro ISyCo Worlds** con otro userData.
- **Lo que ISyCo Worlds lanza despegado a propósito**, porque debe sobrevivirle: el daemon de ISyCo Worlds Link y la terminal que le abres a un humano.
- **Los agentes en sus PTYs.** ISyCo Worlds los cierra solo al salir limpio. Si quedan vivos, el recibo los lista en `stop.left_running`: se reportan, no se matan adivinando.

## El watchdog

- **Cuándo se arma:** cuando ve a ISyCo Worlds sano, o después de un `start` o `restart`, dentro de la vida del Reviver. Un archivo viejo no lo arma.
- **Cuándo actúa:** solo si ISyCo Worlds **desapareció**. Un ISyCo Worlds colgado pero vivo se reporta y no se mata: para eso está `restart`.
- **Cierre limpio contra caída:**
  - Salida 0, o por SIGTERM/SIGINT/SIGHUP (`./start.sh --stop`, cerrar sesión): alguien lo cerró, se queda cerrado.
  - SIGKILL, un segfault o un código ≠ 0: caída, lo revive.
  - Si ISyCo Worlds no lo lanzó este Reviver, el indicio es `munder-control.json`, que la app borra al salir limpio.
- **Límite:** 3 intentos en 10 min, con espera de 5 s, 30 s y 2 min entre ellos. Después queda en `failed` hasta que un operador haga `start` o `restart`.
- **`stop`:** deja `desired: stopped`, y el watchdog no lo revive.

## Pruebas

```bash
node --test tools/munder/reviver.test.cjs      # 28 pruebas con procesos reales (Linux, Windows y macOS en CI)
node --test test/control-channel.test.cjs      # /salud con identidad
```

- **El ISyCo Worlds de prueba** es un node de verdad:
  - contesta `/salud` con token y escribe `munder-control.json`;
  - lanza un agente, un helper `--type=renderer` y un «Link» despegado.
- **Qué cubren:**
  - `start`, `start` como NO-OP y `restart`;
  - el lanzamiento que falla, por destino inexistente o porque el proceso muere al arrancar;
  - la identidad equivocada y el destino ambiguo;
  - que un `opencode` humano y otro ISyCo Worlds sobrevivan;
  - el watchdog, el `stop` intencional, el cierre limpio y la tormenta de reinicios;
  - el protocolo: firma, replay, oficina, cliente, `op` cambiada y respuesta falsificada;
  - el adaptador MCP, por stdio real;
  - el daemon como proceso aparte que sobrevive a ISyCo Worlds.

## Límites

- **Máquina apagada o suspendida:** si el sistema operativo no corre, el Reviver tampoco, y ningún software en esa máquina puede contestar. Hace falta Wake-on-LAN desde otra máquina, o una persona. WOL no está en este PR.
- **Sesión gráfica:** ISyCo Worlds es una app de escritorio y necesita la sesión del usuario (Windows: la tarea corre al iniciar sesión; Linux: el escritorio, o linger con `DISPLAY` guardado).
- **ISyCo Worlds en modo dev:** un ISyCo Worlds de `worlds start` (`npm run dev`) no es el destino de `init`, porque tiene otros argumentos. El Reviver lo ve como `foreign`: no lanza un gemelo y no lo mata. Si quieres que el Reviver lo maneje, arráncalo con el Reviver.
- **Sin cifrado:** las peticiones y respuestas van firmadas en los dos sentidos, pero no cifradas. No llevan secretos, solo estado. Fuera de loopback, úsalo sobre Tailscale.

## Siguiente: actualizar de forma segura

La frontera ya está: un proceso independiente que sabe parar, lanzar y verificar a ISyCo Worlds con recibos. Un `update` futuro sería otra operación predefinida del Reviver: parar, `git pull` + `npm ci` + `npm run build` del checkout fijado, lanzar, verificar, y regresar al commit anterior si no queda sano. No va en este PR.
