import { worldHelperProvider, type WorldHelperProviderId } from '../shared/worldHelper';

export type ProviderFailureCategory = 'invalid-key' | 'offline' | 'quota' | 'invalid-response' | 'unavailable';
export type ProviderResult = { ok: true; text: string } | { ok: false; category: ProviderFailureCategory };

export interface WorldHelperProviderRegistry {
  testConnection(providerId: WorldHelperProviderId, apiKey: string, model?: string): Promise<{ ok: true } | { ok: false; category: ProviderFailureCategory }>;
  complete(providerId: WorldHelperProviderId, apiKey: string, model: string, system: string, user: string): Promise<ProviderResult>;
  stream(providerId: WorldHelperProviderId, apiKey: string, model: string, system: string, user: string, onDelta: (delta: string) => void, signal: AbortSignal): Promise<ProviderResult>;
}

type StreamReader = { read(): Promise<{ done: boolean; value?: Uint8Array }>; cancel(): Promise<void> | void; releaseLock?(): void };
type FetchResponse = { ok: boolean; status: number; json(): Promise<unknown>; body?: { getReader(): StreamReader } | null };
type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<FetchResponse>;

const ENDPOINTS: Record<WorldHelperProviderId, string> = {
  'nvidia-nim': 'https://integrate.api.nvidia.com/v1/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages'
};
const DEFAULT_TIMEOUT_MS = 25_000;

function failureCategory(status: number): ProviderFailureCategory {
  if (status === 401 || status === 403) return 'invalid-key';
  if (status === 429) return 'quota';
  return 'unavailable';
}

function responseText(providerId: WorldHelperProviderId, payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = payload as Record<string, unknown>;
  if (providerId === 'anthropic') {
    const content = value.content;
    if (!Array.isArray(content)) return null;
    const block = content.find((item) => !!item && typeof item === 'object' && (item as { type?: unknown }).type === 'text') as { text?: unknown } | undefined;
    return typeof block?.text === 'string' ? block.text : null;
  }
  const choices = value.choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== 'object') return null;
  const message = (choices[0] as { message?: unknown }).message;
  return message && typeof message === 'object' && typeof (message as { content?: unknown }).content === 'string'
    ? (message as { content: string }).content : null;
}

function extractDelta(providerId: WorldHelperProviderId, payload: unknown): { text?: string; done?: boolean; error?: boolean } {
  if (!payload || typeof payload !== 'object') return {};
  const value = payload as Record<string, unknown>;
  if (providerId === 'anthropic') {
    if (value.type === 'message_stop') return { done: true };
    if (value.type === 'error') return { error: true };
    if (value.type !== 'content_block_delta' || !value.delta || typeof value.delta !== 'object') return {};
    const delta = value.delta as Record<string, unknown>;
    return delta.type === 'text_delta' && typeof delta.text === 'string' ? { text: delta.text } : {};
  }
  if (value.choices === undefined) return {};
  if (!Array.isArray(value.choices) || !value.choices[0] || typeof value.choices[0] !== 'object') return {};
  const delta = (value.choices[0] as { delta?: unknown }).delta;
  if (!delta || typeof delta !== 'object') return {};
  const content = (delta as { content?: unknown }).content;
  return typeof content === 'string' ? { text: content } : {};
}

