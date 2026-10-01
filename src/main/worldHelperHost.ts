import {
  parseWorldHelperProposal, worldHelperProvider, worldHelperProviders,
  type ProposedWorker, type WorldHelperLifecycle, type WorldHelperNotice,
  type WorldHelperProviderId, type WorldHelperSafeSnapshot
} from '../shared/worldHelper';
import type { WorldHelperStreamEvent } from '../shared/worldHelper';
import type { ProviderFailureCategory, ProviderResult, WorldHelperProviderRegistry } from './worldHelperProviders';
import type { WorldId } from '../shared/worlds';
import { WorldHelperReplyDecoder } from './worldHelperStream';
import { buildGusSystemPrompt } from './worldHelperRoleEngine';

export interface WorldHelperPersistedState {
  provider: WorldHelperProviderId | null;
  model: string | null;
  enabled: boolean;
  onboardingComplete: boolean;
  setupDismissed?: boolean;
  transcript: Array<{ role: 'user' | 'assistant'; text: string; at: number }>;
  notices: WorldHelperNotice[];
  seenEvents: string[];
  errorCategory?: ProviderFailureCategory | 'invalid-config';
}

export interface WorldHelperContext {
  world?: string;
  workspaceAvailable?: boolean;
  workers: Array<{ id: string; name: string; role?: string; provider?: string; status?: string }>;
  tasks: Array<{ id: string; title?: string; status: string }>;
  installedProviders?: string[];
  workspace?: string;
  availableRoles?: string[];
  pendingApprovals?: number;
}

export interface WorldHelperLaunchRequest extends ProposedWorker {
  id: string;
  capabilities: [];
}

export interface WorldHelperHostDependencies {
  state: WorldHelperPersistedState;
  providers: WorldHelperProviderRegistry;
  secrets: {
    set(provider: WorldHelperProviderId, key: string): Promise<{ ok: boolean; error?: string }>;
    has(provider: WorldHelperProviderId): Promise<boolean>;
    get(provider: WorldHelperProviderId): Promise<string | undefined>;
    remove(provider: WorldHelperProviderId): Promise<void>;
  };
  context(): Promise<WorldHelperContext>;
  launch(worker: WorldHelperLaunchRequest): Promise<{ ok: boolean; error?: string; id?: string }>;
  persist(): Promise<void> | void;
  now?: () => number;
  createId?: () => string;
  isCurrentEvent?: (event: Omit<WorldHelperNotice, 'severity'> & { severity?: WorldHelperNotice['severity'] }) => boolean;
}

export type WorldHelperHostResult<T extends object = Record<never, never>> = { ok: true } & T
  | { ok: false; category: ProviderFailureCategory | 'invalid-config' | 'unavailable-provider' | 'invalid-proposal' | 'stale-proposal' | 'approval-required' | 'workspace-unavailable' | 'workspace-changed' | 'launch-failed' | 'unavailable-role'; launched?: string[] };

