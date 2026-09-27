'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = (name) => fs.readFileSync(path.resolve(__dirname, '..', name), 'utf8');

test('profile selector distinguishes the active runtime from the saved preference', () => {
  const view = source('src/renderer/src/worlds/WorldsView.tsx');
  assert.match(view, /getWorldProfileStatus/);
  assert.match(view, /activeProfileId/);
  assert.match(view, /preferredWorldProfile/);
});

test('changing an active profile asks for confirmation and activates only through the runtime API', () => {
  const view = source('src/renderer/src/worlds/WorldsView.tsx');
  assert.match(view, /requestWorldProfileActivation/);
  assert.match(view, /confirmWorldProfileActivation/);
  assert.match(view, /confirmation-required/);
  assert.doesNotMatch(view, /updateConfig\(\{\s*selectedWorld/);
});

test('Worlds is not a global visual tab; Settings remains the explicit restart surface', () => {
  const app = source('src/renderer/src/App.tsx');
  const nav = source('src/renderer/src/components/GlobalNav.tsx');
  const settings = source('src/renderer/src/components/WorldsSettings.tsx');
  assert.doesNotMatch(app, /globalView === 'worlds'/);
  assert.doesNotMatch(nav, /onView\('worlds'\)/);
  assert.match(settings, /WorldsView/);
  assert.match(nav, /onView\('marketplace'\)/);
});

test('legacy persisted Worlds route hydrates to Office without writing during hydration', () => {
  const app = source('src/renderer/src/App.tsx');
  assert.match(app, /lastGlobalView === 'marketplace' \? 'marketplace' : 'office'/);
  assert.match(app, /globalViewHydrated\.current/);
});
