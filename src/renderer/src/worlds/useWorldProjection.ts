import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { VisualIdentityProfileV1 } from '@shared/worldProfiles';
import { useStore } from '@/store/store';
import { createIdentityResolver } from './identityResolver';
import {
  deriveVisualTransitions,
  normalizeWorldSnapshot,
  type CanonicalWorldSnapshot,
  type VisualTransition
} from './worldProjection';

export interface WorldProjectionState {
  snapshot: CanonicalWorldSnapshot;
  transitions: readonly VisualTransition[];
  identityFor: ReturnType<typeof createIdentityResolver>;
  visualIdentities: Record<string, VisualIdentityProfileV1>;
}

/**
 * The only renderer layer that observes runtime state for non-Office worlds.
 * It is read-only: agent data comes from Zustand and task/profile data crosses
 * the existing preload bridge. Worlds receive this result as props instead.
 */
export function useWorldProjection(): WorldProjectionState {
  const agents = useStore((state) => state.agents);
  const archivedAgents = useStore((state) => state.archivedAgents);
  const [rawTasks, setRawTasks] = useState<unknown>([]);
  const [profiles, setProfiles] = useState<Record<string, VisualIdentityProfileV1>>({});
  const [transitions, setTransitions] = useState<readonly VisualTransition[]>([]);
  const previousSnapshot = useRef<CanonicalWorldSnapshot | null>(null);

  const refreshTasks = useCallback(async () => {
    try {
      const raw = await window.cth.hiveTasks() as { tasks?: unknown } | unknown;
      // The ledger IPC wraps the array in { tasks: [...] }; tolerate a bare
      // array too so the projection never hard-couples to one payload shape.
      const nextTasks = Array.isArray(raw) ? raw
        : (raw && typeof raw === 'object' ? (raw as { tasks?: unknown }).tasks : undefined);
      // A failed/malformed task read must leave the last successful task list
      // visible rather than flashing an empty world.
      if (Array.isArray(nextTasks)) setRawTasks(nextTasks);
    } catch {
      // Retain the last successful projection.
    }
  }, []);

  useEffect(() => {
    let active = true;
    void window.cth.worldProfiles()
      .then((nextProfiles) => {
        if (active) setProfiles(nextProfiles);
      })
      .catch(() => {
        // Defaults remain deterministic if the optional identity store is unreadable.
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    void refreshTasks();
    const tasksInterval = window.setInterval(refreshTasks, 5_000);
    return () => window.clearInterval(tasksInterval);
  }, [refreshTasks]);

  const agentsForProjection = useMemo(
    () => [...agents, ...archivedAgents],
    [agents, archivedAgents]
  );
  const snapshot = useMemo(
    () => normalizeWorldSnapshot(agentsForProjection, rawTasks),
    [agentsForProjection, rawTasks]
  );
  const identityFor = useMemo(() => createIdentityResolver(profiles), [profiles]);

  useEffect(() => {
    const previous = previousSnapshot.current;
    setTransitions(previous ? deriveVisualTransitions(previous, snapshot) : []);
    previousSnapshot.current = snapshot;
  }, [snapshot]);

  return { snapshot, transitions, identityFor, visualIdentities: profiles };
}
