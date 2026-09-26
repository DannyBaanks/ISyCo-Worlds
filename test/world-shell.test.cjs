'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const source = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('App replaces only its floor slot and preserves the existing operational surfaces', () => {
  const app = source('src/renderer/src/App.tsx');
  assert.match(app, /<WorldHost\s+config=\{config\}\s*\/>/);
  assert.match(app, /<MemoryPanel\s*\/>/);
  assert.match(app, /<AgentStrip\s+config=\{config\}\s*\/>/);
  assert.doesNotMatch(app, /<OfficeFloor\s*\/>/);
});

test('world controls change visual preferences only', () => {
  const selector = source('src/renderer/src/components/WorldSelector.tsx');
  const settings = source('src/renderer/src/components/WorldsSettings.tsx');
  for (const control of [selector, settings]) {
    assert.match(control, /updateConfig\(/);
    assert.doesNotMatch(control, /hiveTasks|setAgent|archiveAgent|saveWorldProfile/);
  }
  assert.match(selector, /selectedWorld/);
  assert.match(settings, /worldsEnabled/);
});

test('World translations expose the same key set in every supported locale', () => {
  const locales = ['en.json', 'es.json', 'zh-CN.json', 'ar.json'].map((file) =>
    JSON.parse(fs.readFileSync(path.join(root, 'src/renderer/src/i18n/locales', file), 'utf8')).settings.general.worlds
  );
  const keys = Object.keys(locales[0]).sort();
  for (const entry of locales.slice(1)) assert.deepEqual(Object.keys(entry).sort(), keys);
});
