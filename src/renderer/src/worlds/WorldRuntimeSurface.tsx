import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Assets } from 'pixi.js';
import { PixelButton } from '@/components/PixelButton';
import type { WorldLifecycleError, WorldMount, WorldResourceResolver } from './WorldEngine';
import type { WorldPresentationCommand, WorldPresentationComposition, WorldPresentationIntent, WorldPresentationProjection } from '@shared/worldPresentationProtocol';
import { worldById } from './worldRegistry';

class SurfaceErrorBoundary extends Component<{
  onFailure: (cause: Error) => void;
  children: ReactNode;
}, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } { return { failed: true }; }

  componentDidCatch(error: Error, _info: ErrorInfo): void {
    this.props.onFailure(error);
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

export function createBrowserResourceResolver(): WorldResourceResolver {
  const runtime = import.meta.env.DEV ? 'dev' : 'packaged';
  return {
    runtime,
    async resolve(_world, resource) {
      try {
        await Assets.load({ alias: resource.url, src: resource.url, data: { scaleMode: 'nearest' } });
      } catch (cause) {
        throw Object.assign(
          cause instanceof Error ? cause : new Error(`failed to load ${resource.url}`),
          { category: runtime === 'dev' ? 'external-resource' : 'resource' }
        );
      }
    }
  };
}

/** The host gives this component sole renderer ownership; no invisible staging layer exists. */
export function WorldRuntimeSurface({
  mount,
  onReady,
  onRenderFailure,
  onDisposed,
  presentationProjection,
  presentationComposition,
  compositionSaveResult,
  onIntent
}: {
  mount: WorldMount;
  onReady: (token: number) => void;
  onRenderFailure: (token: number, cause: unknown) => void;
  onDisposed: (token: number) => void;
  presentationProjection?: WorldPresentationProjection;
  presentationComposition?: WorldPresentationComposition;
  compositionSaveResult?: Extract<WorldPresentationCommand, { type: 'update-composition' }>;
  onIntent?: (intent: WorldPresentationIntent) => void;
}) {
  const world = worldById(mount.worldId);
  return (
    <div
      data-world-layer={mount.token}
      data-world-id={mount.worldId}
      data-world-active="true"
      style={{
        position: 'absolute', inset: 0,
        zIndex: 1
      }}
    >
      <SurfaceErrorBoundary onFailure={(cause) => onRenderFailure(mount.token, cause)}>
        {world.render({
          projection: presentationProjection,
          composition: presentationComposition,
          compositionSaveResult,
          onIntent,
          onReady: () => onReady(mount.token),
          onRenderFailure: (cause) => onRenderFailure(mount.token, cause),
          onDisposed: () => onDisposed(mount.token)
        })}
      </SurfaceErrorBoundary>
    </div>
  );
}

export function WorldRecoverySurface({ error, onRetry, retryLabel = 'Retry Office' }: {
  error?: WorldLifecycleError;
  onRetry: () => void;
  retryLabel?: string;
}) {
  const detail = error
    ? `${error.phase} · ${error.worldId} · ${error.cause.message}`
    : 'World renderer did not reach READY.';
  return (
    <div
      data-world-recovery="RECOVERY"
      style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--cth-ink-900)', color: 'var(--cth-paper-100)', padding: 24
      }}
    >
      <div style={{ maxWidth: 460, textAlign: 'center', display: 'grid', gap: 12 }}>
        <strong style={{ fontFamily: 'var(--cth-font-display)', fontSize: 13 }}>WORLD RECOVERY</strong>
        <span style={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap' }}>{detail}</span>
        <div><PixelButton variant="secondary" size="sm" onClick={onRetry}>{retryLabel}</PixelButton></div>
      </div>
    </div>
  );
}
