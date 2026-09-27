import type { WorldId } from '@shared/worlds';

/** A lifecycle phase describes visual work only; it never represents Hive state. */
export type WorldPhase = 'IDLE' | 'VALIDATING' | 'BOOTSTRAPPING' | 'MOUNTING' | 'READY' | 'RECOVERY';

export interface WorldResource {
  id: string;
  url: string;
}

export interface WorldManifest {
  id: WorldId;
  resources: readonly WorldResource[];
}

/** The only dev/package seam. The engine deliberately does not know how URLs load. */
export interface WorldResourceResolver {
  runtime: string;
  resolve(world: WorldManifest, resource: WorldResource): Promise<void>;
}

export interface WorldMount {
  worldId: WorldId;
  token: number;
  fallback: boolean;
}

export interface WorldLifecycleError {
  phase: WorldPhase;
  worldId: WorldId;
  cause: Error;
  runtime: string;
  category: WorldFailureCategory;
}

export type WorldFailureCategory = 'manifest' | 'resource' | 'external-resource' | 'renderer';

export interface WorldEngineState {
  phase: WorldPhase;
  active?: WorldMount;
  /** The only mount React may render. */
  candidate?: WorldMount;
  /** A preloaded mount waiting until every released renderer is actually gone. */
  pendingMount?: WorldMount;
  /** Renderers React has been asked to unmount; host acknowledges cleanup once. */
  pendingDisposals: readonly WorldMount[];
  error?: WorldLifecycleError;
}

export interface WorldEngineOptions {
  worlds: readonly WorldManifest[];
  fallbackWorldId: WorldId;
  resolver: WorldResourceResolver;
  onStateChange?: (state: WorldEngineState) => void;
}

/**
 * Renderer-agnostic visual lifecycle with serialized renderer ownership.
 *
 * Resources validate and preload while the committed world remains READY. Once
 * preload succeeds, that renderer is released before the candidate is exposed
 * to React. `markDisposed` is the explicit cleanup acknowledgement that makes
 * the next mount legal. Therefore preload failures retain READY, while a
 * renderer failure after disposal follows the finite Office → Recovery path.
 */
export class WorldEngine {
  private readonly worlds = new Map<WorldId, WorldManifest>();
  private readonly fallbackWorldId: WorldId;
  private readonly resolver: WorldResourceResolver;
  private readonly onStateChange?: (state: WorldEngineState) => void;
  private state: WorldEngineState = { phase: 'IDLE', pendingDisposals: [] };
  private requestToken = 0;
  private mountToken = 0;

  constructor(options: WorldEngineOptions) {
    for (const world of options.worlds) this.worlds.set(world.id, world);
    this.fallbackWorldId = options.fallbackWorldId;
    this.resolver = options.resolver;
    this.onStateChange = options.onStateChange;
  }

  getState(): WorldEngineState {
    return this.state;
  }

  /** Start a fresh selection. A stale in-flight mount is released, never committed. */
  async select(worldId: WorldId): Promise<WorldEngineState> {
    const request = ++this.requestToken;
    this.discardCandidate();
    await this.prepare(worldId, false, request);
    return this.state;
  }

  /** Called by the sole mounted renderer after its first complete frame. */
  markReady(token: number): boolean {
    const candidate = this.state.candidate;
    if (!candidate || candidate.token !== token) return false;
    this.setState({
      phase: 'READY',
      active: candidate,
      pendingDisposals: this.state.pendingDisposals,
      error: candidate.fallback ? this.state.error : undefined
    });
    return true;
  }

  /** Called for async init/render failures from a mounted surface. */
  async markFailed(token: number, cause: unknown): Promise<boolean> {
    const error = asError(cause);
    const candidate = this.state.candidate;
    if (candidate?.token === token) {
      this.setState({
        ...this.state,
        candidate: undefined,
        pendingDisposals: this.queueDisposal(candidate)
      });
      await this.fail(candidate.worldId, 'MOUNTING', error, candidate.fallback, this.requestToken);
      return true;
    }

    const active = this.state.active;
    if (active?.token !== token) return false;

    // An active renderer has already failed, so it cannot be considered a
    // preservable READY world. Preload the one allowed Office fallback, then
    // release it before exposing that fallback renderer.
    const request = ++this.requestToken;
    if (active.worldId === this.fallbackWorldId) {
      this.enterRecovery(active.worldId, 'READY', error, active);
    } else {
      await this.prepare(this.fallbackWorldId, true, request, this.lifecycleError(active.worldId, 'READY', error));
    }
    return true;
  }

  /** Acknowledge actual renderer/canvas cleanup. Idempotent by token. */
  markDisposed(token: number): boolean {
    const pendingDisposals = this.state.pendingDisposals.filter((mount) => mount.token !== token);
    if (pendingDisposals.length === this.state.pendingDisposals.length) return false;

    const next = { ...this.state, pendingDisposals };
    if (pendingDisposals.length === 0 && this.state.pendingMount) {
      this.setState({
        ...next,
        phase: 'MOUNTING',
        candidate: this.state.pendingMount,
        pendingMount: undefined
      });
    } else {
      this.setState(next);
    }
    return true;
  }

