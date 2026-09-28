'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('one startup surface covers first-run setup, harness picking, and missing-world recovery', () => {
  const app = read('src/renderer/src/App.tsx');
  assert.match(app, /<WorldStartScreen\b/);
  assert.doesNotMatch(app, /return <OnboardingWizard\b/);
  assert.doesNotMatch(app, /return <HivePicker\b/);
  assert.doesNotMatch(app, /return <WorldsView\b/);
});

test('startup route stays visible until onboarding, harness, and world runtime are ready', () => {
  const { shouldShowWorldStartScreen } = loadTs('src/renderer/src/startup/startScreenRoute.ts');
  assert.equal(shouldShowWorldStartScreen({ onboardingComplete: false, hiveOpened: true, activeProfileId: 'office' }), true);
  assert.equal(shouldShowWorldStartScreen({ onboardingComplete: true, hiveOpened: false, activeProfileId: 'office' }), true);
  assert.equal(shouldShowWorldStartScreen({ onboardingComplete: true, hiveOpened: true, activeProfileId: null }), true);
  assert.equal(shouldShowWorldStartScreen({ onboardingComplete: true, hiveOpened: true, activeProfileId: undefined }), false, 'wait for runtime status instead of flashing the entry screen');
  assert.equal(shouldShowWorldStartScreen({ onboardingComplete: true, hiveOpened: true, activeProfileId: 'monster-trainer' }), false);
});

test('startup selection coalesces a harness change with the selected profile for the next bootstrap', () => {
  const { planStartupSelection } = loadTs('src/renderer/src/startup/startScreenRoute.ts');
  assert.deepEqual(planStartupSelection({
    selectedHome: '/work/new-harness', currentHome: '/work/old-harness',
    selectedProfileId: 'monster-trainer', activeProfileId: 'office'
  }), { type: 'switch-harness', harnessHome: '/work/new-harness', preferredProfileId: 'monster-trainer' });
  assert.deepEqual(planStartupSelection({
    selectedHome: '/work/current', currentHome: '/work/current',
    selectedProfileId: 'monster-trainer', activeProfileId: 'office'
  }), { type: 'activate-profile', profileId: 'monster-trainer' });
  assert.deepEqual(planStartupSelection({
    selectedHome: '/work/current', currentHome: '/work/current',
    selectedProfileId: 'office', activeProfileId: 'office'
  }), { type: 'enter' });
});

test('the start surface owns all pre-entry selections without moving profile truth into the renderer', () => {
  const start = read('src/renderer/src/startup/WorldStartScreen.tsx');
  assert.match(start, /planStartupSelection\(/);
  assert.match(start, /requestWorldProfileActivation/);
  assert.match(start, /confirmWorldProfileActivation/);
  assert.match(start, /changeHome\(/);
  assert.match(start, /preferredWorldProfile/);
  assert.match(start, /onboardingComplete/);
  assert.match(start, /registeredRepos/);
});

test('startup screen strings are present in every supported locale', () => {
  const locales = ['en', 'es', 'zh-CN', 'ar', 'ja'].map((code) =>
    JSON.parse(read(`src/renderer/src/i18n/locales/${code}.json`)).startScreen
  );
  const keys = Object.keys(locales[0]).sort();
  for (const locale of locales.slice(1)) assert.deepEqual(Object.keys(locale).sort(), keys);
});
