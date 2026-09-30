#!/usr/bin/env bash
# El APK de la release: assembleRelease firmado con la llave estable y
# verificado contra la huella que ya tienen instalada los usuarios.
#
#   KS_B64                            keystore (.jks) en base64   (secrets.ANDROID_KEYSTORE_B64)
#   MUNDER_ANDROID_KEYSTORE_PASSWORD  clave del keystore          (secrets.ANDROID_KEYSTORE_PASSWORD)
#   MUNDER_ANDROID_KEY_ALIAS          alias de la llave           (secrets.ANDROID_KEY_ALIAS)
#   MUNDER_ANDROID_KEY_PASSWORD       clave de la llave; opcional (secrets.ANDROID_KEY_PASSWORD)
#   EXPECTED_CERT_SHA256              huella SHA-256 del cert.    (vars.ANDROID_SIGNING_CERT_SHA256)
#
# Fail-closed: si falta algo, o la firma no es la esperada, sale con error y
# no deja APK. Publicar otra firma (o el debug, cuya llave cambia en cada
# runner) impediría actualizar la app. Ver docs/release-signing/README.md.
#
# Se corre desde android/MunderMobile. Deja MunderMobile-release.apk ahí.
set -euo pipefail

# Primero, antes de cualquier validación: un APK de una corrida anterior no
# debe sobrevivir a esta si falla, o parecería su resultado.
rm -f MunderMobile-release.apk

missing=""
[ -n "${KS_B64:-}" ] || missing="$missing secrets.ANDROID_KEYSTORE_B64"
[ -n "${MUNDER_ANDROID_KEYSTORE_PASSWORD:-}" ] || missing="$missing secrets.ANDROID_KEYSTORE_PASSWORD"
[ -n "${MUNDER_ANDROID_KEY_ALIAS:-}" ] || missing="$missing secrets.ANDROID_KEY_ALIAS"
[ -n "${EXPECTED_CERT_SHA256:-}" ] || missing="$missing vars.ANDROID_SIGNING_CERT_SHA256"
if [ -n "$missing" ]; then
  echo "::error title=Firma de Android sin configurar::Faltan:$missing. No se publica un APK sin la llave estable (ni el debug): los usuarios no podrían actualizar. Ver docs/release-signing/README.md."
  exit 1
fi

norm() { tr -d ': \r\n\t' | tr 'A-F' 'a-f'; }
want=$(printf '%s' "$EXPECTED_CERT_SHA256" | norm)
if ! [[ "$want" =~ ^[0-9a-f]{64}$ ]]; then
  echo "::error::vars.ANDROID_SIGNING_CERT_SHA256 no es una huella SHA-256 (64 hex, con o sin ':')."
  exit 1
fi

tmp="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
export MUNDER_ANDROID_KEYSTORE="$tmp/munder-release-$$.jks"
trap 'rm -f "$MUNDER_ANDROID_KEYSTORE"' EXIT
( umask 077; printf '%s' "$KS_B64" | tr -d ' \r\n\t' | base64 -d > "$MUNDER_ANDROID_KEYSTORE" ) || {
  echo "::error::secrets.ANDROID_KEYSTORE_B64 no es base64 válido."
  exit 1
}

./gradlew :app:assembleRelease --stacktrace

apk=$(find app/build/outputs/apk/release -name '*.apk' ! -name '*unsigned*' | head -1)
[ -n "$apk" ] || { echo "::error::assembleRelease no produjo un APK firmado."; exit 1; }

apksigner=$(find "${ANDROID_HOME:?ANDROID_HOME no está definido}/build-tools" -name apksigner -type f | sort -V | tail -1)
[ -n "$apksigner" ] || { echo "::error::apksigner no está en ANDROID_HOME/build-tools."; exit 1; }
certs=$("$apksigner" verify --print-certs "$apk")
signers=$(grep -c 'certificate SHA-256 digest' <<<"$certs" || true)
[ "$signers" = "1" ] || { echo "::error::Se esperaba 1 firmante y hay $signers."; exit 1; }
got=$(sed -n 's/.*certificate SHA-256 digest: //p' <<<"$certs" | norm)

if [ "$got" != "$want" ]; then
  echo "::error title=Llave de Android distinta::El APK se firmó con $got y la esperada es $want. Publicarlo impediría actualizar la app; no se publica."
  exit 1
fi

cp "$apk" MunderMobile-release.apk
echo "Firma verificada: $got"
ls -la MunderMobile-release.apk
