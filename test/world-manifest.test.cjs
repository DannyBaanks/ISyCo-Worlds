'use strict';
// node --test test/world-manifest.test.cjs
//
// Provenance is not optional: every world ships a manifest that says who
// made it, under which licence, from where, and what it is built on, and
// every art file a world ships is claimed by exactly one asset entry.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const root = path.join(__dirname, '..');
const M = loadTs('src/shared/worldManifest.ts');
const { WORLD_MANIFESTS, invalidWorldManifests } = loadTs('src/shared/worldManifests.ts');
const { WORLD_IDS } = loadTs('src/shared/worlds.ts');

/** Every file (not dir) under a repo-relative path. */
function filesUnder(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return [];
  if (fs.statSync(abs).isFile()) return [rel];
  return fs.readdirSync(abs).flatMap((name) => filesUnder(path.posix.join(rel.replace(/\/$/, ''), name)));
}

const valid = () => ({
  manifestVersion: 1,
  id: 'test-world',
  name: 'Test World',
  description: 'A world.',
  author: { name: 'Someone' },
  license: 'MIT',
  source: 'https://example.com/world',
  assets: [],
});

test('every bundled world has a manifest, and every manifest validates', () => {
  assert.deepEqual(Object.keys(WORLD_MANIFESTS).sort(), [...WORLD_IDS].sort());
  for (const id of WORLD_IDS) assert.equal(WORLD_MANIFESTS[id].id, id, `${id}: the manifest id matches its key`);
  assert.deepEqual(invalidWorldManifests(), []);
});

test('the validator refuses a world without its provenance', () => {
  assert.deepEqual(M.validateWorldManifest(valid()), []);
  const without = (key) => { const m = valid(); delete m[key]; return m; };
  for (const key of ['name', 'description', 'author', 'license', 'source', 'assets']) {
    assert.ok(M.validateWorldManifest(without(key)).some((e) => e.startsWith(key)), `missing ${key}`);
  }
  assert.ok(M.validateWorldManifest({ ...valid(), author: { name: ' ' } }).length);
  assert.ok(M.validateWorldManifest({ ...valid(), source: 'http://insecure.example' }).length, 'https only');
  assert.ok(M.validateWorldManifest({ ...valid(), id: 'Not Kebab' }).length);
  assert.ok(M.validateWorldManifest({ ...valid(), description: { es: 'sin inglés' } }).length, 'English is required');
  assert.ok(M.validateWorldManifest({ ...valid(), manifestVersion: 2 }).length);
  assert.deepEqual(M.validateWorldManifest('nope'), ['el manifiesto debe ser un objeto']);
});

test('a derived world must credit what it derives from, completely', () => {
  const origin = { name: 'Upstream', author: { name: 'Original author' }, license: 'MIT', source: 'https://example.com/up' };
  assert.deepEqual(M.validateWorldManifest({ ...valid(), derivedFrom: [origin] }), []);
  for (const key of ['name', 'author', 'license', 'source']) {
    const o = { ...origin }; delete o[key];
    assert.ok(M.validateWorldManifest({ ...valid(), derivedFrom: [o] }).some((e) => e.startsWith(`derivedFrom[0].${key}`)), key);
  }
});

test('every asset declares its licence; a restricted one must say what is restricted', () => {
  const asset = { path: 'art/', author: { name: 'Artist' }, license: 'CC0-1.0', redistribution: 'open' };
  assert.deepEqual(M.validateWorldManifest({ ...valid(), assets: [asset] }), []);
  assert.ok(M.validateWorldManifest({ ...valid(), assets: [{ ...asset, license: '' }] }).length);
  assert.ok(M.validateWorldManifest({ ...valid(), assets: [{ ...asset, redistribution: 'maybe' }] }).length);
  assert.ok(M.validateWorldManifest({ ...valid(), assets: [{ ...asset, redistribution: 'restricted' }] })
    .some((e) => /terms es obligatorio/.test(e)));
  assert.deepEqual(M.validateWorldManifest({ ...valid(), assets: [{ ...asset, redistribution: 'restricted', terms: 'No resale.' }] }), []);
  for (const bad of ['/etc/passwd', '../outside/', 'a/../../b']) {
    assert.ok(M.validateWorldManifest({ ...valid(), assets: [{ ...asset, path: bad }] }).length, bad);
  }
});

test('every declared asset path exists, and every shipped world art file is claimed', () => {
  const claimed = new Map();
  for (const m of Object.values(WORLD_MANIFESTS)) {
    for (const a of m.assets) {
      const files = filesUnder(a.path);
      assert.ok(files.length > 0, `${m.id}: ${a.path} does not exist or is empty`);
      for (const f of files) {
        assert.ok(!claimed.has(f), `${f} is claimed by both ${claimed.get(f)} and ${m.id}`);
        claimed.set(f, m.id);
      }
    }
  }
  // The world art directories. A new file dropped in here without a manifest
  // entry fails, so no art arrives uncredited.
  const shipped = ['src/renderer/src/assets/tilesets/', 'src/renderer/src/assets/maps/', 'src/renderer/src/assets/worlds/']
    .flatMap(filesUnder);
  const unclaimed = shipped.filter((f) => !claimed.has(f));
  assert.deepEqual(unclaimed, [], 'world art without a manifest entry');
});

