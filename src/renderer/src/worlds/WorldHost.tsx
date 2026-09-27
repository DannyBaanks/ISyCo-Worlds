import { useEffect, useMemo, useRef, useState } from 'react';
import type { HarnessConfig } from '@/store/config';
import { WorldEngine, type WorldEngineState, type WorldMount } from './WorldEngine';
import { FALLBACK_WORLD_ID, WORLD_REGISTRY } from './worldRegistry';
import { createBrowserResourceResolver, WorldRecoverySurface, WorldRuntimeSurface } from './WorldRuntimeSurface';
import type { WorldPresentationComposition, WorldPresentationIntent, WorldPresentationIntentMessage, WorldPresentationProjection, WorldPresentationStatus } from '@shared/worldPresentationProtocol';
import { useWorldProjection } from './useWorldProjection';
import { useStore } from '@/store/store';
import { validateComposition, type WorldCompositionV1 } from '@shared/worldComposition';
import { STARTER_VILLAGE_COMPOSITION_DEFINITION, STARTER_VILLAGE_PRESET } from './monster/StarterVillageScenario';

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
  presentation?: { profileId: 'office' | 'monster-trainer'; generation: number; projection: WorldPresentationProjection; composition?: WorldPresentationComposition; compositionSaveResult?: Extract<import('@shared/worldPresentationProtocol').WorldPresentationCommand, { type: 'update-composition' }>; onIntent: (intent: WorldPresentationIntent) => void };
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
          presentationComposition={presentation?.composition}
          compositionSaveResult={presentation?.compositionSaveResult}
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
  const { snapshot, visualIdentities } = useWorldProjection();
  const projection = useMemo<WorldPresentationProjection>(() => ({
    agents: snapshot.agents.map((agent) => ({ ...agent })),
    tasks: snapshot.tasks.map((task) => ({ ...task })),
    visualIdentities
  }), [snapshot, visualIdentities]);
  const projectionRef = useRef(projection);
  projectionRef.current = projection;
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
    const unsubscribeIntent = window.cth.onWorldPresentationIntent((message: WorldPresentationIntentMessage) => {
      const { intent } = message;
      if (intent.type === 'select-agent') useStore.getState().select(intent.agentId);
      else if (intent.type === 'open-task') useStore.getState().openTaskDetail(intent.taskId);
      else if (intent.type === 'save-composition' && message.profileId === profileId) {
        const validation = validateComposition(intent.layout, STARTER_VILLAGE_COMPOSITION_DEFINITION);
        void (async () => {
          const result = validation.ok
            ? await window.cth.saveWorldComposition(profileId, intent.layout)
            : { ok: false as const, category: 'invalid' as const };
          if (!live) return;
          await window.cth.respondWorldCompositionSave(
            profileId, message.generation, intent.requestId, result.ok,
            result.ok ? intent.layout : undefined
          );
        })();
      }
    });
    void (async () => {
      let composition: WorldPresentationComposition = { layout: STARTER_VILLAGE_PRESET, source: 'preset' };
      try {
        const saved = await window.cth.getWorldComposition(profileId, 'starter-village');
        if (!saved.ok && saved.category === 'invalid') composition = { layout: STARTER_VILLAGE_PRESET, source: 'invalid-fallback' };
        else if (saved.ok && saved.layout) {
          composition = validateComposition(saved.layout, STARTER_VILLAGE_COMPOSITION_DEFINITION).ok
            ? { layout: saved.layout, source: 'saved' }
            : { layout: STARTER_VILLAGE_PRESET, source: 'invalid-fallback' };
        }
      } catch { /* local persistence can be unavailable; the immutable preset remains usable */ }
      if (!live) return;
      started.current = true;
      const next = await window.cth.startWorldPresentation(profileId, projectionRef.current, composition);
      if (live && next) acceptStatus(next);
    })();
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
