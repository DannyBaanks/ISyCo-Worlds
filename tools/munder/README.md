# ISyCo Worlds — CLI de control (sin `npm run dev`)

`worlds` arranca, para y observa la app sin tocar Electron a mano.
Node puro, cero dependencias. Linux-first.

## Instala

```bash
./tools/munder/install.sh   # instala worlds y el alias histórico munder
```

Se conserva el alias histórico `munder` por compatibilidad. Para una instalación manual:
`ln -sf "$PWD/tools/munder/munder" ~/.local/bin/worlds`.

Sin args (con TTY) abre el menú interactivo. Sin TTY imprime la ayuda.

## Uso diario

```bash
worlds start          # dev despegado anti-freeze (setsid, log a ~/.local/state/munder/)
worlds status         # PIDs, uptime, puerto 5173, tail del log
worlds logs -f        # seguir el log
worlds stop           # TERM, espera 5s, KILL a lo que quede
worlds restart        # stop + start
worlds check          # verifica package.json + node_modules
```

`WORLDS_DIR` apunta al checkout (defecto: la raíz de este repo).
`WORLDS_STATE_DIR` apunta a estado/logs/pid (defecto: `~/.local/state/munder`).

```bash
WORLDS_DIR=/ruta/a/otro/checkout worlds status
```

`MUNDER_DIR` sigue aceptado como alias antiguo de `WORLDS_DIR`. Regla de oro:
**nunca build (`./start.sh`) + `worlds start` a la vez** — comparten el userData
existente y la segunda instancia muere por singleton.

## Sesión viva

```bash
worlds sesion ver                  # tabla de agentes
worlds sesion armar --nombre X --comando "..." --cwd ...  # crea un agente
worlds sesion quitar <id>          # elimina un agente (id o pty)
worlds ctl ping                    # prueba el canal de control (M0)
worlds repaint                     # repintado sin reiniciar
worlds sesion proveedor            # wizard connect: CLIs, endpoints, modelos
worlds create-harness ~/Dev harness-1  # carpeta de harness completa
```

Si `ctl ping` dice `ECONNREFUSED`, la app murió dejando
`~/.config/munder-difflin/munder-control.json` — arráncala de nuevo.

## Avatares solo con texto (sin keys)

```bash
worlds avatar compilar "piel morena, pelo castaño largo, blusa rosa, gafas"
worlds avatar compilar "piel morena, traje azul" --motor spec --pelo "corto castaño" --salida ./yo.png
worlds avatar inspect ./yo.png     # matriz textual para que el modelo la "vea"
worlds avatar lienzo ./base.png    # lienzo 18×28 para editar con modelo
```

## Inyectar tu avatar al piso (persistente)

```bash
worlds avatar inyectar "piel morena, blusa rosa, gafas" --slot auto
worlds avatar inyectar --ver          # lo guardado
worlds avatar inyectar --quitar --slot kelly
```

Guarda tu receta en `~/.config/munder-difflin/avatar-overrides.json`;
la app la aplica al montar el piso (reinicia para verla) y arma su worker
con `character='<slot>'`. `auto` elige el primer slot libre según la sesión
viva; `michael` nunca se presta (es del GOD).

Motores: `local` (defecto, determinista), `spec` (cuerpo 18×32 con piernas),
`flow` (necesita el pincel FLOW: `flow` en PATH o `FLOW_CLI`), `modelo`
(edita con un endpoint de imagen; key **solo** por variable de entorno).
Mismo texto = mismo PNG. `INVALID_ENUM` + lista = corrige y reintenta.

Detalle del formato para modelos: `AVATAR_AGENTES.md`.
Spec congelado v1: `AVATAR_SPEC.md` + `avatar-spec.schema.json`.

## Oficinas enlazadas (World Link)

Enlaza esta oficina con otra máquina (misma red o Tailscale) para que un agente le
delegue trabajo al otro. En las dos: `worlds link conectar`. Guía completa: [LINK.md](LINK.md).

## Tests

```bash
node tools/munder/avatar.test.cjs
node tools/munder/proveedor.test.cjs
node --test tools/munder/link.test.cjs
```

`avatar-engine.cjs` es GENERATED desde
`src/renderer/src/scene/office/portraitArt.ts` — no se edita a mano:

```bash
node tools/munder/sync-avatar-engine.cjs [--fuente <checkout>]
```

`munder.bash-legacy` es el launcher bash anterior, conservado como referencia.