test('Munder Difflin keeps its origin: Chaitanya Giri, MIT, and the LimeZu credit the licence demands', () => {
  const office = WORLD_MANIFESTS.office;
  assert.equal(office.name, 'Munder Difflin');
  assert.equal(office.author.name, 'Chaitanya Giri');
  assert.equal(office.license, 'MIT');
  const limezu = office.assets.find((a) => a.author.name === 'LimeZu');
  assert.ok(limezu, 'LimeZu tilesets are declared');
  assert.equal(limezu.redistribution, 'restricted', 'the LimeZu licence forbids distributing the asset to others');
  assert.match(M.localize(limezu.credit, 'en'), /https:\/\/limezu\.itch\.io\//, 'the required credit link');
  assert.ok(office.disclaimers.some((d) => /NBCUniversal/.test(M.localize(d, 'en'))));
});

test('localize falls back from region to language to English', () => {
  const t = { en: 'hello', es: 'hola' };
  assert.equal(M.localize(t, 'es'), 'hola');
  assert.equal(M.localize(t, 'es-MX'), 'hola');
  assert.equal(M.localize(t, 'ja'), 'hello');
  assert.equal(M.localize('plain', 'es'), 'plain');
});

test('world credits live at the bottom of General settings, straight from each manifest', () => {
  const view = fs.readFileSync(path.join(root, 'src/renderer/src/worlds/WorldsView.tsx'), 'utf8');
  const credits = fs.readFileSync(path.join(root, 'src/renderer/src/worlds/WorldCredits.tsx'), 'utf8');
  const settings = fs.readFileSync(path.join(root, 'src/renderer/src/components/SettingsModal.tsx'), 'utf8');
  const inspirations = fs.readFileSync(path.join(root, 'src/renderer/src/components/InspirationsLicenses.tsx'), 'utf8');
  assert.doesNotMatch(view, /WorldCredits/, 'the profile selector stays focused on choosing a world');
  assert.match(settings, /<InspirationsLicenses \/>/, 'General settings owns the credits surface');
  assert.ok(settings.indexOf('<InspirationsLicenses />') > settings.indexOf("t('settings.general.dangerZone')"), 'credits come after the danger section at the bottom');
  assert.match(inspirations, /<WorldCredits worldId="office" \/>/);
  assert.match(inspirations, /<WorldCredits worldId="monster-trainer" \/>/);
  assert.match(inspirations, /https:\/\/github\.com\/chaitanyagiri\/munder-difflin/);
  assert.match(inspirations, /https:\/\/munderdiffl\.in/);
  assert.match(inspirations, /https:\/\/github\.com\/anomalyco\/opencode/);
  assert.match(inspirations, /https:\/\/opencode\.ai/);
  assert.doesNotMatch(inspirations, /donat|sponsor/i, 'credits do not include a donation or sponsorship CTA');
  const hero = fs.readFileSync(path.join(root, 'src/renderer/src/components/SettingsHeroCard.tsx'), 'utf8');
  assert.doesNotMatch(hero, /munderdiffl\.in\/wall|foundersWall/, 'Settings no longer promotes Munder-branded plans');
  assert.match(credits, /worldManifest\(worldId\)/, 'reads the manifest, never a retyped copy');
  for (const field of ['m.author', 'm.license', 'm.source', 'm.derivedFrom', 'm.assets', 'm.disclaimers', 'a.credit', 'a.terms']) {
    assert.ok(credits.includes(field), `renders ${field}`);
  }
  assert.match(credits, /target="_blank" rel="noreferrer"/, 'links leave through main\'s window-open handler');
  const dir = path.join(root, 'src/renderer/src/i18n/locales');
  const en = JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf8')).settings.general.worlds.credits;
  for (const code of ['es', 'zh-CN', 'ar', 'ja']) {
    const loc = JSON.parse(fs.readFileSync(path.join(dir, `${code}.json`), 'utf8')).settings.general.worlds.credits;
    assert.deepEqual(Object.keys(loc).sort(), Object.keys(en).sort(), code);
  }
});

test('product settings use ISyCo naming while keeping Munder as the office world credit', () => {
  const dir = path.join(root, 'src/renderer/src/i18n/locales');
  for (const code of ['en', 'es', 'zh-CN', 'ar', 'ja']) {
    const locale = JSON.parse(fs.readFileSync(path.join(dir, `${code}.json`), 'utf8'));
    assert.ok(locale.settings.nav.link, `${code}: generic feature name`);
    assert.equal(locale.link.title, locale.settings.nav.link, `${code}: link settings title`);
    assert.doesNotMatch(`${locale.settings.nav.link} ${locale.link.unavailable} ${locale.link.pairingHint}`, /Munder Difflin|Munder Link/);
    assert.match(locale.settings.general.worlds.office, /Munder Difflin/, `${code}: credited world remains named`);
  }
});

test('each manifest name is the name the app shows for that world', () => {
  // The credits box is titled with the manifest name, under a selector that
  // reads the i18n label: if they drift, "ISyCo World" shows someone else's credits title.
  const dir = path.join(root, 'src/renderer/src/i18n/locales');
  const LABEL_KEYS = { office: 'office', 'monster-trainer': 'monsterTrainer' };
  for (const code of ['en', 'es', 'zh-CN', 'ar', 'ja']) {
    const worlds = JSON.parse(fs.readFileSync(path.join(dir, `${code}.json`), 'utf8')).settings.general.worlds;
    for (const id of WORLD_IDS) {
      assert.equal(worlds[LABEL_KEYS[id]], WORLD_MANIFESTS[id].name, `${code}: ${id}`);
    }
  }
});
