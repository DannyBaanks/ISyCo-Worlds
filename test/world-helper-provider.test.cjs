'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');

const shared = loadTs('src/shared/worldHelper.ts');
const adapters = loadTs('src/main/worldHelperProviders.ts');

test('provider registry contains only real initial providers and official key links', () => {
  const providers = shared.worldHelperProviders();
  assert.deepEqual(providers.map((p) => p.id), ['nvidia-nim', 'openai', 'anthropic']);
  assert.match(providers[0].apiKeyHelpUrl, /^https:\/\/build\.nvidia\.com\//);
  assert.match(providers[1].apiKeyHelpUrl, /^https:\/\/platform\.openai\.com\//);
  assert.match(providers[2].apiKeyHelpUrl, /^https:\/\/platform\.claude\.com\//);
  assert.equal(providers[0].recommended, true);
  assert.match(providers[0].availabilityNote, /may be available/i);
});

test('provider adapters build closed main-side requests and never return key material', async () => {
  const calls = [];
  const request = adapters.createWorldHelperProviderRegistry({
    fetch: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{"reply":"Ready","workers":[]}' } }] }) };
    }
  });
  const result = await request.testConnection('nvidia-nim', 'secret-test-key');
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /integrate\.api\.nvidia\.com\/v1\/chat\/completions/);
  assert.equal(calls[0].init.headers.authorization, 'Bearer secret-test-key');
  assert.equal(JSON.stringify(result).includes('secret-test-key'), false);
});

test('provider adapters classify invalid keys and offline errors without leaking response bodies', async () => {
  const badKey = adapters.createWorldHelperProviderRegistry({
    fetch: async () => ({ ok: false, status: 401, json: async () => ({ error: 'do not expose private-key-value' }) })
  });
  assert.deepEqual(await badKey.testConnection('openai', 'secret'), { ok: false, category: 'invalid-key' });

  const offline = adapters.createWorldHelperProviderRegistry({ fetch: async () => { throw new Error('socket private-key-value'); } });
  assert.deepEqual(await offline.testConnection('anthropic', 'secret'), { ok: false, category: 'offline' });
});

function streamResponse(chunks, status = 200) {
  let index = 0;
  const reader = {
    async read() { return index < chunks.length ? { done: false, value: chunks[index++] } : { done: true }; },
    async cancel() { index = chunks.length; },
    releaseLock() {}
  };
  return { ok: status >= 200 && status < 300, status, body: { getReader: () => reader } };
}

function byteChunks(text, splitPoints) {
  const bytes = new TextEncoder().encode(text);
  return splitPoints.map((point, index) => bytes.slice(point, splitPoints[index + 1]));
}

test('stream decodes OpenAI SSE frames across UTF-8 and event boundaries and stops at DONE', async () => {
  const frame = `data: ${JSON.stringify({ choices: [{ delta: { content: 'Hola 🙂' } }] })}\r\n\r\n`;
  const encoded = new TextEncoder().encode(frame);
  const emojiStart = new TextEncoder().encode('Hola ').length;
  const emojiByteOffset = frame.indexOf('🙂');
  const prefixBytes = new TextEncoder().encode(frame.slice(0, emojiByteOffset)).length;
  const chunks = [encoded.slice(0, prefixBytes + 1), encoded.slice(prefixBytes + 1, prefixBytes + 3), encoded.slice(prefixBytes + 3), new TextEncoder().encode('data: [DONE]\n\n')];
  const deltas = [];
  const registry = adapters.createWorldHelperProviderRegistry({ fetch: async () => streamResponse(chunks) });
  assert.equal(typeof registry.stream, 'function');
  const result = await registry.stream('openai', 'secret', 'gpt-5-mini', 'sys', 'user', (delta) => deltas.push(delta), new AbortController().signal);
  assert.deepEqual(deltas, ['Hola 🙂']);
  assert.deepEqual(result, { ok: true, text: 'Hola 🙂' });
  assert.equal(emojiStart > 0, true);
});

test('stream decodes Anthropic text deltas and terminates on message_stop', async () => {
  const chunks = [new TextEncoder().encode([
    'event: content_block_delta', `data: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'una parte' } })}`, '',
    'event: message_stop', `data: ${JSON.stringify({ type: 'message_stop' })}`, '',
    `data: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: ' no debe salir' } })}`, ''
  ].join('\n'))];
  const deltas = [];
  const registry = adapters.createWorldHelperProviderRegistry({ fetch: async () => streamResponse(chunks) });
  const result = await registry.stream('anthropic', 'secret', 'claude-haiku-4-5', 'sys', 'user', (delta) => deltas.push(delta), new AbortController().signal);
  assert.deepEqual(deltas, ['una parte']);
  assert.deepEqual(result, { ok: true, text: 'una parte' });
});

test('stream classifies HTTP failure, timeout, and caller abort without exposing payloads', async () => {
  const failed = adapters.createWorldHelperProviderRegistry({ fetch: async () => streamResponse([], 429) });
  assert.deepEqual(await failed.stream('openai', 'secret', 'gpt-5-mini', 'sys', 'user', () => {}, new AbortController().signal), { ok: false, category: 'quota' });

  const hangingReader = { read: () => new Promise(() => {}), cancel: async () => {}, releaseLock() {} };
  const timeout = adapters.createWorldHelperProviderRegistry({ fetch: async () => ({ ok: true, status: 200, body: { getReader: () => hangingReader } }), timeoutMs: 5 });
  assert.deepEqual(await timeout.stream('openai', 'secret', 'gpt-5-mini', 'sys', 'user', () => {}, new AbortController().signal), { ok: false, category: 'offline' });

  const controller = new AbortController();
  const abort = adapters.createWorldHelperProviderRegistry({ fetch: async () => ({ ok: true, status: 200, body: { getReader: () => hangingReader } }) });
  const pending = abort.stream('openai', 'secret', 'gpt-5-mini', 'sys', 'user', () => {}, controller.signal);
  controller.abort();
  assert.deepEqual(await pending, { ok: false, category: 'offline' });
});

test('typed workforce proposal parser rejects malformed output and authority-shaped fields', () => {
  const good = shared.parseWorldHelperProposal(JSON.stringify({
    reply: 'A small research crew fits.',
    worldSuggestion: 'monster-trainer',
    workers: [{ name: 'Researcher', provider: 'claude', role: 'researcher', purpose: 'Investigate the issue.' }]
  }));
  assert.equal(good.ok, true);
  assert.equal(good.value.workers.length, 1);
  assert.equal(good.value.worldSuggestion, 'monster-trainer');
  for (const bad of [
    'not json',
    JSON.stringify({ reply: 'ok', workers: [{ name: 'x', provider: 'not-installed', role: 'coder', purpose: 'x' }] }),
    JSON.stringify({ reply: 'ok', workers: [{ name: 'x', provider: 'codex', role: 'coder', purpose: 'x', command: 'rm -rf /' }] }),
    JSON.stringify({ reply: 'ok', worldSuggestion: 'imaginary-world', workers: [] }),
    JSON.stringify({ reply: 'ok', workers: Array.from({ length: 6 }, (_, i) => ({ name: `worker-${i}`, provider: 'codex', role: 'coder', purpose: 'x' })) })
  ]) assert.equal(shared.parseWorldHelperProposal(bad).ok, false);
});

test('changing conversational provider does not alter the fixed authority policy', () => {
  const before = shared.WORLD_HELPER_AUTHORITY_POLICY;
  for (const provider of shared.worldHelperProviders()) assert.equal(provider.id.length > 0, true);
  assert.deepEqual(shared.WORLD_HELPER_AUTHORITY_POLICY, before);
  assert.equal(before.modelMayLaunchWorkers, false);
  assert.equal(before.approvalRequired, true);
});
