'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const { readWorldComposition, writeWorldComposition, worldCompositionsPath } = loadTs('src/main/worldCompositionStore.ts');

function tempUserData(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'md-world-composition-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

const layout = {
  version: 1,
  scenarioId: 'starter-village',
  placements: [{ id: 'lab', definitionId: 'laboratory', x: 3, y: 2 }],
  terrain: [{ x: 1, y: 4, terrainId: 'water' }]
};

test('absent composition reads as an empty optional visual override', (t) => {
  const userData = tempUserData(t);
  assert.deepEqual(readWorldComposition(userData, 'monster-trainer', 'starter-village'), { ok: true, layout: null });
  assert.equal(fs.existsSync(worldCompositionsPath(userData)), false);
});

test('valid terrain and placements round-trip through a fixed userData file', (t) => {
  const userData = tempUserData(t);
  assert.deepEqual(writeWorldComposition(userData, 'monster-trainer', layout), { ok: true });
  assert.deepEqual(readWorldComposition(userData, 'monster-trainer', 'starter-village'), { ok: true, layout });
  assert.equal(path.basename(worldCompositionsPath(userData)), 'world-compositions.json');
  assert.deepEqual(fs.readdirSync(userData), ['world-compositions.json']);
});

test('corrupt persisted bytes are reported without being rewritten during read', (t) => {
  const userData = tempUserData(t);
  const filename = worldCompositionsPath(userData);
  fs.mkdirSync(userData, { recursive: true });
  fs.writeFileSync(filename, '{ not json', 'utf8');
  const before = fs.readFileSync(filename);
  assert.deepEqual(readWorldComposition(userData, 'monster-trainer', 'starter-village'), { ok: false, category: 'invalid' });
  assert.deepEqual(fs.readFileSync(filename), before);
});

test('invalid schema, profile and scenario are rejected without clobbering a valid save', (t) => {
  const userData = tempUserData(t);
  assert.deepEqual(writeWorldComposition(userData, 'office', layout), { ok: false, category: 'invalid' });
  assert.deepEqual(writeWorldComposition(userData, 'monster-trainer', { ...layout, terrain: [{ x: -1, y: 0, terrainId: 'water' }] }), { ok: false, category: 'invalid' });
  assert.deepEqual(readWorldComposition(userData, 'monster-trainer', 'another-scenario'), { ok: false, category: 'invalid' });
  assert.deepEqual(writeWorldComposition(userData, 'monster-trainer', layout), { ok: true });
  assert.deepEqual(readWorldComposition(userData, 'monster-trainer', 'starter-village'), { ok: true, layout });
});

test('persistence API takes identity/data only and never accepts a caller-selected path', () => {
  assert.equal(readWorldComposition.length, 3);
  assert.equal(writeWorldComposition.length, 3);
});

test('parent preload exposes typed composition IPC, while isolated world host has no disk API', () => {
  const root = path.resolve(__dirname, '..');
  const preload = fs.readFileSync(path.join(root, 'src/preload/index.ts'), 'utf8');
  const childBridge = fs.readFileSync(path.join(root, 'src/preload/worldHost.ts'), 'utf8');
  const main = fs.readFileSync(path.join(root, 'src/main/index.ts'), 'utf8');
  assert.match(preload, /getWorldComposition\s*:/);
  assert.match(preload, /saveWorldComposition\s*:/);
  assert.doesNotMatch(childBridge, /world-composition|saveWorldComposition|getWorldComposition/);
  assert.match(main, /world-composition:get[\s\S]*event\.sender !== worldPresentationOwner\.webContents/);
  assert.match(main, /world-composition:save[\s\S]*event\.sender !== worldPresentationOwner\.webContents/);
});
