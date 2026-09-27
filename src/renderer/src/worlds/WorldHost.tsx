import { useEffect, useRef, useState } from 'react';
import type { HarnessConfig } from '@/store/config';
import { WorldEngine, type WorldEngineState, type WorldMount } from './WorldEngine';
import { FALLBACK_WORLD_ID, WORLD_REGISTRY } from './worldRegistry';
import { createBrowserResourceResolver, WorldRecoverySurface, WorldRuntimeSurface } from './WorldRuntimeSurface';

const IDLE: WorldEngineState = { phase: 'IDLE', pendingDisposals: [] };

/** React adapter for the serialized engine. Exactly one Pixi surface may render. */
export function WorldHost({ config }: { config: HarnessConfig }) {
  const [state, setState] = useState<WorldEngineState>(IDLE);
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

  const mounts = visibleMounts(state);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {mounts.map((mount) => (
        <WorldRuntimeSurface
          key={mount.token}
          mount={mount}
          onReady={(token) => engine.markReady(token)}
          onRenderFailure={(token, cause) => { void engine.markFailed(token, cause); }}
          onDisposed={(token) => engine.markDisposed(token)}
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

function visibleMounts(state: WorldEngineState): readonly WorldMount[] {
  const mount = state.candidate ?? state.active;
  return mount ? [mount] : [];
}