async function readSse(providerId: WorldHelperProviderId, response: FetchResponse, onDelta: (delta: string) => void, signal: AbortSignal): Promise<ProviderResult> {
  if (!response.body) return { ok: false, category: 'invalid-response' };
  const reader = response.body.getReader();
  const textDecoder = new TextDecoder();
  let output = '';
  let pendingLine = '';
  let dataLines: string[] = [];
  let ended = false;
  let cancelled = false;
  let readAbort: (() => void) | undefined;

  const dispatch = (): boolean => {
    if (!dataLines.length) return false;
    const data = dataLines.join('\n');
    dataLines = [];
    if (data === '[DONE]') { ended = true; return true; }
    let payload: unknown;
    try { payload = JSON.parse(data); } catch { throw new Error('invalid-event'); }
    const event = extractDelta(providerId, payload);
    if (event.error) throw new Error('provider-event');
    if (event.text) { output += event.text; onDelta(event.text); }
    if (event.done) { ended = true; return true; }
    return false;
  };

  const handleLine = (line: string): boolean => {
    if (line === '') return dispatch();
    if (line.startsWith(':')) return false;
    if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
    return false;
  };

  const read = async (): Promise<{ done: boolean; value?: Uint8Array }> => {
    if (signal.aborted) throw new Error('aborted');
    return await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (fn: () => void) => { if (settled) return; settled = true; signal.removeEventListener('abort', abort); readAbort = undefined; fn(); };
      const abort = () => finish(() => reject(new Error('aborted')));
      readAbort = abort;
      signal.addEventListener('abort', abort, { once: true });
      reader.read().then((result) => finish(() => resolve(result)), (error) => finish(() => reject(error)));
    });
  };

  try {
    while (!ended) {
      const result = await read();
      if (result.done) break;
      const chunk = textDecoder.decode(result.value, { stream: true });
      const lines = (pendingLine + chunk).split('\n');
      pendingLine = lines.pop() ?? '';
      for (const line of lines) if (handleLine(line.replace(/\r$/, ''))) break;
    }
    if (!ended) {
      pendingLine += textDecoder.decode();
      if (pendingLine) handleLine(pendingLine.replace(/\r$/, ''));
      dispatch();
    }
    return output.trim() ? { ok: true, text: output } : { ok: false, category: 'invalid-response' };
  } catch {
    return { ok: false, category: 'offline' };
  } finally {
    if (!ended && signal.aborted) { cancelled = true; try { await reader.cancel(); } catch { /* best-effort close */ } }
    readAbort?.();
    if (!cancelled) { try { reader.releaseLock?.(); } catch { /* reader may already be released */ } }
  }
}

export function createWorldHelperProviderRegistry(options: { fetch?: FetchLike; timeoutMs?: number } = {}): WorldHelperProviderRegistry {
  const fetcher = options.fetch ?? (globalThis.fetch as unknown as FetchLike);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const complete = async (providerId: WorldHelperProviderId, apiKey: string, model: string, system: string, user: string): Promise<ProviderResult> => {
    if (!worldHelperProvider(providerId) || typeof apiKey !== 'string' || !apiKey.trim() || typeof model !== 'string' || !model.trim()) {
      return { ok: false, category: 'unavailable' };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const anthropic = providerId === 'anthropic';
      const headers: Record<string, string> = anthropic
        ? { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
        : { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` };
      const body = anthropic
        ? { model, max_tokens: 1400, system, messages: [{ role: 'user', content: user }] }
        : providerId === 'openai'
          ? { model, max_completion_tokens: 1400, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }
          : { model, max_tokens: 1400, temperature: 0.2, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
      const response = await fetcher(ENDPOINTS[providerId], { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
      if (!response.ok) return { ok: false, category: failureCategory(response.status) };
      const text = responseText(providerId, await response.json());
      return text === null ? { ok: false, category: 'invalid-response' } : { ok: true, text };
    } catch {
      return { ok: false, category: 'offline' };
    } finally {
      clearTimeout(timer);
    }
  };

  const stream = async (providerId: WorldHelperProviderId, apiKey: string, model: string, system: string, user: string, onDelta: (delta: string) => void, signal: AbortSignal): Promise<ProviderResult> => {
    if (!worldHelperProvider(providerId) || typeof apiKey !== 'string' || !apiKey.trim() || typeof model !== 'string' || !model.trim()) return { ok: false, category: 'unavailable' };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const abortFromCaller = () => controller.abort();
    signal.addEventListener('abort', abortFromCaller, { once: true });
    try {
      if (signal.aborted) controller.abort();
      const anthropic = providerId === 'anthropic';
      const headers: Record<string, string> = anthropic
        ? { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
        : { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` };
      const body = anthropic
        ? { model, max_tokens: 1400, stream: true, system, messages: [{ role: 'user', content: user }] }
        : providerId === 'openai'
          ? { model, max_completion_tokens: 1400, stream: true, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }
          : { model, max_tokens: 1400, temperature: 0.2, stream: true, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
      const response = await fetcher(ENDPOINTS[providerId], { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
      if (!response.ok) return { ok: false, category: failureCategory(response.status) };
      return await readSse(providerId, response, onDelta, controller.signal);
    } catch {
      return { ok: false, category: 'offline' };
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', abortFromCaller);
    }
  };

  return {
    complete,
    stream,
    async testConnection(providerId, apiKey, model) {
      const metadata = worldHelperProvider(providerId);
      if (!metadata) return { ok: false, category: 'unavailable' };
      const result = await complete(providerId, apiKey, model ?? metadata.models[0].id,
        'You are testing a connection. Reply with exactly the word READY.', 'Connection check.');
      return result.ok ? { ok: true } : { ok: false, category: result.category };
    }
  };
}
