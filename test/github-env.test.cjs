'use strict';
// node --test test/github-env.test.cjs
//
// Release signing, checked without GitHub: how secrets reach $GITHUB_ENV
// (Apple) and what the Android release job is allowed to publish.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const G = require('../scripts/github-env.cjs');

/**
 * Read a GITHUB_ENV file the way the Actions runner does: `NAME<<DELIM`
 * starts a multiline value that ends at a line equal to DELIM; any other
 * line is `NAME=VALUE`.
 */
function parseGithubEnv(text) {
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  const env = {};
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h = /^([^=<]+)<<(.+)$/.exec(line);
    if (h && !line.includes('=')) {
      const body = [];
      for (i++; i < lines.length && lines[i] !== h[2]; i++) body.push(lines[i]);
      if (i >= lines.length) throw new Error(`delimitador sin cerrar para ${h[1]}`);
      env[h[1]] = body.join('\n');
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0) throw new Error(`línea inválida: ${line}`);
    env[line.slice(0, eq)] = line.slice(eq + 1);
  }
  return env;
}

/** A fake .p12 as GNU `base64` prints it: wrapped every 76 columns. */
function wrappedB64(bytes) {
  const b64 = bytes.toString('base64');
  return b64.match(/.{1,76}/g).join('\n');
}

function runScript(args, env) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghenv-'));
  const file = path.join(dir, 'env');
  fs.writeFileSync(file, '');
  const r = spawnSync(process.execPath, [path.join(root, 'scripts/github-env.cjs'), ...args], {
    encoding: 'utf8', env: { PATH: process.env.PATH, GITHUB_ENV: file, ...env },
  });
  const out = fs.readFileSync(file, 'utf8');
  fs.rmSync(dir, { recursive: true, force: true });
  return { ...r, out };
}

test('the old `echo NAME=$value` truncated a wrapped certificate (why this exists)', () => {
  const cert = crypto.randomBytes(3000);
  const wrapped = wrappedB64(cert);
  assert.ok(wrapped.split('\n').length > 1);
  const old = `CSC_LINK=${wrapped}\n`;
  // The runner rejects or mangles it: the second line is not NAME=VALUE.
  assert.throws(() => parseGithubEnv(old), /línea inválida/);
});

test('a wrapped base64 certificate reaches CSC_LINK whole and unbroken', () => {
  const cert = crypto.randomBytes(3000);
  const pass = 'p@ss "x" $y `z` \\ ; & <<EOF';
  const r = runScript(['CSC_LINK=P12_B64:base64', 'CSC_KEY_PASSWORD=P12_PASS'], { P12_B64: `${wrappedB64(cert)}\r\n`, P12_PASS: pass });
  assert.equal(r.status, 0, r.stderr);
  const env = parseGithubEnv(r.out);
  assert.deepEqual(Object.keys(env), ['CSC_LINK', 'CSC_KEY_PASSWORD']);
  assert.doesNotMatch(env.CSC_LINK, /\s/);
  assert.ok(Buffer.from(env.CSC_LINK, 'base64').equals(cert), 'decodes to the same bytes');
  assert.equal(env.CSC_KEY_PASSWORD, pass);
  // Only names are logged, never values.
  assert.equal(r.stdout.trim(), 'GITHUB_ENV: CSC_LINK, CSC_KEY_PASSWORD');
  assert.ok(!r.stdout.includes(env.CSC_LINK.slice(0, 20)) && !r.stdout.includes(pass));
});

test('unconfigured secrets leave the variables ABSENT, not empty', () => {
  const r = runScript(['CSC_LINK=P12_B64:base64', 'CSC_KEY_PASSWORD=P12_PASS'], { P12_B64: '', P12_PASS: '' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.out, '');
  assert.match(r.stdout, /nada que escribir/);
});

test('a secret that is not base64 fails loudly instead of shipping garbage', () => {
  const r = runScript(['CSC_LINK=P12_B64:base64'], { P12_B64: 'not base64 at all!' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /::error::CSC_LINK: el secreto no es base64 válido/);
  assert.equal(r.out, '');
});

test('the delimiter can never be forged by the value', () => {
  assert.throws(() => G.entry('X', 'a\nD\nY=evil', { delimiter: 'D' }), /delimitador/);
  const e = G.entry('X', 'line1\nline2');
  assert.deepEqual(parseGithubEnv(e), { X: 'line1\nline2' });
  assert.throws(() => G.entry('BAD NAME', 'v'), /nombre de variable/);
  assert.throws(() => G.build(['NOEQUALS']), /argumento inválido/);
});

test('release.yml: Apple uses the script; Android publishes only a verified release APK', () => {
  const wf = fs.readFileSync(path.join(root, '.github/workflows/release.yml'), 'utf8');
  assert.match(wf, /node scripts\/github-env\.cjs CSC_LINK=P12_B64:base64 CSC_KEY_PASSWORD=P12_PASS/);
  assert.doesNotMatch(wf, /^\s*(?:if .*then\s*)?echo "CSC_LINK=/m, "no raw NAME=value write (comments may mention it)");
  const android = wf.slice(wf.indexOf('  mobile-android:'));
  assert.doesNotMatch(android, /assembleDebug|MunderMobile-debug/, 'never the debug APK as a release');
  assert.match(android, /bash scripts\/release-apk\.sh/);
  assert.match(android, /EXPECTED_CERT_SHA256: \$\{\{ vars\.ANDROID_SIGNING_CERT_SHA256 \}\}/);
  assert.match(wf, /needs: \[build, mobile-ios, mobile-android\]/, 'a failed Android signing blocks the release');

  const sh = fs.readFileSync(path.join(root, 'android/MunderMobile/scripts/release-apk.sh'), 'utf8');
  assert.match(sh, /assembleRelease/);
  assert.doesNotMatch(sh, /assembleDebug/);
  assert.match(sh, /apksigner.*verify --print-certs/s);
  assert.match(sh, /\[ "\$got" != "\$want" \]/);
});

test('no signing material is tracked in the repo', () => {
  const r = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0);
  const bad = r.stdout.split('\n').filter((f) => /\.(jks|keystore|p12|pfx|pem|key)$/i.test(f));
  assert.deepEqual(bad, []);
  const gradle = fs.readFileSync(path.join(root, 'android/MunderMobile/app/build.gradle.kts'), 'utf8');
  assert.match(gradle, /env\("MUNDER_ANDROID_KEYSTORE"\)/, 'the keystore path comes from the environment');
  assert.doesNotMatch(gradle, /storeFile = file\("[^"]/, 'no hardcoded keystore path');
});
