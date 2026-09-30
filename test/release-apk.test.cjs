'use strict';
// node --test test/release-apk.test.cjs
//
// android/MunderMobile/scripts/release-apk.sh, on the paths that need no
// Android SDK: every early failure must leave NO MunderMobile-release.apk
// behind, not even one from an earlier run, so nobody mistakes a stale APK
// for the output of a run that just failed. The signing path itself (Gradle
// + apksigner) is witnessed in android.yml with a throwaway key.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const script = path.join(__dirname, '..', 'android', 'MunderMobile', 'scripts', 'release-apk.sh');
const FP = 'ab'.repeat(32);
const skip = process.platform === 'win32' ? 'bash script; the release job runs on ubuntu' : false;

/** Run the script in a scratch dir that already holds a stale APK. */
function runWithStaleApk(env) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-apk-'));
  const apk = path.join(dir, 'MunderMobile-release.apk');
  fs.writeFileSync(apk, 'stale APK from an earlier run');
  const r = spawnSync('bash', [script], {
    cwd: dir, encoding: 'utf8',
    env: { PATH: process.env.PATH, TMPDIR: dir, ...env },
  });
  const left = fs.existsSync(apk);
  const jks = fs.readdirSync(dir).filter((f) => f.endsWith('.jks'));
  fs.rmSync(dir, { recursive: true, force: true });
  return { ...r, out: `${r.stdout}${r.stderr}`, left, jks };
}

const full = { KS_B64: 'AAAA', MUNDER_ANDROID_KEYSTORE_PASSWORD: 'p', MUNDER_ANDROID_KEY_ALIAS: 'a', EXPECTED_CERT_SHA256: FP };

test('missing secrets: fails closed and removes a stale APK', { skip }, () => {
  const r = runWithStaleApk({});
  assert.equal(r.status, 1);
  assert.match(r.out, /Firma de Android sin configurar/);
  assert.equal(r.left, false, 'a stale APK must not survive a failed run');
});

test('malformed fingerprint: fails closed and removes a stale APK', { skip }, () => {
  const r = runWithStaleApk({ ...full, EXPECTED_CERT_SHA256: 'zz' });
  assert.equal(r.status, 1);
  assert.match(r.out, /no es una huella SHA-256/);
  assert.equal(r.left, false);
});

test('invalid keystore base64: fails closed, removes a stale APK, leaves no keystore', { skip }, () => {
  const r = runWithStaleApk({ ...full, KS_B64: '@@not base64' });
  assert.equal(r.status, 1);
  assert.match(r.out, /no es base64 válido/);
  assert.equal(r.left, false);
  assert.deepEqual(r.jks, [], 'the temporary keystore is deleted');
});
