'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const wizard = fs.readFileSync(path.join(root, 'src/renderer/src/components/OnboardingWizard.tsx'), 'utf8');
const spanish = JSON.parse(fs.readFileSync(path.join(root, 'src/renderer/src/i18n/locales/es.json'), 'utf8'));

test('first-run audience choice is framed as a friendly preference, not a technicality gate', () => {
  const persona = spanish.onboarding.persona;
  assert.match(persona.ask, /prefieres/i);
  assert.match(persona.nonTechnicalTitle, /gu[ií]a|paso a paso/i);
  assert.doesNotMatch(persona.nonTechnicalDesc, /marketing|terminal|CLI|program/i);
  assert.doesNotMatch(spanish.onboarding.titles.persona, /MUNDER/i);
});

test('onboarding choices are accessible and setup progress is visible', () => {
  assert.match(wizard, /role="progressbar"/);
  assert.match(wizard, /aria-valuenow/);
  assert.match(wizard, /aria-pressed=\{selected\}/);
  assert.match(wizard, /data-onboarding-step/);
});
