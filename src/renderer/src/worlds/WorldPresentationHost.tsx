import { useEffect, useRef, useState } from 'react';
import { isWorldPresentationCommand, type WorldPresentationCommand, type WorldPresentationComposition, type WorldPresentationProjection, type WorldPresentationStatus } from '@shared/worldPresentationProtocol';
import { WorldSceneHost } from './WorldHost';

interface Session {
  profileId: 'office' | 'monster-trainer';
  generation: number;
  projection: WorldPresentationProjection;
  composition?: WorldPresentationComposition;
  compositionSaveResult?: Extract<WorldPresentationCommand, { type: 'update-composition' }>;
}

/** Child-renderer root. It receives only typed presentation commands/projection. */
export function WorldPresentationHost() {
  const [session, setSession] = useState<Session | null>(null);
  const currentGeneration = useRef(0);

  useEffect(() => window.worldPresentation.onCommand((command) => {
    if (!isWorldPresentationCommand(command)) return;
    if (command.type === 'bootstrap') {
      if (command.generation <= currentGeneration.current) return;
      currentGeneration.current = command.generation;
      setSession({ profileId: command.profileId, generation: command.generation, projection: command.projection, composition: command.composition });
      return;
    }
    if (command.type === 'update-projection') {
      if (command.generation !== currentGeneration.current) return;
      setSession((current) => current?.profileId === command.profileId && current.generation === command.generation
        ? { ...current, projection: command.projection }
        : current);
      return;
    }
    if (command.type === 'update-composition') {
      if (command.generation !== currentGeneration.current) return;
      setSession((current) => current?.profileId === command.profileId && current.generation === command.generation
        ? {
            ...current,
            ...(command.saveStatus === 'accepted' && command.layout ? { composition: { layout: command.layout, source: 'saved' } } : {}),
            compositionSaveResult: command
          }
        : current);
      return;
    }
    if (command.type === 'dispose') {
      if (command.generation < currentGeneration.current) return;
      currentGeneration.current = command.generation;
      setSession(null);
    }
    // A restart command is informational; the supervisor creates a new WebContents
    // and sends a fresh bootstrap with a newer generation.
  }), []);

  if (!session) {
    return <div aria-live="polite" style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#fff8e7', font: '12px monospace' }}>Waiting for world bootstrap…</div>;
  }

  const report = (status: WorldPresentationStatus): void => {
    const event = statusToEvent(status);
    if (event && status.generation === currentGeneration.current) window.worldPresentation.emit(event);
  };
  return (
    <WorldSceneHost
      presentation={{ ...session, onIntent: (intent) => window.worldPresentation.emit({
        type: 'intent', profileId: session.profileId, generation: session.generation, intent
      }) }}
      onPresentationState={report}
    />
  );
}

function statusToEvent(status: WorldPresentationStatus) {
  if (status.phase === 'READY' && status.profileId) return { type: 'ready' as const, profileId: status.profileId, generation: status.generation };
  if (status.phase === 'RECOVERY' && status.profileId && status.error) return { type: 'failed' as const, profileId: status.profileId, generation: status.generation, error: status.error };
  if ((status.phase === 'VALIDATING' || status.phase === 'BOOTSTRAPPING' || status.phase === 'MOUNTING') && status.profileId) {
    return { type: 'phase' as const, profileId: status.profileId, generation: status.generation, phase: status.phase };
  }
  return null;
}
