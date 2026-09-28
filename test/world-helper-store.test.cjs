'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const { readWorldHelperState, writeWorldHelperState, worldHelperStatePath } = loadTs('src/main/worldHelperStore.ts');

test('GUS state is atomically stored under app userData and corrupt data is ignored', (t) => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'world-helper-store-'));
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }));
  const state = {
    provider: 'nvidia-nim', model: 'nemotron', enabled: true,
    onboardingComplete: true, setupDismissed: false,
    transcript: [{ role: 'assistant', text: 'Ready', at: 12 }],
    notices: [], seenEvents: ['notice-1']
  };

  assert.deepEqual(readWorldHelperState(userData), {
    provider: null, model: null, enabled: false, onboardingComplete: false,
    transcript: [], notices: [], seenEvents: []
  });
  writeWorldHelperState(userData, state);
  assert.deepEqual(readWorldHelperState(userData), state);
  const storedPath = worldHelperStatePath(userData);
  assert.equal(fs.statSync(storedPath).isFile(), true);
  // Node's mode option maps to POSIX permission bits; Windows exposes the
  // inherited profile ACL as 0666 here and does not implement chmod semantics.
  if (process.platform !== 'win32') {
    assert.equal(fs.statSync(storedPath).mode & 0o777, 0o600);
  }

  fs.writeFileSync(worldHelperStatePath(userData), '{broken');
  assert.equal(readWorldHelperState(userData).enabled, false);
  assert.deepEqual(fs.readdirSync(userData), ['world-helper.json'], 'atomic promotion leaves no temporary files');
});

test('GUS persistence bounds event history and rejects invalid provider state', (t) => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'world-helper-bound-'));
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }));
  const state = {
    provider: 'openai', model: 'gpt-5-mini', enabled: true, onboardingComplete: true,
    transcript: [], notices: [], seenEvents: Array.from({ length: 520 }, (_, index) => String(index))
  };
  writeWorldHelperState(userData, state);
  assert.equal(readWorldHelperState(userData).seenEvents.length, 500);
  assert.throws(() => writeWorldHelperState(userData, { ...state, provider: 'made-up' }), /invalid World Helper state/);
});
