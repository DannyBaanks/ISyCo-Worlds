'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const Runtime = loadTs('src/main/worldProfileRuntime.ts');

function fixture() {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'md-world-runtime-'));
  return { workspaceRoot, cleanup: () => fs.rmSync(workspaceRoot, { recursive: true, force: true }) };
}

test('profile roots are distinct while workspace cwd stays shared', () => {
  const { workspaceRoot, cleanup } = fixture();
  try {
    const office = Runtime.resolveWorldRuntimeRoots(workspaceRoot, 'office');
    const trainer = Runtime.resolveWorldRuntimeRoots(workspaceRoot, 'monster-trainer');
    assert.equal(office.workspaceRoot, trainer.workspaceRoot);
    assert.notEqual(office.profileRoot, trainer.profileRoot);
    assert.equal(office.profileRoot, path.join(workspaceRoot, '.munder', 'worlds', 'office'));
    assert.equal(trainer.profileRoot, path.join(workspaceRoot, '.munder', 'worlds', 'monster-trainer'));
  } finally { cleanup(); }
});

test('profile ids cannot escape or overlap the profile root', () => {
  const { workspaceRoot, cleanup } = fixture();
  try {
    for (const id of ['../outside', '..', '/tmp/outside', 'office/../../x', '']) {
      assert.throws(() => Runtime.resolveWorldRuntimeRoots(workspaceRoot, id), { code: 'invalid-profile-id' });
    }
  } finally { cleanup(); }
});

test('migration reports not-needed when there is no legacy Munder state', async () => {
  const { workspaceRoot, cleanup } = fixture();
  try {
    const { profileRoot } = Runtime.resolveWorldRuntimeRoots(workspaceRoot, 'office');
    assert.deepEqual(await Runtime.migrateLegacyMunderState(workspaceRoot, profileRoot), { status: 'not-needed', copied: [] });
  } finally { cleanup(); }
});

test('migration copies all known legacy state, preserves source and is idempotent', async () => {
  const { workspaceRoot, cleanup } = fixture();
  try {
    fs.mkdirSync(path.join(workspaceRoot, 'hive', 'agents', 'god'), { recursive: true });
    fs.writeFileSync(path.join(workspaceRoot, 'hive', 'agents', 'god', 'memory.md'), 'remember');
    fs.mkdirSync(path.join(workspaceRoot, 'palace'), { recursive: true });
    fs.writeFileSync(path.join(workspaceRoot, 'palace', 'index.db'), 'index');
    fs.writeFileSync(path.join(workspaceRoot, 'roster.json'), '{"agents":[]}');
    fs.mkdirSync(path.join(workspaceRoot, 'roster-backups'), { recursive: true });
    fs.writeFileSync(path.join(workspaceRoot, 'roster-backups', 'backup.json'), '{}');
    const { profileRoot } = Runtime.resolveWorldRuntimeRoots(workspaceRoot, 'office');

    const first = await Runtime.migrateLegacyMunderState(workspaceRoot, profileRoot);
    assert.equal(first.status, 'copied');
    assert.deepEqual(new Set(first.copied), new Set(['hive', 'palace', 'roster.json', 'roster-backups']));
    assert.equal(fs.readFileSync(path.join(profileRoot, 'hive', 'agents', 'god', 'memory.md'), 'utf8'), 'remember');
    assert.equal(fs.readFileSync(path.join(workspaceRoot, 'hive', 'agents', 'god', 'memory.md'), 'utf8'), 'remember');
    assert.equal((await Runtime.migrateLegacyMunderState(workspaceRoot, profileRoot)).status, 'already-migrated');
  } finally { cleanup(); }
});

test('migration resumes an interrupted copy without replacing user data', async () => {
  const { workspaceRoot, cleanup } = fixture();
  try {
    fs.writeFileSync(path.join(workspaceRoot, 'roster.json'), '{"agents":["legacy"]}');
    const { profileRoot } = Runtime.resolveWorldRuntimeRoots(workspaceRoot, 'office');
    fs.mkdirSync(profileRoot, { recursive: true });
    fs.writeFileSync(path.join(profileRoot, '.legacy-migration.json'), '{broken');
    const result = await Runtime.migrateLegacyMunderState(workspaceRoot, profileRoot);
    assert.equal(result.status, 'copied');
    assert.equal(fs.readFileSync(path.join(profileRoot, 'roster.json'), 'utf8'), '{"agents":["legacy"]}');
  } finally { cleanup(); }
});

test('migration refuses a conflicting destination and leaves both sides untouched', async () => {
  const { workspaceRoot, cleanup } = fixture();
  try {
    fs.writeFileSync(path.join(workspaceRoot, 'roster.json'), 'legacy');
    const { profileRoot } = Runtime.resolveWorldRuntimeRoots(workspaceRoot, 'office');
    fs.mkdirSync(profileRoot, { recursive: true });
    fs.writeFileSync(path.join(profileRoot, 'roster.json'), 'different');
    await assert.rejects(Runtime.migrateLegacyMunderState(workspaceRoot, profileRoot), { code: 'migration-conflict' });
    assert.equal(fs.readFileSync(path.join(workspaceRoot, 'roster.json'), 'utf8'), 'legacy');
    assert.equal(fs.readFileSync(path.join(profileRoot, 'roster.json'), 'utf8'), 'different');
  } finally { cleanup(); }
});
