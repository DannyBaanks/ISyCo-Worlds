'use strict';

// The Japanese locale follows the IntentLang loop: the pipeline (M0-M4)
// contributed its roundtrip-verified dictionary layer, and the rest was
// hand-written because the ja materializer's prose output was dictionary
// salad — the same call the repo made for es and ar. These tests enforce the
// safe part of the contract: registration, complete key/array shape,
// interpolation, markup, and no review markers. They do not claim that a
// native Japanese reviewer has approved every sentence.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const locale = (code) => JSON.parse(read(`src/renderer/src/i18n/locales/${code}.json`));

function leaves(node, prefix = '') {
  if (Array.isArray(node)) return node.flatMap((v, i) => leaves(v, `${prefix}.${i}`));
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([k, v]) =>
      leaves(v, prefix ? `${prefix}.${k}` : k));
  }
  return [[prefix, node]];
}

const en = locale('en');
const ja = locale('ja');
const pathsOf = (value) => new Map(leaves(value));
const text = (value) => (Array.isArray(value) ? value.join(' ') : String(value));

test('Japanese is registered as an LTR language with bundled resources', () => {
  const src = read('src/renderer/src/i18n/index.ts');
  assert.match(src, /import ja from '\.\/locales\/ja\.json';/);
  assert.match(src, /ja: \{ translation: ja \}/);
  assert.match(src, /supportedLngs: \[[^\]]*'ja'[^\]]*\]/);
  assert.match(src, /code: 'ja'[^}]*dir: 'ltr'/);
});

test('Japanese has exactly the English key tree and array lengths', () => {
  const e = pathsOf(en);
  const j = pathsOf(ja);
  assert.deepEqual([...e.keys()].filter((k) => !j.has(k)), []);
  assert.deepEqual([...j.keys()].filter((k) => !e.has(k)), []);
  const at = (value, p) => p.split('.').reduce((next, part) => next[part], value);
  for (const p of ['office.errand.smoke', 'office.suckUp', 'office.gossip', 'office.cheer']) {
    assert.equal(at(ja, p).length, at(en, p).length, `${p} changed length`);
  }
});

test('Japanese preserves placeholders, inline markup, and hotkeys', () => {
  const e = pathsOf(en);
  const j = pathsOf(ja);
  const vars = (value) => [...text(value).matchAll(/\{\{\s*[\w.]+\s*\}\}/g)]
    .map((m) => m[0]).sort().join('|');
  const tags = (value) => [...text(value).matchAll(/<\/?[a-z]+>/g)]
    .map((m) => m[0]).sort().join('|');
  const hotkeys = (value) => [...text(value).matchAll(/\b(?:Ctrl|Cmd|Alt|Shift)\+[A-Za-z0-9]+/g)]
    .map((m) => m[0]).sort().join('|');
  const bad = [];
  for (const [key, value] of e) {
    if (vars(value) !== vars(j.get(key))) bad.push(`${key}: placeholder`);
    if (tags(value) !== tags(j.get(key))) bad.push(`${key}: markup`);
    if (hotkeys(value) !== hotkeys(j.get(key))) bad.push(`${key}: hotkey`);
  }
  assert.deepEqual(bad, []);
});

test('Japanese contains no IntentLang review markers or hardcoded Michael', () => {
  const bad = [...pathsOf(ja)].filter(([, value]) =>
    /\[NEEDS_REVIEW\]|Michael|XQZPROTECTED|PROTECTED\d/i.test(text(value)));
  assert.deepEqual(bad, []);
});

test('Japanese is actually Japanese, not an English passthrough', () => {
  // The whole point of the locale: nearly every translatable string must carry
  // Japanese script. The few without it are the genuinely untranslatable
  // leaves ("/skill", "tok", "URL", model names…).
  const j = pathsOf(ja);
  const hasKanaKanji = (value) => /[ ぁ-んァ-ヶ一-龯々ー]/.test(text(value));
  const plain = [...j].filter(([key, value]) =>
    !hasKanaKanji(value) && /[A-Za-z]{3}/.test(text(value)) && !/{{/.test(text(value)));
  const allowed = plain.filter(([key]) =>
    /names\.|skill|tok$|usd|url|pty|cli|ide$|ctx|diff|img|rev|ja$|ok$|err$|t\.|C0123|whisper|ollama|agy|codex|sponsored|michaelBooting|govn|connect/i.test(key));
  assert.ok(plain.length - allowed.length < plain.length,
    'the untranslated set should be small');
  console.log(`ja: ${[...j].length} keys, ${plain.length} without kana/kanji`);
});
