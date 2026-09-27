import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { HarnessConfig } from '@/store/config';
import { WorldEngine, type WorldEngineState, type WorldMount } from './WorldEngine';
import { FALLBACK_WORLD_ID, WORLD_REGISTRY } from './worldRegistry';
import { createBrowserResourceResolver, WorldRecoverySurface, WorldRuntimeSurface } from './WorldRuntimeSurface';

const IDLE: WorldEngineState = { phase: 'IDLE', pendingDisposals: [] };

/** React adapter for the serialized engine. Exactly one Pixi surface may render. */
export function WorldHost({ config }: { config: HarnessConfig }) {
  const [state, setState] = useState<WorldEngineState>(IDLE);
  const [retiredTokens, setRetiredTokens] = useState<ReadonlySet<number>>(() => new Set());
  const engineRef = useRef<WorldEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new WorldEngine({
      worlds: WORLD_REGISTRY,
      fallbackWorldId: FALLBACK_WORLD_ID,
      resolver: createBrowserResourceResolver(),
      onStateChange: setState
    });
  }
  const engine = engineRef.current;
  const selectedWorld = config.worldsEnabled ? (config.selectedWorld ?? FALLBACK_WORLD_ID) : FALLBACK_WORLD_ID;

  useEffect(() => {
    void engine.select(selectedWorld);
  }, [engine, selectedWorld]);

  useEffect(() => {
    const pendingTokens = new Set(state.pendingDisposals.map((mount) => mount.token));
    setRetiredTokens((previous) => {
      const next = new Set([...previous].filter((token) => pendingTokens.has(token)));
      return next.size === previous.size ? previous : next;
    });
  }, [state.pendingDisposals]);

  const retiring = state.pendingDisposals.filter((mount) => !retiredTokens.has(mount.token));
  useLayoutEffect(() => {
    if (retiring.length === 0) return;
    setRetiredTokens((previous) => {
      const next = new Set(previous);
      for (const mount of retiring) next.add(mount.token);
      return next;
    });
    // The setState above removes the layer in this layout turn; acknowledge its
    // synchronous Pixi cleanup after React has applied that explicit swap.
    queueMicrotask(() => retiring.forEach((mount) => engine.markDisposed(mount.token)));
  }, [engine, retiring]);

  const mounts = visibleMounts(state, retiredTokens);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {mounts.map((mount) => (
        <WorldRuntimeSurface
          key={mount.token}
          mount={mount}
          onReady={(token) => engine.markReady(token)}
          onRenderFailure={(token, cause) => { void engine.markFailed(token, cause); }}
        />
      ))}
      {!state.active && state.phase !== 'RECOVERY' && (
        <div data-world-loading={state.phase} style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          Loading world…
        </div>
      )}
      {state.error && state.phase !== 'RECOVERY' && (
        <div data-world-error={`${state.error.phase}:${state.error.worldId}`} style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 3, fontFamily: 'monospace', fontSize: 11 }}>
          {state.error.phase} · {state.error.worldId}: {state.error.cause.message}
        </div>
      )}
      {state.phase === 'RECOVERY' && <WorldRecoverySurface error={state.error} onRetry={() => { void engine.select(FALLBACK_WORLD_ID); }} />}
    </div>
  );
}

function visibleMounts(state: WorldEngineState, retired: ReadonlySet<number>): readonly WorldMount[] {
  const mount = state.candidate ?? state.active;
  return mount && !retired.has(mount.token) ? [mount] : [];
}
