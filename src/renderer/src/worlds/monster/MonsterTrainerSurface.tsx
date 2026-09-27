import { useMemo } from 'react';
import { useStore } from '@/store/store';
import { useWorldProjection } from '../useWorldProjection';
import { MonsterTrainerWorld } from './MonsterTrainerWorld';

/**
 * The boundary between live application state and the Monster canvas: the only
 * file in this world that reads the projection hook or the agent store, so the
 * renderer below it stays a props-and-callbacks component.
 */
export function MonsterTrainerSurface({
  onReady,
  onRenderFailure,
  onDisposed
}: {
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
      onReady={onReady}
      onRenderFailure={onRenderFailure}
      onDisposed={onDisposed}
    />
  );
}
