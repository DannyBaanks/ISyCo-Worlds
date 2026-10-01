'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');
const root = path.join(__dirname, '..');
const { STARTER_VILLAGE_ATLAS_FRAMES: frames } = loadTs('src/renderer/src/worlds/monster/StarterVillageAtlasFrames.ts');

test('every scene frame fits the supplied PNG and has a whole-tile footprint', () => {
  const png = fs.readFileSync(path.join(root, 'src/renderer/src/assets/worlds/starter-village/starter-village-atlas.png'));
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  assert.equal(Object.keys(frames).length, 17);
  for (const [id,f] of Object.entries(frames)) {
    assert(f.x >= 0 && f.y >= 0 && f.width > 0 && f.height > 0, id);
    assert(f.x + f.width <= width && f.y + f.height <= height, id+' source rectangle');
    assert.equal(f.renderWidth % 16, 0, id+' width');
    assert.equal(f.renderHeight % 16, 0, id+' height');
  }
});

test('worlds presentation labels exist in all five locales', () => {
  let expected;
  for (const lang of ['en','es','ar','ja','zh-CN']) {
    const locale = JSON.parse(fs.readFileSync(path.join(root, `src/renderer/src/i18n/locales/${lang}.json`)));
    const keys = Object.keys(locale.worldsVisual).sort();
    if (!expected) expected = keys;
    assert.deepEqual(keys, expected);
    for (const value of Object.values(locale.worldsVisual)) assert(value.trim().length > 0);
  }
});

function luminance(hex) {
  const rgb = hex.match(/[\da-f]{2}/gi).map(n => parseInt(n,16)/255).map(n => n <= .04045 ? n/12.92 : ((n+.055)/1.055)**2.4);
  return rgb[0]*.2126 + rgb[1]*.7152 + rgb[2]*.0722;
}
test('warm paper text ramps retain WCAG AA contrast in both themes', () => {
  const css=fs.readFileSync(path.join(root,'src/renderer/src/design/worlds.css'),'utf8');
  for (const selector of [':root {', ":root[data-cth-theme='dark'] {"]) {
    const block=css.slice(css.indexOf(selector)).split('}')[0];
    const token=name=>block.match(new RegExp('--cth-'+name+':\\s*(#[a-fA-F0-9]{6})'))[1];
    for (const ink of ['ink-900','ink-700','ink-500']) for (const paper of ['cream-100','paper-100','paper-200']) {
      const levels=[luminance(token(ink)),luminance(token(paper))].sort((a,b)=>b-a);
      assert((levels[0]+.05)/(levels[1]+.05)>=4.5, `${selector} ${ink} on ${paper}`);
    }
  }
});
