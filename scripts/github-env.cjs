#!/usr/bin/env node
'use strict';
/**
 * Append variables to $GITHUB_ENV safely, for values that come from Secrets.
 *
 *   node scripts/github-env.cjs CSC_LINK=P12_B64:base64 CSC_KEY_PASSWORD=P12_PASS
 *
 * Each argument is TARGET=SOURCE[:base64]. The VALUE is read from the SOURCE
 * environment variable, never from argv, so a secret never lands in a process
 * listing or a log line. An empty or missing SOURCE is skipped: the TARGET
 * stays genuinely absent (electron-builder treats a set-but-empty CSC_LINK as
 * a file path and dies).
 *
 * Why not `echo "NAME=$value" >> $GITHUB_ENV`: GNU `base64` wraps every 76
 * columns, and every line after the first became its own (bogus) variable
 * while NAME kept only the first 76 chars. Here every entry uses the
 * multiline form `NAME<<DELIM`, with a random delimiter that is checked not to
 * occur in the value. `:base64` also strips all whitespace, so the consumer
 * gets one unbroken base64 string whatever tool produced the secret.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** One GITHUB_ENV entry in the multiline form. Throws on anything unsafe. */
function entry(name, value, { base64 = false, delimiter } = {}) {
  if (!NAME.test(name)) throw new Error(`nombre de variable inválido: ${name}`);
  let v = String(value);
  if (base64) {
    v = v.replace(/\s+/g, '');
    if (!B64.test(v) || v.length % 4 !== 0) throw new Error(`${name}: el secreto no es base64 válido`);
  }
  const d = delimiter || `ghadelimiter_${crypto.randomBytes(16).toString('hex')}`;
  if (v.includes(d)) throw new Error(`${name}: el valor contiene el delimitador`);
  return `${name}<<${d}\n${v}\n${d}\n`;
}

/** Parse `TARGET=SOURCE[:base64]` specs against an env; skips empty sources. */
function build(specs, env = process.env) {
  let out = '';
  const written = [];
  for (const spec of specs) {
    const m = /^([^=]+)=([^:]+)(?::(base64))?$/.exec(spec);
    if (!m) throw new Error(`argumento inválido: ${spec} (se espera DESTINO=ORIGEN[:base64])`);
    const [, target, source, mode] = m;
    const value = env[source];
    if (value === undefined || value === '') continue;
    out += entry(target, value, { base64: mode === 'base64' });
    written.push(target);
  }
  return { out, written };
}

if (require.main === module) {
  try {
    const file = process.env.GITHUB_ENV;
    if (!file) throw new Error('GITHUB_ENV no está definido');
    const { out, written } = build(process.argv.slice(2));
    if (out) fs.appendFileSync(file, out);
    // Names only, never values.
    console.log(written.length ? `GITHUB_ENV: ${written.join(', ')}` : 'GITHUB_ENV: nada que escribir');
  } catch (e) {
    console.error(`::error::${e.message}`);
    process.exit(1);
  }
}

module.exports = { entry, build };
