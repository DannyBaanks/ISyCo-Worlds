import { useEffect, useMemo, useRef, useState } from 'react';
import type { HarnessConfig } from '@/store/config';
import { WorldEngine, type WorldEngineState, type WorldMount } from './WorldEngine';
import { FALLBACK_WORLD_ID, WORLD_REGISTRY } from './worldRegistry';
import { createBrowserResourceResolver, WorldRecoverySurface, WorldRuntimeSurface } from './WorldRuntimeSurface';
import type { WorldPresentationIntent, WorldPresentationProjection, WorldPresentationStatus } from '@shared/worldPresentationProtocol';
import { useWorldProjection } from './useWorldProjection';
import { useStore } from '@/store/store';

const IDLE: WorldEngineState = { phase: 'IDLE', pendingDisposals: [] };

/** React adapter for the serialized engine. Exactly one Pixi surface may render. */
export function WorldHost({ config, profileId = 'office' }: { config: HarnessConfig; profileId?: 'office' | 'monster-trainer' }) {
  if (profileId === 'monster-trainer') return <IsolatedWorldViewport profileId={profileId} />;
  return <WorldSceneHost config={config} profileId="office" />;
}

export function WorldSceneHost({
  config,
  profileId,
  presentation,
  onPresentationState
}: {
  config?: HarnessConfig;
  profileId?: 'office' | 'monster-trainer';
  presentation?: { profileId: 'office' | 'monster-trainer'; generation: number; projection: WorldPresentationProjection; onIntent: (intent: WorldPresentationIntent) => void };
  onPresentationState?: (status: WorldPresentationStatus) => void;
}) {
  const [state, setState] = useState<WorldEngineState>(IDLE);
  const presentationRef = useRef(presentation);
  const onPresentationStateRef = useRef(onPresentationState);
  presentationRef.current = presentation;
  onPresentationStateRef.current = onPresentationState;
  const engineRef = useRef<WorldEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new WorldEngine({
      worlds: WORLD_REGISTRY,
      fallbackWorldId: FALLBACK_WORLD_ID,
      resolver: createBrowserResourceResolver(),
      onStateChange: (next) => {
        setState(next);
        const session = presentationRef.current;
        const report = onPresentationStateRef.current;
        if (!session || !report) return;
        if (next.error && (next.candidate?.worldId !== session.profileId || next.active?.worldId !== session.profileId)
          && (next.candidate?.worldId === FALLBACK_WORLD_ID || next.active?.worldId === FALLBACK_WORLD_ID)) {
          report({ phase: 'RECOVERY', profileId: session.profileId, generation: session.generation, error: {
            phase: next.error.phase === 'IDLE' || next.error.phase === 'READY' || next.error.phase === 'RECOVERY' ? 'MOUNTING' : next.error.phase,
            profileId: session.profileId,
            category: 'resource',
            cause: { name: next.error.cause.name, message: next.error.cause.message }
          } });
          return;
        }
        if (next.phase === 'READY' && next.active?.worldId === session.profileId) {
          report({ phase: 'READY', profileId: session.profileId, generation: session.generation });
          return;
        }
        if (next.phase === 'READY' && next.error && next.active?.worldId !== session.profileId) {
          report({ phase: 'RECOVERY', profileId: session.profileId, generation: session.generation, error: {
            phase: next.error.phase === 'IDLE' || next.error.phase === 'READY' || next.error.phase === 'RECOVERY' ? 'MOUNTING' : next.error.phase,
            profileId: session.profileId,
            category: 'resource',
            cause: { name: next.error.cause.name, message: next.error.cause.message }
          } });
          return;
        }
        if (next.phase === 'RECOVERY' && next.error) {
          report({ phase: 'RECOVERY', profileId: session.profileId, generation: session.generation, error: {
            phase: next.error.phase === 'IDLE' || next.error.phase === 'READY' || next.error.phase === 'RECOVERY' ? 'MOUNTING' : next.error.phase,
            profileId: session.profileId,
            category: 'resource',
            cause: { name: next.error.cause.name, message: next.error.cause.message }
          } });
          return;
        }
        if (['VALIDATING', 'BOOTSTRAPPING', 'MOUNTING'].includes(next.phase)) {
          report({ phase: next.phase as 'VALIDATING' | 'BOOTSTRAPPING' | 'MOUNTING', profileId: session.profileId, generation: session.generation });
        }
      }
    });
  }
  const engine = engineRef.current;
  const selectedWorld = presentation?.profileId ?? profileId ?? (config?.worldsEnabled ? (config.selectedWorld ?? FALLBACK_WORLD_ID) : FALLBACK_WORLD_ID);

  useEffect(() => {
    void engine.select(selectedWorld);
  }, [engine, selectedWorld]);

  const mounts = visibleMounts(state).filter((mount) => !presentation || mount.worldId === presentation.profileId);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {mounts.map((mount) => (
        <WorldRuntimeSurface
          key={mount.token}
          mount={mount}
          presentationProjection={presentation?.projection}
          onIntent={presentation?.onIntent}
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

function IsolatedWorldViewport({ profileId }: { profileId: 'monster-trainer' }) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const { snapshot } = useWorldProjection();
  const projection = useMemo<WorldPresentationProjection>(() => ({
    agents: snapshot.agents.map((agent) => ({ ...agent })),
    tasks: snapshot.tasks.map((task) => ({ ...task }))
  }), [snapshot]);
  const [status, setStatus] = useState<WorldPresentationStatus>({ phase: 'BOOTSTRAPPING', profileId, generation: 0 });
  const started = useRef(false);
  const acceptStatus = (next: WorldPresentationStatus): void => setStatus((current) => {
    if (next.generation < current.generation) return current;
    if (next.generation === current.generation && (current.phase === 'READY' || current.phase === 'RECOVERY')) return current;
    return next;
  });

  useEffect(() => {
    let live = true;
    const unsubscribeStatus = window.cth.onWorldPresentationStatus((next) => { if (live) acceptStatus(next); });
    const unsubscribeIntent = window.cth.onWorldPresentationIntent((intent) => {
      if (intent.type === 'select-agent') useStore.getState().select(intent.agentId);
      else if (intent.type === 'open-task') useStore.getState().openTaskDetail(intent.taskId);
    });
    started.current = true;
    void window.cth.startWorldPresentation(profileId, projection).then((next) => { if (live && next) acceptStatus(next); });
    return () => {
      live = false;
      started.current = false;
      unsubscribeStatus();
      unsubscribeIntent();
      window.cth.setWorldPresentationBounds({ x: 0, y: 0, width: 0, height: 0 });
      void window.cth.disposeWorldPresentation();
    };
  }, [profileId]);

  useEffect(() => {
    if (started.current) void window.cth.updateWorldPresentation(projection);
  }, [projection]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const update = () => {
      if (status.phase !== 'READY') {
        window.cth.setWorldPresentationBounds({ x: 0, y: 0, width: 0, height: 0 });
        return;
      }
      const bounds = viewport.getBoundingClientRect();
      window.cth.setWorldPresentationBounds({ x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    window.addEventListener('resize', update);
    return () => { observer.disconnect(); window.removeEventListener('resize', update); };
  }, [status.phase]);

  const config = { worldsEnabled: false } as HarnessConfig;
  return (
    <div ref={viewportRef} data-world-presentation-viewport={profileId} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {status.phase !== 'READY' && <WorldSceneHost config={config} profileId="office" />}
      {status.phase === 'RECOVERY' && (
        <WorldRecoverySurface error={status.error ? {
          phase: status.error.phase, worldId: status.error.profileId, cause: new Error(status.error.cause.message),
          runtime: 'host', category: status.error.category === 'resource' ? 'resource' : 'renderer'
        } : undefined} retryLabel="Retry Monster Trainer" onRetry={() => { void window.cth.restartWorldPresentation().then(acceptStatus); }} />
      )}
      {status.phase !== 'READY' && status.phase !== 'RECOVERY' && (
        <div data-world-loading={status.phase} style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>Loading Monster Trainer…</div>
      )}
    </div>
  );
}
