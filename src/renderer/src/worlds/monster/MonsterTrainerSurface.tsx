import { useMemo, useRef } from 'react';
import { useStore } from '@/store/store';
import { useWorldProjection } from '../useWorldProjection';
import { MonsterTrainerWorld } from './MonsterTrainerWorld';
import type { WorldPresentationCommand, WorldPresentationComposition, WorldPresentationIntent, WorldPresentationProjection } from '@shared/worldPresentationProtocol';
import { createIdentityResolver } from '../identityResolver';
import { deriveVisualTransitions, type CanonicalWorldSnapshot } from '../worldProjection';

/**
 * The boundary between live application state and the Monster canvas: the only
 * file in this world that reads the projection hook or the agent store, so the
 * renderer below it stays a props-and-callbacks component.
 */
export function MonsterTrainerSurface({
  onReady,
  onRenderFailure,
  onDisposed,
  projection,
  composition,
  compositionSaveResult,
  onIntent
}: {
  onReady?: () => void;
  onRenderFailure?: (cause: unknown) => void;
  onDisposed?: () => void;
  projection?: WorldPresentationProjection;
  composition?: WorldPresentationComposition;
  compositionSaveResult?: Extract<WorldPresentationCommand, { type: 'update-composition' }>;
  onIntent?: (intent: WorldPresentationIntent) => void;
}) {
  if (projection) {
    return <ProjectedMonsterTrainerSurface projection={projection} composition={composition} compositionSaveResult={compositionSaveResult} onIntent={onIntent} onReady={onReady} onRenderFailure={onRenderFailure} onDisposed={onDisposed} />;
  }
  return <ConnectedMonsterTrainerSurface composition={composition} compositionSaveResult={compositionSaveResult} onIntent={onIntent} onReady={onReady} onRenderFailure={onRenderFailure} onDisposed={onDisposed} />;
}

function ConnectedMonsterTrainerSurface({ composition, compositionSaveResult, onIntent, onReady, onRenderFailure, onDisposed }: {
  composition?: WorldPresentationComposition;
  compositionSaveResult?: Extract<WorldPresentationCommand, { type: 'update-composition' }>;
  onIntent?: (intent: WorldPresentationIntent) => void;
  onReady?: () => void;
  onRenderFailure?: (cause: unknown) => void;
  onDisposed?: () => void;
}) {
  const { snapshot, transitions, identityFor } = useWorldProjection();
  const reducedMotion = useMemo(
    () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  return (
    <MonsterTrainerWorld
      snapshot={snapshot}
      transitions={transitions}
      identityFor={identityFor}
      onAgentSelect={(agentId) => useStore.getState().select(agentId)}
      onTaskOpen={(taskId) => useStore.getState().openTaskDetail(taskId)}
      reducedMotion={reducedMotion}
      composition={composition}
      compositionSaveResult={compositionSaveResult}
      onIntent={onIntent}
      onReady={onReady}
      onRenderFailure={onRenderFailure}
      onDisposed={onDisposed}
    />
  );
}

function ProjectedMonsterTrainerSurface({ projection, composition, compositionSaveResult, onIntent, onReady, onRenderFailure, onDisposed }: {
  projection: WorldPresentationProjection;
  composition?: WorldPresentationComposition;
  compositionSaveResult?: Extract<WorldPresentationCommand, { type: 'update-composition' }>;
  onIntent?: (intent: WorldPresentationIntent) => void;
  onReady?: () => void;
  onRenderFailure?: (cause: unknown) => void;
  onDisposed?: () => void;
}) {
  const previous = useRef<CanonicalWorldSnapshot | null>(null);
  const snapshot: CanonicalWorldSnapshot = projection;
  const transitions = previous.current ? deriveVisualTransitions(previous.current, snapshot) : [];
  previous.current = snapshot;
  const identityFor = useMemo(() => createIdentityResolver(projection.visualIdentities ?? {}), [projection.visualIdentities]);
  const reducedMotion = useMemo(
    () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );
  return (
    <MonsterTrainerWorld
      snapshot={snapshot}
      transitions={transitions}
      identityFor={identityFor}
      onAgentSelect={(agentId) => onIntent?.({ type: 'select-agent', agentId })}
      onTaskOpen={(taskId) => onIntent?.({ type: 'open-task', taskId })}
      reducedMotion={reducedMotion}
      composition={composition}
      compositionSaveResult={compositionSaveResult}
      onIntent={onIntent}
      onReady={onReady}
      onRenderFailure={onRenderFailure}
      onDisposed={onDisposed}
    />
  );
}
