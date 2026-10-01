'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');
const { WorldHelperHost } = loadTs('src/main/worldHelperHost.ts');

function setup(options = {}) {
  const calls = [];
  const state = { provider: null, model: null, enabled: false, onboardingComplete: false, transcript: [], notices: [], seenEvents: [] };
  const storedSecrets = new Map();
  const host = new WorldHelperHost({
    state,
    providers: options.providers ?? {
      testConnection: async () => ({ ok: true }),
      complete: async (_provider, _key, _model, system, user) => {
        calls.push(['complete', user, system]);
        return { ok: true, text: JSON.stringify(options.response ?? { reply: 'Here is a small team.', workers: [{ name: 'Researcher', provider: 'codex', role: 'researcher', purpose: 'Investigate the issue.' }] }) };
      }
    },
    secrets: {
      set: async (provider, key) => { storedSecrets.set(provider, key); return { ok: true }; },
      has: async (provider) => storedSecrets.has(provider),
      get: async (provider) => storedSecrets.get(provider),
      remove: async (provider) => { storedSecrets.delete(provider); }
    },
    context: async () => typeof options.context === 'function' ? options.context() : options.context ?? ({ world: 'office', workspaceAvailable: true, workers: [], tasks: [], installedProviders: ['codex'], availableRoles: ['researcher'], workspace: '/safe/repo' }),
    launch: async (worker) => { calls.push(['launch', worker]); return { ok: true, id: worker.id }; },
    persist: async () => {}, now: () => 1234, createId: () => 'proposal-one'
  });
  return { host, calls, state };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test('host configures, verifies, and exposes safe metadata but never secret bytes', async () => {
  const { host, state } = setup();
  const configured = await host.configure({ provider: 'nvidia-nim', model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning', apiKey: 'secret-never-return-this' });
  assert.equal(configured.ok, true);
  assert.equal(state.enabled, true);
  assert.equal(state.onboardingComplete, true);
  assert.equal(JSON.stringify(host.getSnapshot()).includes('secret-never-return-this'), false);
  assert.equal(host.getSnapshot().configured, true);
  assert.equal(host.getSnapshot().lifecycle, 'READY');
});

test('provider failure degrades only the helper, and worker truth remains external', async () => {
  const { host } = setup({ providers: { testConnection: async () => ({ ok: false, category: 'offline' }), complete: async () => ({ ok: false, category: 'offline' }) } });
  const result = await host.configure({ provider: 'openai', model: 'gpt-5-mini', apiKey: 'secret' });
  assert.deepEqual(result, { ok: false, category: 'offline' });
  assert.equal(host.getSnapshot().lifecycle, 'DEGRADED');
  assert.equal(host.getSnapshot().errorCategory, 'offline');
});

test('chat creates a typed inert proposal that cannot launch before approval', async () => {
  const { host, calls } = setup({ response: { reply: 'A small team can help.', worldSuggestion: 'monster-trainer', workers: [{ name: 'Researcher', provider: 'codex', role: 'researcher', purpose: 'Investigate the issue.' }] } });
  await host.configure({ provider: 'openai', model: 'gpt-5-mini', apiKey: 'secret' });
  const result = await host.chat('Maintain this repository and investigate bugs.');
  assert.equal(result.ok, true);
  assert.equal(result.proposal.workers[0].provider, 'codex');
  assert.equal(calls.some(([kind]) => kind === 'launch'), false);
  assert.equal(host.getSnapshot().pendingProposal.id, 'proposal-one');
  assert.equal(host.getSnapshot().pendingProposal.worldSuggestion, 'monster-trainer');
  assert.equal(host.getSnapshot().pendingProposal.workspace, '/safe/repo');
});

test('provider context is minimal and redacts secret-shaped task titles and opaque task IDs', async () => {
  const key = 'nvapi-abcdefghijklmnopqrstuv123456';
  const context = { world: 'office', workspaceAvailable: true, workspace: '/private/repo', workers: [], tasks: [
    { id: 'task-secret-id', title: `Investigate ${key}`, status: 'in_progress' },
    { id: 'done-task', title: 'Old completed task', status: 'done' }
  ], installedProviders: ['codex'], availableRoles: ['researcher'] };
  const { host, calls } = setup({ context });
  await host.configure({ provider: 'openai', model: 'gpt-5-mini', apiKey: 'secret' });
  await host.chat('Suggest a team.');
  const modelInput = calls.find(([kind]) => kind === 'complete')[1];
  assert.equal(modelInput.includes(key), false);
  assert.equal(modelInput.includes('task-secret-id'), false);
  assert.equal(modelInput.includes('/private/repo'), false);
  assert.equal(modelInput.includes('Old completed task'), false);
  assert.match(modelInput, /\[redacted\]/);
});

test('chat uses the registered GUS role and current world allowlists to build its system prompt', async () => {
  const { host, calls } = setup({ response: { reply: 'Puedo ayudarte a investigar.', workers: [] }, context: { world: 'monster-trainer', workspaceAvailable: true, workers: [], tasks: [], installedProviders: ['codex'], availableRoles: ['Monster researcher'], workspace: '/safe/repo' } });
  await host.configure({ provider: 'openai', model: 'gpt-5-mini', apiKey: 'secret' });
  assert.equal((await host.chat('Ayúdame a investigar.')).ok, true);
  const systemPrompt = calls.find(([kind]) => kind === 'complete')[2];
  assert.match(systemPrompt, /Monster Trainer/);
  assert.match(systemPrompt, /Monster researcher/);
  assert.match(systemPrompt, /explicit human approval/i);
  assert.doesNotMatch(systemPrompt, /Isymotron/);
});

test('model output with unknown engine, command, malformed JSON, or excess workers fails closed', async () => {
  for (const response of [
    '{not-json',
    { reply: 'x', workers: [{ name: 'Stranger', provider: 'ghost-cli', role: 'coder', purpose: 'x' }] },
    { reply: 'x', workers: [{ name: 'Bad', provider: 'codex', role: 'coder', purpose: 'x', command: 'rm -rf /' }] },
    { reply: 'x', workers: Array.from({ length: 6 }, (_, i) => ({ name: `R${i}`, provider: 'codex', role: 'coder', purpose: 'x' })) }
  ]) {
    const { host } = setup({ response });
    await host.configure({ provider: 'openai', model: 'gpt-5-mini', apiKey: 'secret' });
    const result = await host.chat('Please propose a team.');
    assert.equal(result.ok, false);
    assert.equal(host.getSnapshot().pendingProposal, undefined);
  }
});

test('a provider or role absent from live Munder catalogs is rejected even when schema-shaped', async () => {
  for (const response of [
    { reply: 'x', workers: [{ name: 'Stranger', provider: 'claude', role: 'researcher', purpose: 'x' }] },
    { reply: 'x', workers: [{ name: 'Researcher', provider: 'codex', role: 'invented-role', purpose: 'x' }] }
  ]) {
    const { host, calls } = setup({ response });
    await host.configure({ provider: 'openai', model: 'gpt-5-mini', apiKey: 'secret' });
    assert.equal((await host.chat('Propose a team.')).ok, false);
    assert.equal(calls.some(([kind]) => kind === 'launch'), false);
  }
});

test('approval is one-use, delegates only validated app-owned worker descriptors, and stale ids fail', async () => {
  const { host, calls } = setup();
  await host.configure({ provider: 'openai', model: 'gpt-5-mini', apiKey: 'secret' });
  await host.chat('Build me a team.');
  const launched = await host.approveProposal('proposal-one', ['Researcher']);
  assert.equal(launched.ok, true);
  assert.equal(calls.filter(([kind]) => kind === 'launch').length, 1);
  assert.equal(calls.find(([kind]) => kind === 'launch')[1].command, undefined);
  assert.deepEqual(calls.find(([kind]) => kind === 'launch')[1].capabilities, []);
  assert.equal((await host.approveProposal('proposal-one', ['Researcher'])).ok, false);
});

test('approval is bound to the reviewed workspace and fails closed if it changes', async () => {
  let workspace = '/safe/repo';
  const { host, calls } = setup({ context: () => ({ world: 'office', workspaceAvailable: true, workers: [], tasks: [], installedProviders: ['codex'], availableRoles: ['researcher'], workspace }) });
  await host.configure({ provider: 'openai', model: 'gpt-5-mini', apiKey: 'secret' });
  await host.chat('Build a research team.');
  assert.equal(host.getSnapshot().pendingProposal.workspace, '/safe/repo');
  workspace = '/other/repo';
  const result = await host.approveProposal('proposal-one', ['Researcher']);
  assert.deepEqual(result, { ok: false, category: 'workspace-changed' });
  assert.equal(calls.some(([kind]) => kind === 'launch'), false);
});

test('concurrent approvals consume the same proposal once without throwing', async () => {
  const context = { workspaceAvailable: true, workspace: '/safe/repo', workers: [], tasks: [], installedProviders: ['codex'], availableRoles: ['researcher'] };
  const gates = [deferred(), deferred()];
  let approvals = 0;
  let deferContext = false;
  const { host, calls } = setup({ context: () => deferContext && approvals < gates.length ? gates[approvals++].promise : context });
  await host.configure({ provider: 'openai', model: 'gpt-5-mini', apiKey: 'secret' });
  await host.chat('Build a team.');
  deferContext = true;
  const first = host.approveProposal('proposal-one', ['Researcher']);
  const second = host.approveProposal('proposal-one', ['Researcher']);
  assert.equal(approvals, 2);
  gates[1].resolve(context);
  assert.equal((await second).ok, true);
  gates[0].resolve(context);
  assert.deepEqual(await first, { ok: false, category: 'stale-proposal' });
  assert.equal(calls.filter(([kind]) => kind === 'launch').length, 1);
  assert.equal(host.getSnapshot().pendingProposal, undefined);
});

test('approval cannot authorize a replacement proposal even when its id and names match', async () => {
  const context = { workspaceAvailable: true, workspace: '/safe/repo', workers: [], tasks: [], installedProviders: ['codex'], availableRoles: ['researcher'] };
  const gate = deferred();
  let deferNext = false;
  const options = { context: () => {
    if (deferNext) { deferNext = false; return gate.promise; }
    return context;
  } };
  const { host, calls } = setup(options);
  await host.configure({ provider: 'openai', model: 'gpt-5-mini', apiKey: 'secret' });
  await host.chat('Build the original team.');
  deferNext = true;
  const approval = host.approveProposal('proposal-one', ['Researcher']);
  options.response = { reply: 'A different team.', workers: [{ name: 'Researcher', provider: 'codex', role: 'researcher', purpose: 'A different task.' }] };
  assert.equal((await host.chat('Replace the team.')).ok, true);
  const replacement = host.getSnapshot().pendingProposal;
  gate.resolve(context);
  assert.deepEqual(await approval, { ok: false, category: 'stale-proposal' });
  assert.equal(calls.some(([kind]) => kind === 'launch'), false);
  assert.deepEqual(host.getSnapshot().pendingProposal, replacement);
  assert.equal((await host.approveProposal(replacement.id, ['Researcher'])).ok, true);
  assert.equal(calls.find(([kind]) => kind === 'launch')[1].purpose, 'A different task.');
});

test('starting a chat invalidates deferred approval even if the chat input is rejected', async () => {
  const context = { workspaceAvailable: true, workspace: '/safe/repo', workers: [], tasks: [], installedProviders: ['codex'], availableRoles: ['researcher'] };
  const gate = deferred();
  let deferContext = false;
  const { host, calls } = setup({ context: () => deferContext ? gate.promise : context });
  await host.configure({ provider: 'openai', model: 'gpt-5-mini', apiKey: 'secret' });
  await host.chat('Build a team.');
  deferContext = true;
  const approval = host.approveProposal('proposal-one', ['Researcher']);
  assert.deepEqual(await host.chat(''), { ok: false, category: 'invalid-config' });
  gate.resolve(context);
  assert.deepEqual(await approval, { ok: false, category: 'stale-proposal' });
  assert.equal(host.getSnapshot().pendingProposal, undefined);
  assert.equal(calls.some(([kind]) => kind === 'launch'), false);
});

test('stop invalidates approval during either context await, including after re-enable', async () => {
  for (const blockedCall of [2, 3]) {
    const context = { workspaceAvailable: true, workspace: '/safe/repo', workers: [], tasks: [], installedProviders: ['codex'], availableRoles: ['researcher'] };
    const gate = deferred();
    const started = deferred();
    let contextCalls = 0;
    const { host, calls } = setup({ context: () => {
      if (++contextCalls === blockedCall) { started.resolve(); return gate.promise; }
      return context;
    } });
    await host.configure({ provider: 'openai', model: 'gpt-5-mini', apiKey: 'secret' });
    await host.chat('Build a team.');
    const approval = host.approveProposal('proposal-one', ['Researcher']);
    await started.promise;
    await host.stop();
    assert.equal(host.getSnapshot().lifecycle, 'STOPPED');
    await host.configure({ provider: 'openai', model: 'gpt-5-mini' });
    gate.resolve(context);
    assert.deepEqual(await approval, { ok: false, category: 'stale-proposal', ...(blockedCall === 3 ? { launched: [] } : {}) });
    assert.equal(calls.some(([kind]) => kind === 'launch'), false);
    assert.equal(host.getSnapshot().pendingProposal, undefined);
  }
});

test('a new chat cancels a consumed approval waiting for its pre-launch context', async () => {
  const context = { workspaceAvailable: true, workspace: '/safe/repo', workers: [], tasks: [], installedProviders: ['codex'], availableRoles: ['researcher'] };
  const gate = deferred();
  const started = deferred();
  let contextCalls = 0;
  const { host, calls } = setup({ context: () => {
    if (++contextCalls === 3) { started.resolve(); return gate.promise; }
    return context;
  } });
  await host.configure({ provider: 'openai', model: 'gpt-5-mini', apiKey: 'secret' });
  await host.chat('Build the original team.');
  const approval = host.approveProposal('proposal-one', ['Researcher']);
  await started.promise;
  assert.equal(host.getSnapshot().pendingProposal, undefined);
  assert.equal((await host.chat('Review a new team.')).ok, true);
  const replacement = host.getSnapshot().pendingProposal;
  gate.resolve(context);
  assert.deepEqual(await approval, { ok: false, category: 'stale-proposal', launched: [] });
  assert.equal(calls.some(([kind]) => kind === 'launch'), false);
  assert.deepEqual(host.getSnapshot().pendingProposal, replacement);
});

test('approval fails closed before consumption when provider or role catalogs disappear', async () => {
  for (const [catalog, category] of [['installedProviders', 'unavailable-provider'], ['availableRoles', 'unavailable-role']]) {
    for (const missing of [[], undefined]) {
      const context = { workspaceAvailable: true, workspace: '/safe/repo', workers: [], tasks: [], installedProviders: ['codex'], availableRoles: ['researcher'] };
      let contextCalls = 0;
      const { host, calls } = setup({ context: () => { ++contextCalls; return context; } });
      await host.configure({ provider: 'openai', model: 'gpt-5-mini', apiKey: 'secret' });
      await host.chat('Build a team.');
      context[catalog] = missing;
      assert.deepEqual(await host.approveProposal('proposal-one', ['Researcher']), { ok: false, category });
      assert.equal(contextCalls, 2, 'reject at approval validation, not after consuming the proposal');
      assert.equal(host.getSnapshot().pendingProposal.id, 'proposal-one');
      assert.equal(calls.some(([kind]) => kind === 'launch'), false);
    }
  }
});

test('change provider and stop preserve workforce owner and never call worker stop', async () => {
  let stoppedWorkers = 0;
  const { host } = setup();
  await host.configure({ provider: 'openai', model: 'gpt-5-mini', apiKey: 'secret' });
  await host.changeProvider({ provider: 'anthropic', model: 'claude-haiku-4-5', apiKey: 'new-secret' });
  await host.stop();
  assert.equal(host.getSnapshot().lifecycle, 'STOPPED');
  assert.equal(stoppedWorkers, 0);
});

test('semantic completion and blocked events use deterministic severity and dedupe', async () => {
  const { host, state } = setup();
  const done = { id: 'task-1:done', kind: 'task-finished', title: 'Refactor done', taskId: 'task-1', createdAt: 1000 };
  await host.configure({ provider: 'openai', model: 'gpt-5-mini', apiKey: 'secret' });
  host.observe(done);
  host.observe(done);
  host.observe({ id: 'approval-2', kind: 'approval-requested', title: 'Needs a decision', workerId: 'w2', createdAt: 1100 });
  assert.equal(state.notices.length, 2);
  assert.equal(state.notices[0].severity, 'informational');
  assert.equal(state.notices[1].severity, 'requires_action');
});

test('stale events from entities no longer present in Core truth are ignored', () => {
  const state = { provider: null, model: null, enabled: true, onboardingComplete: false, transcript: [], notices: [], seenEvents: [] };
  const host = new WorldHelperHost({ state, providers: {}, secrets: {}, context: async () => ({}), launch: async () => ({ ok: true }), persist: async () => {}, isCurrentEvent: (event) => event.workerId !== 'gone' });
  host.observe({ id: 'old-exit', kind: 'worker-error', title: 'stale', workerId: 'gone', createdAt: 1 });
  assert.equal(state.notices.length, 0);
});

test('host crash/restart restores transcript but never reconstructs approval authority from it', async () => {
  const { host, state } = setup();
  await host.configure({ provider: 'openai', model: 'gpt-5-mini', apiKey: 'secret' });
  await host.chat('Keep working.');
  const restarted = new WorldHelperHost({
    state, providers: { testConnection: async () => ({ ok: true }), complete: async () => ({ ok: true, text: '{"reply":"","workers":[]}' }) },
    secrets: { set: async () => ({ ok: true }), has: async () => true, get: async () => 'secret', remove: async () => {} },
    context: async () => ({ workers: [], tasks: [] }), launch: async () => ({ ok: true }), persist: async () => {}
  });
  assert.equal(restarted.getSnapshot().lifecycle, 'READY');
  assert.equal(restarted.getSnapshot().pendingProposal, undefined);
  assert.equal(restarted.getSnapshot().transcript.length, 2);
  assert.equal(restarted.getSnapshot().pendingProposal, undefined);
});

test('chat streams ordered user-facing deltas before strict proposal validation completes', async () => {
  const response = JSON.stringify({ reply: 'Hola GUS', workers: [{ name: 'Researcher', provider: 'codex', role: 'researcher', purpose: 'Investigate the issue.' }] });
  const { host, state } = setup({ providers: {
    testConnection: async () => ({ ok: true }), complete: async () => ({ ok: false, category: 'unavailable' }),
    stream: async (_provider, _key, _model, _system, _user, onDelta) => {
      const replyStart = response.indexOf('Hola GUS');
      for (const part of [response.slice(0, replyStart + 5), response.slice(replyStart + 5, replyStart + 8), response.slice(replyStart + 8)]) {
        onDelta(part);
      }
      assert.equal(state.transcript.some((item) => item.role === 'assistant'), false);
      return { ok: true, text: response };
    }
  } });
  await host.configure({ provider: 'openai', model: 'gpt-5-mini', apiKey: 'secret' });
  const events = [];
  const result = await host.chat('Suggest a team.', (event) => events.push(event));
  assert.equal(result.ok, true);
  assert.deepEqual(events.map((event) => event.type), ['delta', 'delta', 'complete']);
  assert.deepEqual(events.filter((event) => event.type === 'delta').map((event) => event.text), ['Hola ', 'GUS']);
  assert.equal(new Set(events.map((event) => event.requestId)).size, 1);
  assert.equal(host.getSnapshot().pendingProposal.id, 'proposal-one');
});

test('partial streamed reply followed by provider error persists no partial assistant turn or proposal', async () => {
  const { host, state } = setup({ providers: {
    testConnection: async () => ({ ok: true }), complete: async () => ({ ok: false, category: 'unavailable' }),
    stream: async (_provider, _key, _model, _system, _user, onDelta) => {
      onDelta('{"reply":"Visible only as a draft"');
      return { ok: false, category: 'offline' };
    }
  } });
  await host.configure({ provider: 'openai', model: 'gpt-5-mini', apiKey: 'secret' });
  const events = [];
  assert.deepEqual(await host.chat('Try this.', (event) => events.push(event)), { ok: false, category: 'offline' });
  assert.equal(state.transcript.some((item) => item.role === 'assistant'), false);
  assert.equal(host.getSnapshot().pendingProposal, undefined);
  assert.equal(events.at(-1).type, 'failed');
  assert.deepEqual(Object.keys(events[0]).sort(), ['requestId', 'text', 'type']);
});

test('malformed streamed reply ends the request as invalid-response instead of leaving GUS busy', async () => {
  const { host, state } = setup({ providers: {
    testConnection: async () => ({ ok: true }), complete: async () => ({ ok: false, category: 'unavailable' }),
    stream: async (_provider, _key, _model, _system, _user, onDelta, signal) => {
      onDelta('{"reply":"bad\\q"');
      assert.equal(signal.aborted, true, 'the host should stop reading malformed reply content');
      return { ok: false, category: 'offline' };
    }
  } });
  await host.configure({ provider: 'openai', model: 'gpt-5-mini', apiKey: 'secret' });
  const events = [];
  assert.deepEqual(await host.chat('Try malformed output.', (event) => events.push(event)), { ok: false, category: 'invalid-response' });
  assert.equal(events.at(-1).type, 'failed');
  assert.equal(events.at(-1).category, 'invalid-response');
  assert.equal(host.getSnapshot().lifecycle, 'ERROR');
  assert.equal(state.transcript.some((item) => item.role === 'assistant'), false);
  assert.equal(host.cancelChat(), false, 'the failed request must no longer be active');
});

test('cancelChat aborts only the active request and replacement ignores stale chunks', async () => {
  const seen = [];
  let firstStarted;
  const started = new Promise((resolve) => { firstStarted = resolve; });
  const { host } = setup({ providers: {
    testConnection: async () => ({ ok: true }), complete: async () => ({ ok: false, category: 'unavailable' }),
    stream: async (_provider, _key, _model, _system, user, onDelta, signal) => {
      const firstRequest = user.includes('Latest user message: first request');
      seen.push(firstRequest ? 'first' : 'second');
      if (firstRequest) {
        firstStarted();
        await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }));
        onDelta('{"reply":"stale"}');
        return { ok: false, category: 'offline' };
      }
      const text = '{"reply":"fresh","workers":[]}';
      onDelta(text);
      return { ok: true, text };
    }
  } });
  await host.configure({ provider: 'openai', model: 'gpt-5-mini', apiKey: 'secret' });
  const firstEvents = [];
  const first = host.chat('first request', (event) => firstEvents.push(event));
  await started;
  assert.equal(host.cancelChat('not-active'), false);
  const secondEvents = [];
  const second = host.chat('second request', (event) => secondEvents.push(event));
  assert.equal((await first).ok, false);
  assert.equal((await second).ok, true);
  const firstId = firstEvents[0].requestId;
  assert.deepEqual(seen, ['first', 'second']);
  assert.equal(firstEvents.some((event) => event.type === 'delta' && event.text === 'stale'), false);
  assert.equal(secondEvents.at(-1).type, 'complete');
  assert.equal(secondEvents.at(-1).requestId === firstId, false);
  assert.equal(host.cancelChat(), false);
});

