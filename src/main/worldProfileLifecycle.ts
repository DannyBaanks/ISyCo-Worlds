export type WorldProfileLifecyclePhase =
  | 'VALIDATING' | 'PREPARING' | 'AWAITING_CONFIRMATION' | 'STOPPING' | 'BINDING' | 'STARTING';

export interface WorldProfileLifecycleError {
  phase: WorldProfileLifecyclePhase;
  profileId: string;
  capabilityId?: string;
  category: string;
  cause: { name: string; message: string };
}

export interface WorldProfileRuntimeStatus {
  state: 'READY' | 'STOPPED' | 'SWITCHING' | 'ERROR';
  activeProfileId: string | null;
  pendingProfileId: string | null;
  sessionId: string | null;
  error?: WorldProfileLifecycleError;
}

export interface ResolvedRuntimeProfile {
  id: string;
  capabilities: Array<{ id: string; required?: boolean }>;
}

export interface WorldProfileLifecycleDependencies {
  initialProfileId: string | null;
  resolve: (profileId: string) => Promise<ResolvedRuntimeProfile>;
  prepare: (profile: ResolvedRuntimeProfile) => Promise<void>;
  stop: (profileId: string) => Promise<void>;
  bind: (profileId: string | null) => void;
  start: (profile: ResolvedRuntimeProfile) => Promise<void>;
  createSessionId?: () => string;
}

function errorCause(value: unknown): { name: string; message: string } {
  if (value instanceof Error) return { name: value.name || 'Error', message: value.message };
  return { name: 'Error', message: String(value) };
}

function makeError(profileId: string, phase: WorldProfileLifecyclePhase, value: unknown, category?: string): WorldProfileLifecycleError {
  const error = value as { capabilityId?: unknown; category?: unknown } | null;
  return {
    phase,
    profileId,
    ...(typeof error?.capabilityId === 'string' ? { capabilityId: error.capabilityId } : {}),
    category: category ?? (typeof error?.category === 'string' ? error.category : 'runtime'),
    cause: errorCause(value)
  };
}

/** Coordinates semantic profile changes; the renderer and GUI process stay alive. */
export class WorldProfileLifecycle {
  private status: WorldProfileRuntimeStatus;
  private switching: Promise<unknown> | null = null;
  private readonly createSessionId: () => string;

  constructor(private readonly deps: WorldProfileLifecycleDependencies) {
    this.createSessionId = deps.createSessionId ?? (() => `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    this.status = {
      state: deps.initialProfileId ? 'READY' : 'STOPPED',
      activeProfileId: deps.initialProfileId,
      pendingProfileId: null,
      sessionId: deps.initialProfileId ? 'initial' : null
    };
  }

  getStatus(): WorldProfileRuntimeStatus {
    return { ...this.status, error: this.status.error ? { ...this.status.error, cause: { ...this.status.error.cause } } : undefined };
  }

  activate(profileId: string, options: { confirmed?: boolean } = {}): Promise<
    { ok: true; activeProfileId: string } | { ok: false; error: WorldProfileLifecycleError }
  > {
    if (this.switching) return Promise.resolve({
      ok: false,
      error: makeError(profileId, 'STOPPING', new Error('A world profile transition is already in progress'), 'transition-in-progress')
    });
    if (this.status.activeProfileId === profileId && this.status.state === 'READY') {
      return Promise.resolve({ ok: true, activeProfileId: profileId });
    }
    if (this.status.activeProfileId && !options.confirmed) {
      return Promise.resolve({
        ok: false,
        error: makeError(profileId, 'AWAITING_CONFIRMATION', new Error('Changing world profiles restarts the harness runtime'), 'confirmation-required')
      });
    }
    const operation = this.activateInternal(profileId);
    this.switching = operation;
    return operation.finally(() => { this.switching = null; });
  }

  private async activateInternal(profileId: string): Promise<
    { ok: true; activeProfileId: string } | { ok: false; error: WorldProfileLifecycleError }
  > {
    let candidate: ResolvedRuntimeProfile;
    try {
      candidate = await this.deps.resolve(profileId);
      if (!candidate || candidate.id !== profileId || !Array.isArray(candidate.capabilities)) {
        throw Object.assign(new Error('Profile resolver returned an invalid profile'), { category: 'invalid-profile' });
      }
    } catch (cause) {
      return this.failBeforeTeardown(profileId, 'VALIDATING', cause);
    }

    try {
      await this.deps.prepare(candidate);
    } catch (cause) {
      return this.failBeforeTeardown(profileId, 'PREPARING', cause);
    }

    const previous = this.status.activeProfileId;
    this.status = { ...this.status, state: 'SWITCHING', pendingProfileId: profileId, error: undefined };
    if (previous) {
      try { await this.deps.stop(previous); }
      catch (cause) {
        this.status = { state: 'ERROR', activeProfileId: null, pendingProfileId: null, sessionId: null, error: makeError(profileId, 'STOPPING', cause) };
        return { ok: false, error: this.status.error! };
      }
    }

    this.status = { state: 'SWITCHING', activeProfileId: null, pendingProfileId: profileId, sessionId: null };
    try {
      this.deps.bind(profileId);
    } catch (cause) {
      this.deps.bind(null);
      this.status = { state: 'ERROR', activeProfileId: null, pendingProfileId: null, sessionId: null, error: makeError(profileId, 'BINDING', cause) } as WorldProfileRuntimeStatus;
      return { ok: false, error: this.status.error! };
    }
    try {
      await this.deps.start(candidate);
    } catch (cause) {
      try { await this.deps.stop(profileId); } catch { /* best-effort cleanup of partial startup */ }
      this.deps.bind(null);
      this.status = { state: 'ERROR', activeProfileId: null, pendingProfileId: null, sessionId: null, error: makeError(profileId, 'STARTING', cause) };
      return { ok: false, error: this.status.error! };
    }

    this.status = { state: 'READY', activeProfileId: profileId, pendingProfileId: null, sessionId: this.createSessionId() };
    return { ok: true, activeProfileId: profileId };
  }

  private failBeforeTeardown(
    profileId: string,
    phase: 'VALIDATING' | 'PREPARING',
    cause: unknown
  ): { ok: false; error: WorldProfileLifecycleError } {
    const error = makeError(profileId, phase, cause);
    this.status = { ...this.status, pendingProfileId: null, error };
    if (this.status.activeProfileId) this.status.state = 'READY';
    else this.status.state = 'ERROR';
    return { ok: false, error };
  }
}