const MAX_TRANSCRIPT = 80;
const MAX_NOTICES = 80;
const MAX_SEEN = 500;
function redact(text: string): string {
  return text
    .replace(/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g, '[redacted]')
    .replace(/\b(?:api[_ -]?key|access[_ -]?token|secret|password|credential)\s*[:=]\s*[^\s,;]+/gi, '[redacted]')
    .replace(/\b(?:sk-(?:ant-)?[A-Za-z0-9_-]{16,}|nvapi-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{30,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[bpaors]-[A-Za-z0-9-]{10,})\b/g, '[redacted]')
    .replace(/\b(bearer)\s+[A-Za-z0-9._~+/=-]{8,}/gi, '$1 [redacted]')
    .slice(0, 6000);
}

export class WorldHelperHost {
  private lifecycle: WorldHelperLifecycle;
  private pending: { id: string; workers: ProposedWorker[]; worldSuggestion?: WorldId; workspace?: string; createdAt: number } | null = null;
  private listeners = new Set<(snapshot: WorldHelperSafeSnapshot) => void>();
  private restorePromise: Promise<void> | null = null;
  private activeChat: { id: string; controller: AbortController; publish: (event: WorldHelperStreamEvent) => void } | null = null;
  private readonly now: () => number;
  private readonly createId: () => string;
  private requestSequence = 0;

  constructor(private readonly deps: WorldHelperHostDependencies) {
    this.now = deps.now ?? Date.now;
    this.createId = deps.createId ?? (() => `gus-${this.now()}-${Math.random().toString(36).slice(2, 10)}`);
    this.lifecycle = deps.state.enabled ? 'READY' : 'STOPPED';
    deps.state.transcript = Array.isArray(deps.state.transcript) ? deps.state.transcript.slice(-MAX_TRANSCRIPT) : [];
    deps.state.notices = Array.isArray(deps.state.notices) ? deps.state.notices.slice(-MAX_NOTICES) : [];
    deps.state.seenEvents = Array.isArray(deps.state.seenEvents) ? deps.state.seenEvents.slice(-MAX_SEEN) : [];
  }

  getSnapshot(): WorldHelperSafeSnapshot {
    const state = this.deps.state;
    const provider = state.provider;
    const configured = !!provider && !!state.model;
    const pendingProposal = this.pending ? {
      id: this.pending.id,
      reply: state.transcript.at(-1)?.text ?? '',
      workers: this.pending.workers.map((worker) => ({ ...worker })),
      ...(this.pending.worldSuggestion ? { worldSuggestion: this.pending.worldSuggestion } : {}),
      ...(this.pending.workspace ? { workspace: this.pending.workspace } : {})
    } : undefined;
    return {
      lifecycle: this.lifecycle,
      enabled: state.enabled,
      configured,
      onboardingComplete: state.onboardingComplete,
      setupDismissed: state.setupDismissed,
      provider,
      model: state.model,
      ...(this.lifecycle === 'DEGRADED' || this.lifecycle === 'ERROR' ? { errorCategory: state.errorCategory } : {}),
      reply: state.transcript.at(-1)?.role === 'assistant' ? state.transcript.at(-1)?.text : undefined,
      transcript: state.transcript.map((item) => ({ ...item })),
      notices: state.notices.map((notice) => ({ ...notice })),
      ...(pendingProposal ? { pendingProposal } : {})
    };
  }

  subscribe(listener: (snapshot: WorldHelperSafeSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  restore(): Promise<void> {
    if (this.restorePromise) return this.restorePromise;
    this.restorePromise = (async () => {
      const { provider, enabled } = this.deps.state;
      if (!enabled) { this.lifecycle = 'STOPPED'; return; }
      let present = false;
      try { present = !!provider && await this.deps.secrets.has(provider); } catch { present = false; }
      if (!present) {
        this.deps.state.enabled = false;
        this.deps.state.errorCategory = 'invalid-config';
        this.lifecycle = 'ERROR';
        await this.save();
        return;
      }
      this.lifecycle = 'READY';
      await this.save();
    })();
    return this.restorePromise;
  }

  private async save(): Promise<void> {
    await this.deps.persist();
    const snapshot = this.getSnapshot();
    for (const listener of [...this.listeners]) { try { listener(snapshot); } catch { /* observers are isolated */ } }
  }

  async configure(input: { provider: unknown; model: unknown; apiKey?: unknown }): Promise<WorldHelperHostResult> {
    const metadata = worldHelperProvider(input.provider);
    if (!metadata || typeof input.model !== 'string' || !metadata.models.some((model) => model.id === input.model)) {
      return { ok: false, category: 'invalid-config' };
    }
    const providerId = metadata.id;
    this.lifecycle = 'STARTING';
    try {
      if (typeof input.apiKey === 'string' && input.apiKey.trim()) {
        const stored = await this.deps.secrets.set(providerId, input.apiKey.trim());
        if (!stored.ok) { this.lifecycle = 'ERROR'; await this.save(); return { ok: false, category: 'unavailable' }; }
      }
    } catch { this.lifecycle = 'ERROR'; await this.save(); return { ok: false, category: 'unavailable' }; }
    let key: string | undefined;
    try {
      if (!(await this.deps.secrets.has(providerId))) {
        this.lifecycle = 'ERROR';
        await this.save();
        return { ok: false, category: 'invalid-config' };
      }
      key = await this.deps.secrets.get(providerId);
    } catch { this.lifecycle = 'ERROR'; await this.save(); return { ok: false, category: 'unavailable' }; }
    if (!key) {
      this.lifecycle = 'ERROR';
      await this.save();
      return { ok: false, category: 'invalid-config' };
    }
    let connection: Awaited<ReturnType<WorldHelperProviderRegistry['testConnection']>>;
    try { connection = await this.deps.providers.testConnection(providerId, key, input.model); }
    catch { connection = { ok: false, category: 'offline' }; }
    if (!connection.ok) {
      this.lifecycle = connection.category === 'offline' || connection.category === 'quota' ? 'DEGRADED' : 'ERROR';
      this.deps.state.errorCategory = connection.category;
      await this.save();
      return { ok: false, category: connection.category };
    }
    this.deps.state.provider = providerId;
    this.deps.state.model = input.model;
    this.deps.state.enabled = true;
    this.deps.state.onboardingComplete = true;
    this.deps.state.setupDismissed = false;
    delete this.deps.state.errorCategory;
    this.lifecycle = 'READY';
    await this.save();
    return { ok: true };
  }

  async changeProvider(input: { provider: unknown; model: unknown; apiKey?: unknown }): Promise<WorldHelperHostResult> {
    return this.configure(input);
  }

  async replaceKey(apiKey: unknown): Promise<WorldHelperHostResult> {
    const provider = this.deps.state.provider;
    if (!provider || typeof apiKey !== 'string' || !apiKey.trim()) return { ok: false, category: 'invalid-config' };
    return this.configure({ provider, model: this.deps.state.model, apiKey });
  }

  async removeProviderKey(): Promise<void> {
    this.cancelChat();
    for (const provider of worldHelperProviders()) await this.deps.secrets.remove(provider.id);
    this.deps.state.enabled = false;
    this.deps.state.onboardingComplete = false;
    this.deps.state.setupDismissed = true;
    this.pending = null;
    this.lifecycle = 'STOPPED';
    await this.save();
  }

  async removeCurrentKey(): Promise<void> {
    this.cancelChat();
    if (this.deps.state.provider) await this.deps.secrets.remove(this.deps.state.provider);
    this.deps.state.enabled = false;
    this.pending = null;
    this.lifecycle = 'STOPPED';
    await this.save();
  }

  cancelChat(requestId?: string): boolean {
    const active = this.activeChat;
    if (!active || (requestId && requestId !== active.id)) return false;
    this.activeChat = null;
    active.controller.abort();
    active.publish({ requestId: active.id, type: 'failed', category: 'offline' });
    this.lifecycle = this.deps.state.enabled ? 'READY' : 'STOPPED';
    void this.save();
    return true;
  }

  async chat(message: unknown, onStreamEvent?: (event: WorldHelperStreamEvent) => void): Promise<WorldHelperHostResult<{ proposal?: { id: string; reply: string; workers: ProposedWorker[]; worldSuggestion?: WorldId } }>> {
    this.cancelChat();
    this.pending = null;
    const requestId = `${this.createId()}-chat-${++this.requestSequence}`;
    const controller = new AbortController();
    const publish = (event: WorldHelperStreamEvent) => { try { onStreamEvent?.(event); } catch { /* UI listeners are isolated */ } };
    const activeRequest = { id: requestId, controller, publish };
    this.activeChat = activeRequest;
    const ownsRequest = () => this.activeChat === activeRequest;
    const isActive = () => this.activeChat === activeRequest && !controller.signal.aborted;
    const fail = async (category: ProviderFailureCategory | 'invalid-proposal' | 'unavailable-provider' | 'unavailable-role'): Promise<WorldHelperHostResult> => {
      if (!ownsRequest()) return { ok: false, category: 'unavailable' };
      publish({ requestId, type: 'failed', category: category === 'invalid-proposal' || category === 'unavailable-provider' || category === 'unavailable-role' ? 'invalid-response' : category });
      this.lifecycle = category === 'offline' || category === 'quota' ? 'DEGRADED' : category === 'unavailable' ? 'DEGRADED' : 'ERROR';
      this.deps.state.errorCategory = category === 'invalid-proposal' || category === 'unavailable-provider' || category === 'unavailable-role' ? 'invalid-response' : category;
      this.activeChat = null;
      await this.save();
      return { ok: false, category };
    };
    const { provider, model } = this.deps.state;
    if (!this.deps.state.enabled || !provider || !model) { this.activeChat = null; return { ok: false, category: 'invalid-config' }; }
    let key: string | undefined;
    try { key = await this.deps.secrets.get(provider); }
    catch { key = undefined; }
    if (!key) { if (isActive()) { this.lifecycle = 'ERROR'; this.deps.state.errorCategory = 'invalid-config'; this.activeChat = null; await this.save(); } return { ok: false, category: 'invalid-config' }; }
    const userText = redact(typeof message === 'string' ? message : '');
    if (!userText.trim()) { this.activeChat = null; return { ok: false, category: 'invalid-config' }; }
    this.lifecycle = 'BUSY';
    this.deps.state.transcript.push({ role: 'user', text: userText, at: this.now() });
    let context: WorldHelperContext;
    try { context = await this.deps.context(); }
    catch {
      if (!isActive()) return { ok: false, category: 'unavailable' };
      return fail('unavailable');
    }
    if (!isActive()) return { ok: false, category: 'unavailable' };
    const safeContext = {
      world: context.world ?? 'unknown',
      workers: context.workers.slice(-12).map(({ name, role, provider: engine, status }) => ({ name: redact(name).slice(0, 80), role: role ? redact(role).slice(0, 80) : undefined, provider: engine, status })),
      tasks: context.tasks.filter((task) => task.status !== 'done').slice(-8).map(({ title, status }) => ({ title: redact(title ?? '').slice(0, 240), status })),
      installedProviders: context.installedProviders ?? [],
      availableRoles: context.availableRoles ?? [],
      pendingApprovals: context.pendingApprovals ?? 0,
      availableWorlds: ['office', 'monster-trainer']
    };
    const previousConversation = this.deps.state.transcript.slice(0, -1).slice(-8)
      .map((item) => `${item.role === 'user' ? 'User' : 'GUS'}: ${item.text}`).join('\n');
    const prompt = `${JSON.stringify(safeContext)}\nConversation so far:\n${previousConversation}\nLatest user message: ${userText}`;
    const systemPrompt = buildGusSystemPrompt({
      world: safeContext.world,
      availableRoles: safeContext.availableRoles,
      installedProviders: safeContext.installedProviders
    });
    const decoder = new WorldHelperReplyDecoder();
    let decodeFailed = false;
    const onProviderDelta = (rawDelta: string) => {
      if (!isActive()) return;
      try {
        const text = decoder.push(rawDelta);
        if (text) publish({ requestId, type: 'delta', text });
      } catch { decodeFailed = true; controller.abort(); }
    };
    let answer: ProviderResult;
    try {
      answer = this.deps.providers.stream
        ? await this.deps.providers.stream(provider, key, model, systemPrompt, prompt, onProviderDelta, controller.signal)
        : await this.deps.providers.complete(provider, key, model, systemPrompt, prompt);
      if (!this.deps.providers.stream && answer.ok) onProviderDelta(answer.text);
    } catch { answer = { ok: false, category: 'offline' }; }
    if (decodeFailed && ownsRequest()) return fail('invalid-response');
    if (!isActive()) return { ok: false, category: 'unavailable' };
    if (!answer.ok) return fail(decodeFailed ? 'invalid-response' : answer.category);
    if (decodeFailed) return fail('invalid-response');
    try { decoder.finish(); } catch { return fail('invalid-response'); }
    const parsed = parseWorldHelperProposal(answer.text);
    if (!parsed.ok) return fail('invalid-proposal');
    if (parsed.value.workers.some((worker) => !(context.installedProviders ?? []).includes(worker.provider))) return fail('unavailable-provider');
    if (parsed.value.workers.some((worker) => !(context.availableRoles ?? []).includes(worker.role))) return fail('unavailable-role');
    const reply = redact(parsed.value.reply);
    this.deps.state.transcript.push({ role: 'assistant', text: reply, at: this.now() });
    this.deps.state.transcript = this.deps.state.transcript.slice(-MAX_TRANSCRIPT);
    this.pending = parsed.value.workers.length || parsed.value.worldSuggestion
      ? { id: this.createId(), workers: parsed.value.workers, worldSuggestion: parsed.value.worldSuggestion, workspace: parsed.value.workers.length ? context.workspace : undefined, createdAt: this.now() }
      : null;
    delete this.deps.state.errorCategory;
    this.lifecycle = 'READY';
    this.activeChat = null;
    publish({ requestId, type: 'complete' });
    await this.save();
    const proposal = this.pending ? { id: this.pending.id, reply, workers: this.pending.workers.map((worker) => ({ ...worker })), ...(this.pending.worldSuggestion ? { worldSuggestion: this.pending.worldSuggestion } : {}) } : undefined;
    return { ok: true, ...(proposal ? { proposal } : {}) };
  }

  async approveProposal(id: unknown, selectedNames: unknown): Promise<WorldHelperHostResult<{ launched: string[] }>> {
    const proposal = this.pending;
    const sequence = this.requestSequence;
    if (!this.deps.state.enabled || !proposal || typeof id !== 'string' || proposal.id !== id) return { ok: false, category: 'stale-proposal' };
    if (!Array.isArray(selectedNames) || selectedNames.length === 0 || selectedNames.some((name) => typeof name !== 'string')) return { ok: false, category: 'approval-required' };
    const selected = [...selectedNames] as string[];
    let context: WorldHelperContext;
    try { context = await this.deps.context(); }
    catch { return { ok: false, category: 'workspace-unavailable' }; }
    if (!this.deps.state.enabled || this.pending !== proposal || this.requestSequence !== sequence) return { ok: false, category: 'stale-proposal' };
    if (!context.workspaceAvailable || !context.workspace) return { ok: false, category: 'workspace-unavailable' };
    const approvedWorkspace = proposal.workspace;
    if (!approvedWorkspace || approvedWorkspace !== context.workspace) return { ok: false, category: 'workspace-changed' };
    const workers = proposal.workers.filter((worker) => selected.includes(worker.name));
    if (!workers.length || workers.length !== new Set(selected).size) return { ok: false, category: 'invalid-proposal' };
    if (workers.some((worker) => !(context.availableRoles ?? []).includes(worker.role))) return { ok: false, category: 'unavailable-role' };
    if (workers.some((worker) => !(context.installedProviders ?? []).includes(worker.provider))) return { ok: false, category: 'unavailable-provider' };
    // Consume before the first side effect: retries after a partial launch cannot duplicate hires.
    this.pending = null;
    await this.save();
    const launched: string[] = [];
    for (const worker of workers) {
      if (!this.deps.state.enabled || this.requestSequence !== sequence) return { ok: false, category: 'stale-proposal', launched };
      let latest: WorldHelperContext;
      try { latest = await this.deps.context(); }
      catch { return { ok: false, category: 'workspace-unavailable', launched }; }
      if (!this.deps.state.enabled || this.requestSequence !== sequence) return { ok: false, category: 'stale-proposal', launched };
      if (!latest.workspaceAvailable || !latest.workspace) return { ok: false, category: 'workspace-unavailable', launched };
      if (latest.workspace !== approvedWorkspace) return { ok: false, category: 'workspace-changed', launched };
      if (!(latest.installedProviders ?? []).includes(worker.provider)) return { ok: false, category: 'unavailable-provider', launched };
      if (!(latest.availableRoles ?? []).includes(worker.role)) return { ok: false, category: 'unavailable-role', launched };
      const request: WorldHelperLaunchRequest = {
        ...worker,
        id: this.createId(),
        capabilities: []
      };
      let result: { ok: boolean; error?: string; id?: string };
      try { result = await this.deps.launch(request); }
      catch { result = { ok: false }; }
      if (!result.ok) {
        this.lifecycle = 'DEGRADED';
        this.deps.state.errorCategory = 'unavailable';
        await this.save();
        return { ok: false, category: 'launch-failed', launched };
      }
      launched.push(result.id ?? request.id);
    }
    await this.save();
    return { ok: true, launched };
  }

  async stop(): Promise<void> {
    ++this.requestSequence;
    this.cancelChat();
    this.lifecycle = 'STOPPING';
    this.deps.state.enabled = false;
    this.pending = null;
    this.lifecycle = 'STOPPED';
    await this.save();
  }

  async dismissSetup(): Promise<void> {
    this.deps.state.setupDismissed = true;
    await this.save();
  }

  observe(event: Omit<WorldHelperNotice, 'severity'> & { severity?: WorldHelperNotice['severity'] }): void {
    if (!this.deps.state.enabled || !event || typeof event.id !== 'string' || !event.id || this.deps.state.seenEvents.includes(event.id)
      || (this.deps.isCurrentEvent && !this.deps.isCurrentEvent(event))) return;
    const severity = event.kind === 'approval-requested' || event.kind === 'worker-blocked' || event.kind === 'task-blocked'
      ? 'requires_action'
      : event.kind === 'worker-error' ? 'important' : 'informational';
    const notice: WorldHelperNotice = { ...event, severity, title: redact(event.title).slice(0, 300) };
    this.deps.state.seenEvents = [...this.deps.state.seenEvents, event.id].slice(-MAX_SEEN);
    this.deps.state.notices = [...this.deps.state.notices, notice].slice(-MAX_NOTICES);
    void this.save();
  }
}