test('explicit request-scoped cancellation ends the draft without persisting it', async () => {
  let onDelta;
  let startedResolve;
  const started = new Promise((resolve) => { startedResolve = resolve; });
  const { host, state } = setup({ providers: {
    testConnection: async () => ({ ok: true }), complete: async () => ({ ok: false, category: 'unavailable' }),
    stream: async (_provider, _key, _model, _system, _user, delta, signal) => {
      onDelta = delta;
      onDelta('{"reply":"still typing');
      startedResolve();
      await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }));
      return { ok: false, category: 'offline' };
    }
  } });
  await host.configure({ provider: 'openai', model: 'gpt-5-mini', apiKey: 'secret' });
  const events = [];
  const pending = host.chat('Keep going.', (event) => events.push(event));
  await started;
  const id = events.find((event) => event.type === 'delta').requestId;
  assert.equal(host.cancelChat(id), true);
  assert.deepEqual(await pending, { ok: false, category: 'unavailable' });
  assert.equal(events.at(-1).type, 'failed');
  assert.equal(state.transcript.some((item) => item.role === 'assistant'), false);
  assert.equal(host.cancelChat(id), false);
});

test('restored enabled state without its encrypted credential fails closed and becomes stopped', async () => {
  const state = { provider: 'openai', model: 'gpt-5-mini', enabled: true, onboardingComplete: true, transcript: [], notices: [], seenEvents: [] };
  const host = new WorldHelperHost({
    state, providers: {}, secrets: { set: async () => ({ ok: true }), has: async () => false, get: async () => undefined, remove: async () => {} },
    context: async () => ({ workers: [], tasks: [] }), launch: async () => ({ ok: true }), persist: async () => {}
  });
  await Promise.all([host.restore(), host.restore()]);
  assert.equal(host.getSnapshot().enabled, false);
  assert.equal(host.getSnapshot().lifecycle, 'ERROR');
  assert.equal(host.getSnapshot().errorCategory, 'invalid-config');
});
