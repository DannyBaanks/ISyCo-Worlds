'use strict';
/**
 * Agent-provider registry tests. Self-contained, no test framework — run with
 * `node test/agent-provider.test.cjs` (mirrors test/kg-core.test.cjs). The
 * registry lives in TypeScript (src/shared/agentProvider.ts), so we transpile it
 * and its two dependency-free command-group siblings with the bundled `typescript`
 * compiler into a temp dir and require the result. Exercises the copilot preset
 * (GitHub Copilot CLI) end to end: registration, command inference, the print-mode
 * flag shape, and the model/resume passthrough — alongside the pre-existing codex
 * preset as a guard against regressions.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');

const SHARED = path.join(__dirname, '..', 'src', 'shared');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'agentprov-'));
for (const name of ['claudeCommands', 'codexCommands', 'grokCommands', 'isycodeCommands', 'agentProvider']) {
  const src = fs.readFileSync(path.join(SHARED, `${name}.ts`), 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  fs.writeFileSync(path.join(out, `${name}.js`), js, 'utf8');
}
const ap = require(path.join(out, 'agentProvider.js'));

let failures = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (err) { failures++; console.log(`  ✗ ${name}\n     ${err && err.message}`); }
}

console.log('agent-provider registry tests');

test('ISyCode is a recognized, selectable provider and leads the picker order', () => {
  assert.ok(ap.isAgentProvider('isycode'), 'isAgentProvider("isycode")');
  assert.ok(ap.AGENT_PROVIDER_PRESETS.some((p) => p.id === 'isycode'), 'preset registered');
  // Every engine picker maps AGENT_PROVIDER_PRESETS verbatim, so index 0 IS the
  // first button the user sees. This is what "the floor's main TUI" means in code.
  assert.strictEqual(ap.AGENT_PROVIDER_PRESETS[0].id, 'isycode', 'first in every picker');
  assert.strictEqual(ap.DEFAULT_AGENT_PROVIDER, 'isycode', 'the preselected engine');
});

test('inferAgentProvider maps the isycode binary (with path/flags) to isycode', () => {
  assert.strictEqual(ap.inferAgentProvider('isycode'), 'isycode');
  assert.strictEqual(ap.inferAgentProvider('isycode tui'), 'isycode');
  assert.strictEqual(ap.inferAgentProvider('/home/danny/.local/bin/isycode'), 'isycode');
  assert.strictEqual(ap.inferAgentProvider('C:\\Users\\me\\.local\\bin\\isycode.exe'), 'isycode');
});

test('providerPreset falls back to CLAUDE by id, not to the first preset', () => {
  // The presets are ordered for the picker, so `[0]` is now isycode. An
  // unresolved id must still land on the conservative engine the hive's identity
  // injection is written against — a positional fallback would silently start
  // spawning the top-ranked CLI.
  const fallback = ap.providerPreset('no-such-engine');
  assert.strictEqual(fallback.id, 'claude', 'unknown ids resolve to claude');
});

test('ISyCode spawns its bare TUI: no model, no auto flag, no argv prompt', () => {
  const p = ap.providerPreset('isycode');
  assert.strictEqual(p.defaultCommand, 'isycode', 'default command binary');
  assert.strictEqual(p.supportsModel, false, 'models are chosen inside the TUI');
  assert.strictEqual(p.modelFlag, undefined, 'no --model: the launcher would exit 2');
  assert.strictEqual(ap.autoModeFlagForProvider('isycode'), '', 'no skip-permissions flag exists');
  assert.strictEqual(p.autoFlag, '', 'autoFlag mirrors autoModeFlag');
  assert.strictEqual(p.initialPromptFlag, undefined, 'nothing rides in on a flag');
  assert.ok(!p.positionalInitialPrompt, 'and nothing as a positional either');
  // `isycode` accepts NO prompt argument: an unrecognized one prints
  // `Unknown command:` and exits 2, so the hive seed must be typed after boot.
  assert.strictEqual(p.seedDelivery, 'type-into-tui', 'seed is typed into the TUI');
  assert.strictEqual(p.resumeFlag, undefined, 'sessions resume from inside the TUI');
  assert.strictEqual(p.resumeSubcommand, undefined);
  assert.strictEqual(p.hiveAware, false, 'no Claude-only identity injection');
});

test('ISyCode is honestly NOT god-eligible until it has a hive bridge', () => {
  const p = ap.providerPreset('isycode');
  assert.strictEqual(ap.canReceiveInbox('isycode'), false, 'no Stop→drain path → mail bounces');
  assert.strictEqual(ap.bridgeOf('isycode'), undefined, 'no hook/proxy bridge installed');
  assert.strictEqual(p.recommendedOrchestratorModel, undefined, 'never offered as the orchestrator model');
  // …which is exactly why DEFAULT_AGENT_PROVIDER is not the god default: the
  // orchestrator must drain hive mail, and the god provider stays claude.
  assert.notStrictEqual(ap.DEFAULT_AGENT_PROVIDER, 'claude');
});

test('ISyCode carries its verified command reference and a node-free installer', () => {
  const p = ap.providerPreset('isycode');
  assert.ok(p.commandGroups.length > 0, 'command reference is populated');
  const flat = p.commandGroups.flatMap((g) => g.items.map((i) => i.cmd));
  assert.ok(flat.includes('/compact'), '/compact is documented');
  assert.ok(flat.includes('/sessions'), '/sessions is documented');
  // Python tool: NO npm rung (that would route a pip install through "install
  // Node first"), only the self-contained one.
  assert.strictEqual(p.installCommand, undefined, 'no npm install command');
  assert.ok(p.nativeInstallCommand?.posix.includes('pipx install'), 'posix pipx installer');
  assert.ok(p.nativeInstallCommand?.win32.includes('pipx install'), 'win32 pipx installer');
  // The win32 form is wrapped verbatim in `cmd /d /s /c "…"`.
  assert.ok(!p.nativeInstallCommand.win32.includes('"'), 'win32 installer carries no double-quotes');
  const info = ap.installInfoForProvider('isycode', 'linux');
  assert.strictEqual(info.command, undefined);
  assert.strictEqual(info.nativeCommand, p.nativeInstallCommand.posix, 'native rung is what a linux box gets');
  assert.strictEqual(info.label, 'ISyCode');
});

test('copilot is a recognized, selectable provider', () => {
  assert.ok(ap.isAgentProvider('copilot'), 'isAgentProvider("copilot")');
  assert.ok(ap.AGENT_PROVIDER_PRESETS.some((p) => p.id === 'copilot'), 'preset registered');
});

test('inferAgentProvider maps the copilot binary (with path/flags) to copilot', () => {
  assert.strictEqual(ap.inferAgentProvider('copilot'), 'copilot');
  assert.strictEqual(ap.inferAgentProvider('/usr/local/bin/copilot --model gpt-5.4'), 'copilot');
});

test('copilot preset builds the documented non-interactive print-mode shape', () => {
  const p = ap.providerPreset('copilot');
  assert.strictEqual(p.defaultCommand, 'copilot', 'default command binary');
  assert.strictEqual(p.initialPromptFlag, '-p', 'prompt rides in via -p');
  assert.strictEqual(ap.autoModeFlagForProvider('copilot'), '-s --allow-all-tools --no-ask-user');
  assert.strictEqual(p.autoFlag, '-s --allow-all-tools --no-ask-user', 'autoFlag mirrors autoModeFlag');
});

test('copilot passes model + resume through, non-hiveAware, never auto-receives inbox', () => {
  const p = ap.providerPreset('copilot');
  assert.ok(p.supportsModel && p.modelFlag === '--model', 'model picker + --model');
  assert.strictEqual(p.resumeFlag, '--resume', 'session resume flag');
  assert.strictEqual(p.hiveAware, false, 'no Claude-only identity injection');
  assert.strictEqual(ap.canReceiveInbox('copilot'), false, 'print mode exits, no drain → bounces');
  assert.strictEqual(ap.bridgeOf('copilot'), undefined, 'no hook/proxy bridge');
});

test('cursor is a recognized, selectable, god-eligible provider', () => {
  assert.ok(ap.isAgentProvider('cursor'), 'isAgentProvider("cursor")');
  assert.ok(ap.AGENT_PROVIDER_PRESETS.some((p) => p.id === 'cursor'), 'preset registered');
  assert.strictEqual(ap.canReceiveInbox('cursor'), true, 'interactive TUI can receive inbox');
});

test('inferAgentProvider maps cursor-agent (canonical) and agent (alias) to cursor', () => {
  assert.strictEqual(ap.inferAgentProvider('cursor-agent'), 'cursor');
  assert.strictEqual(ap.inferAgentProvider('/Users/me/.local/bin/cursor-agent --model gpt-5.6-luna-high'), 'cursor');
  assert.strictEqual(ap.inferAgentProvider('agent'), 'cursor');
});

test('cursor preset is interactive (no -p), uses force+trust auto flags, types seed into TUI', () => {
  const p = ap.providerPreset('cursor');
  assert.strictEqual(p.defaultCommand, 'cursor-agent', 'default command binary');
  assert.strictEqual(p.initialPromptFlag, undefined, 'no -p; stay interactive');
  assert.strictEqual(p.seedDelivery, 'type-into-tui', 'hive protocol typed after boot');
  assert.strictEqual(ap.autoModeFlagForProvider('cursor'), '--force --trust');
  assert.strictEqual(p.autoFlag, '--force --trust', 'autoFlag mirrors autoModeFlag');
  assert.strictEqual(p.recommendedOrchestratorModel, 'gpt-5.6-luna-high');
  assert.ok(p.supportsModel && p.modelFlag === '--model', 'model picker + --model');
  assert.strictEqual(p.resumeFlag, '--resume', 'session resume flag');
  assert.strictEqual(p.hiveAware, false, 'no Claude-only identity injection');
  assert.strictEqual(ap.bridgeOf('cursor'), undefined, 'no hook/proxy bridge yet');
});

test('codex preset still resolves (no regression)', () => {
  assert.strictEqual(ap.inferAgentProvider('codex'), 'codex');
  assert.strictEqual(ap.providerPreset('codex').defaultCommand, 'codex');
});

test('OpenISy is a god-eligible provider via the opencode hook bridge', () => {
  assert.ok(ap.isAgentProvider('openisy'), 'isAgentProvider("openisy")');
  assert.strictEqual(ap.inferAgentProvider('openisy --model local/llama3'), 'openisy');
  assert.strictEqual(ap.inferAgentProvider('/home/user/.opencode/bin/openisy --prompt hi'), 'openisy');
  const p = ap.providerPreset('openisy');
  assert.strictEqual(p.defaultCommand, 'openisy');
  assert.strictEqual(p.initialPromptFlag, '--prompt');
  assert.strictEqual(p.modelFlag, '--model');
  assert.strictEqual(p.autoModeFlag, '');
  assert.strictEqual(p.hiveAware, false);
  assert.strictEqual(p.canReceiveInbox, true, 'inbox drains via the opencode hook bridge (session.idle → Stop)');
  assert.deepStrictEqual(ap.bridgeOf('openisy'), { kind: 'hooks', shim: 'opencode' }, 'bridge descriptor routes to installOpenCodePlugin');
  assert.deepStrictEqual(ap.nonInteractiveEnvForProvider('openisy'), { OPENCODE_EXPERIMENTAL_L1: '1' });
});

if (failures > 0) {
  console.log(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll agent-provider tests passed');
