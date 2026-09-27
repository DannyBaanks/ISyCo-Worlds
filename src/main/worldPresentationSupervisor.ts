import {
  isCurrentWorldPresentationEvent,
  isWorldPresentationCommand,
  isWorldPresentationEvent,
  type WorldPresentationCommand,
  type WorldPresentationError,
  type WorldPresentationEvent,
  type WorldPresentationIntent,
  type WorldPresentationPhase,
  type WorldPresentationProjection,
  type WorldPresentationStatus
} from '../shared/worldPresentationProtocol';
import { isWorldId, type WorldId } from '../shared/worlds';

export interface WorldPresentationHost {
  id: string | number;
  isAlive?(): boolean;
  send(command: WorldPresentationCommand): void;
  destroy(): Promise<void> | void;
}

export interface WorldPresentationSupervisorOptions {
  createHost(generation: number, emit: (event: unknown) => boolean, profileId?: WorldId): Promise<WorldPresentationHost> | WorldPresentationHost;
  onStatus(status: WorldPresentationStatus): void;
  onIntent(intent: WorldPresentationIntent): void;
}

export class WorldPresentationSupervisor {
  private readonly options: WorldPresentationSupervisorOptions;
  private host: WorldPresentationHost | null = null;
  private profileId: WorldId | null = null;
  private projection: WorldPresentationProjection | null = null;
  private generation = 0;
  private lifecycleOperation = 0;
  private destroying = new WeakSet<object>();
  private status: WorldPresentationStatus = { phase: 'IDLE', profileId: null, generation: 0 };

  constructor(options: WorldPresentationSupervisorOptions) { this.options = options; }

  getStatus(): WorldPresentationStatus { return { ...this.status, error: this.status.error ? { ...this.status.error, cause: { ...this.status.error.cause } } : undefined }; }

  async start(profileId: string, projection: WorldPresentationProjection): Promise<WorldPresentationStatus> {
    if (!isWorldId(profileId)) return this.fail(profileId as WorldId, 'VALIDATING', 'protocol', new Error('Invalid world profile id'));
    const command = { type: 'bootstrap', profileId, generation: this.generation + 1, projection } as const;
    if (!isWorldPresentationCommand(command)) return this.fail(profileId, 'VALIDATING', 'protocol', new Error('Invalid world projection'));
    const operation = ++this.lifecycleOperation;
    if (this.host) await this.destroyCurrent();
    if (operation !== this.lifecycleOperation) return this.getStatus();
    this.profileId = profileId;
    this.projection = structuredClone(projection);
    return this.createAndBootstrap();
  }

  async updateProjection(projection: WorldPresentationProjection): Promise<boolean> {
    if (!this.profileId || !isWorldPresentationCommand({ type: 'update-projection', profileId: this.profileId, generation: this.generation, projection })) return false;
    this.projection = structuredClone(projection);
    // Resource loading can take time before createHost resolves. Retain the
    // newest semantic snapshot and include it in bootstrap instead of dropping
    // updates that arrive during loadURL.
    this.host?.send({ type: 'update-projection', profileId: this.profileId, generation: this.generation, projection: this.projection });
    return true;
  }

  async restartVisual(): Promise<WorldPresentationStatus> {
    if (!this.profileId || !this.projection) return this.getStatus();
    const operation = ++this.lifecycleOperation;
    const profileId = this.profileId;
    await this.destroyCurrent();
    if (operation !== this.lifecycleOperation || this.profileId !== profileId) return this.getStatus();
    return this.createAndBootstrap();
  }

  async dispose(): Promise<void> {
    this.lifecycleOperation += 1;
    const hostGeneration = this.generation;
    if (this.host) {
      try { this.host.send({ type: 'dispose', generation: hostGeneration }); } catch { /* host may already be gone */ }
    }
    // Invalidate pending createHost() completions and concurrent lifecycle
    // work synchronously, before awaiting a potentially slow WebContents close.
    this.generation += 1;
    const disposeGeneration = this.generation;
    const destruction = this.destroyCurrent();
    this.profileId = null;
    this.projection = null;
    this.setStatus({ phase: 'IDLE', profileId: null, generation: disposeGeneration });
    await destruction;
  }

  /** Entry point for host IPC. The caller must first prove sender webContents ownership. */
  acceptEvent(senderId: string | number, value: unknown): boolean {
    if (!this.host || String(this.host.id) !== String(senderId) || !isWorldPresentationEvent(value) || !this.profileId
      || !isCurrentWorldPresentationEvent(value, this.profileId, this.generation)) return false;
    const event = value as WorldPresentationEvent;
    if (event.type === 'intent') {
      if (this.status.phase !== 'READY') return false;
      this.options.onIntent(event.intent);
      return true;
    }
    if (event.type === 'failed') {
      this.setStatus({ phase: 'RECOVERY', profileId: event.profileId, generation: event.generation, error: event.error });
      void this.destroyCurrent();
      return true;
    }
    const phase: WorldPresentationPhase = event.type === 'ready' ? 'READY' : event.phase;
    this.setStatus({ phase, profileId: event.profileId, generation: event.generation });
    return true;
  }

  private async createAndBootstrap(): Promise<WorldPresentationStatus> {
    const profileId = this.profileId!;
    this.generation += 1;
    const generation = this.generation;
    this.setStatus({ phase: 'BOOTSTRAPPING', profileId, generation });
    try {
      const host = await this.options.createHost(generation, (event) => this.acceptCurrentEvent(event, profileId, generation), profileId);
      // createHost can resolve late after a concurrent dispose/restart. Do not adopt an obsolete host.
      if (generation !== this.generation || this.profileId !== profileId) {
        await host.destroy();
        return this.getStatus();
      }
      if (host.isAlive && !host.isAlive()) {
        await host.destroy();
        throw new Error('visual renderer exited during bootstrap');
      }
      this.host = host;
      const projection = this.projection;
      if (!projection || this.profileId !== profileId || generation !== this.generation) {
        await this.destroyCurrent();
        return this.getStatus();
      }
      host.send({ type: 'bootstrap', profileId, generation, projection });
      return this.getStatus();
    } catch (error) {
      if (generation !== this.generation || this.profileId !== profileId) return this.getStatus();
      return this.fail(profileId, 'BOOTSTRAPPING', 'host', error);
    }
  }

  private async destroyCurrent(): Promise<void> {
    const host = this.host;
    if (!host || this.destroying.has(host as object)) return;
    this.host = null;
    this.destroying.add(host as object);
    try { await host.destroy(); } catch { /* disposal is best effort; the owner remains detached */ }
  }

  private acceptCurrentEvent(value: unknown, profileId: WorldId, generation: number): boolean {
    if (!isWorldPresentationEvent(value) || !this.host || !this.profileId
      || generation !== this.generation || !isCurrentWorldPresentationEvent(value, profileId, generation)) return false;
    return this.acceptEvent(this.host.id, value);
  }

  private fail(profileId: WorldId, phase: WorldPresentationError['phase'], category: WorldPresentationError['category'], cause: unknown): WorldPresentationStatus {
    this.generation += 1;
    const error: WorldPresentationError = {
      phase, profileId, category,
      cause: { name: cause instanceof Error ? cause.name : 'Error', message: cause instanceof Error ? cause.message : String(cause) }
    };
    this.profileId = profileId;
    this.setStatus({ phase: 'RECOVERY', profileId, generation: this.generation, error });
    return this.getStatus();
  }

  private setStatus(status: WorldPresentationStatus): void {
    this.status = status;
    this.options.onStatus(this.getStatus());
  }
}
