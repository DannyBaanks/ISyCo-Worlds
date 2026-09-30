# Firma de las releases (Android y Apple)

La release (`.github/workflows/release.yml`, al empujar un tag `v*`) firma con
llaves que viven **solo en GitHub Secrets**. Nada de esto se guarda en el repo:
ni keystores, ni certificados, ni contraseñas. `test/github-env.test.cjs`
falla si alguien sube un `.jks`, `.keystore`, `.p12`, `.pfx`, `.pem` o `.key`.

## Android: una sola llave, para siempre

Android solo deja instalar una versión nueva **encima** de la anterior si las dos
están firmadas con la misma llave. Si la llave cambia, sale "App no instalada",
y la única salida es desinstalar, con lo que se pierde el emparejamiento.

Por eso el job `mobile-android` es *fail-closed*:

| Situación | Resultado |
|---|---|
| Faltan secretos o la variable de huella | **Falla**: "Firma de Android sin configurar". No se publica nada. |
| El APK sale firmado con otra llave | **Falla**: "Llave de Android distinta". No se publica. |
| Llave correcta | Publica `MunderMobile-release.apk` (`assembleRelease`). |

Nunca publica el APK de debug: su llave la genera cada runner y cambia en cada
corrida.

### Qué configurar (una vez)

En **Settings → Secrets and variables → Actions** del repo:

| Nombre | Tipo | Contenido |
|---|---|---|
| `ANDROID_KEYSTORE_B64` | Secret | El keystore en base64 (con o sin saltos de línea). |
| `ANDROID_KEYSTORE_PASSWORD` | Secret | Contraseña del keystore. |
| `ANDROID_KEY_ALIAS` | Secret | Alias de la llave dentro del keystore. |
| `ANDROID_KEY_PASSWORD` | Secret (opcional) | Contraseña de la llave; si no está, se usa la del keystore. |
| `ANDROID_SIGNING_CERT_SHA256` | **Variable** (no secreta) | Huella SHA-256 del certificado, con o sin `:`. |

La huella es lo que garantiza la continuidad. Si alguien cambia el keystore en
Secrets por otro, la huella ya no coincide y la release se detiene en vez de
publicar una firma nueva.

Para crear la llave, **fuera del repo** y guardando una copia de respaldo en un
lugar seguro. Si se pierde, no hay forma de actualizar la app instalada.

```sh
keytool -genkeypair -keystore munder-release.jks -storetype PKCS12 \
  -alias munder -keyalg RSA -keysize 4096 -validity 36500 \
  -dname "CN=Munder Mobile"
base64 -w0 munder-release.jks          # -> ANDROID_KEYSTORE_B64 (en macOS: base64 -i munder-release.jks)
keytool -list -v -keystore munder-release.jks -alias munder | grep SHA256:
                                        # -> ANDROID_SIGNING_CERT_SHA256
```

### Qué está probado y qué no

- `android.yml` → job **Release signing (throwaway key)** corre el mismo
  `android/MunderMobile/scripts/release-apk.sh` con una llave desechable
  generada en el runner. Demuestra tres cosas:
  - sin secretos, falla;
  - con la llave correcta, `assembleRelease` firma y `apksigner` confirma la huella;
  - con otra huella, se niega a publicar.
- La **llave real** solo existe en Secrets. Se comprueba en cada release, no
  en las PRs.

### A tener en cuenta

- El APK de release es `mx.isyco.munder.mobile`. El de debug que se publicó
  antes es `mx.isyco.munder.mobile.debug`, es decir, otra app. Quien tenga el
  debug instala la release una vez como app nueva y la empareja; desde ahí
  actualiza encima.
- `versionCode` sigue fijo en `1` (`app/build.gradle.kts`). Con la misma
  firma se puede reinstalar encima, pero para que Android lo trate como
  actualización hay que subirlo en cada release. Queda pendiente.
- Un "dry-build" con `workflow_dispatch` también falla sin los secretos.

## Apple (macOS): certificado Developer ID

Todo es opcional: sin estos secretos, el build de macOS sale sin firmar y sigue
en verde.

| Secret | Contenido |
|---|---|
| `APPLE_CERTIFICATE_P12` | El `.p12` "Developer ID Application" en base64. |
| `APPLE_CERTIFICATE_PASSWORD` | La contraseña de exportación del `.p12`. |
| `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | Notarización. |

`scripts/github-env.cjs` pasa `CSC_LINK` y `CSC_KEY_PASSWORD` a
electron-builder con el formato multilínea de `GITHUB_ENV` y quita los saltos
de línea del base64. Antes, un base64 hecho con `base64` de Linux (corta cada
76 columnas) dejaba `CSC_LINK` truncado a su primera línea.
`test/github-env.test.cjs` lo reproduce con un certificado falso partido en
varias líneas y comprueba que llega entero.