  private async prepare(
    worldId: WorldId,
    fallback: boolean,
    request: number,
    priorError?: WorldLifecycleError
  ): Promise<void> {
    const manifest = this.worlds.get(worldId);
    if (!manifest || !this.isManifestValid(manifest)) {
      await this.fail(worldId, 'VALIDATING', new Error(`invalid world manifest: ${worldId}`), fallback, request);
      return;
    }

    this.setState({ ...this.state, phase: 'VALIDATING', candidate: undefined, error: priorError });
    if (request !== this.requestToken) return;

    this.setState({ ...this.state, phase: 'BOOTSTRAPPING' });
    try {
      for (const resource of manifest.resources) {
        await this.resolver.resolve(manifest, resource);
        if (request !== this.requestToken) return;
      }
    } catch (cause) {
      if (request === this.requestToken) {
        await this.fail(worldId, 'BOOTSTRAPPING', asError(cause), fallback, request);
      }
      return;
    }

    if (request !== this.requestToken) return;
    this.afterPreload({ worldId, token: ++this.mountToken, fallback });
  }

  /** Never expose a renderer candidate while an earlier renderer still exists. */
  private afterPreload(nextMount: WorldMount): void {
    const active = this.state.active;
    if (active) {
      this.setState({
        ...this.state,
        phase: 'MOUNTING',
        active: undefined,
        candidate: undefined,
        pendingMount: nextMount,
        pendingDisposals: this.queueDisposal(active)
      });
      return;
    }

    if (this.state.pendingDisposals.length > 0) {
      this.setState({ ...this.state, phase: 'MOUNTING', candidate: undefined, pendingMount: nextMount });
      return;
    }

    this.setState({ ...this.state, phase: 'MOUNTING', candidate: nextMount, pendingMount: undefined });
  }

  private async fail(
    worldId: WorldId,
    phase: WorldPhase,
    cause: Error,
    fallbackAttempt: boolean,
    request: number
  ): Promise<void> {
    if (request !== this.requestToken) return;
    const failure = this.lifecycleError(worldId, phase, cause);
    const active = this.state.active;

    if (active && !fallbackAttempt) {
      // Resource/manifest failure happened before the old renderer was released.
      this.setState({ ...this.state, phase: 'READY', candidate: undefined, pendingMount: undefined, error: failure });
      return;
    }

    if (!active && !fallbackAttempt && worldId !== this.fallbackWorldId) {
      await this.prepare(this.fallbackWorldId, true, request, failure);
      return;
    }

    this.enterRecovery(worldId, phase, cause, active);
  }

  private enterRecovery(worldId: WorldId, phase: WorldPhase, cause: Error, active?: WorldMount): void {
    this.setState({
      phase: 'RECOVERY',
      pendingDisposals: this.queueDisposal(active),
      error: this.lifecycleError(worldId, phase, cause)
    });
  }

  private discardCandidate(): void {
    const candidate = this.state.candidate;
    const pendingMount = this.state.pendingMount;
    if (!candidate && !pendingMount) return;
    this.setState({
      ...this.state,
      candidate: undefined,
      pendingMount: undefined,
      pendingDisposals: this.queueDisposal(candidate)
    });
  }

  private queueDisposal(mount?: WorldMount): readonly WorldMount[] {
    if (!mount || this.state.pendingDisposals.some((candidate) => candidate.token === mount.token)) {
      return this.state.pendingDisposals;
    }
    return [...this.state.pendingDisposals, mount];
  }

  private isManifestValid(manifest: WorldManifest): boolean {
    return manifest.id.length > 0 && manifest.resources.every((resource) =>
      typeof resource.id === 'string' && resource.id.length > 0 &&
      typeof resource.url === 'string' && resource.url.length > 0
    );
  }

  private lifecycleError(worldId: WorldId, phase: WorldPhase, cause: Error): WorldLifecycleError {
    return {
      phase,
      worldId,
      cause,
      runtime: this.resolver.runtime,
      category: failureCategory(cause, phase, this.resolver.runtime)
    };
  }

  private setState(state: WorldEngineState): void {
    this.state = state;
    this.onStateChange?.(state);
  }
}

function asError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

function failureCategory(cause: Error, phase: WorldPhase, runtime: string): WorldFailureCategory {
  const declared = (cause as Error & { category?: unknown }).category;
  if (declared === 'manifest' || declared === 'resource' || declared === 'external-resource' || declared === 'renderer') {
    return declared;
  }
  if (phase === 'VALIDATING') return 'manifest';
  if (phase === 'BOOTSTRAPPING') return runtime === 'dev' ? 'external-resource' : 'resource';
  return 'renderer';
}
