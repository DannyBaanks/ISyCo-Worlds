import { useEffect, useState } from 'react';
import type { WorldHelperSafeSnapshot } from '@shared/worldHelper';
import { WorldHelperSurface } from '@/components/WorldHelperSurface';

export function WorldHelperOverlay() {
  const bridge = window.gusOverlay;
  const [snapshot, setSnapshot] = useState<WorldHelperSafeSnapshot | null>(null);

  useEffect(() => {
    if (!bridge) return;
    let cancelled = false;
    const unsubscribe = bridge.onState((next) => setSnapshot(next));
    void bridge.snapshot().then((next) => {
      if (!cancelled) setSnapshot(next);
    }).catch(() => { /* overlay can recover by being hidden and reopened */ });
    return () => { cancelled = true; unsubscribe(); };
  }, [bridge]);

  if (!bridge) return <p style={{ padding: 12, background: '#fffbea' }}>GUS overlay bridge unavailable.</p>;
  if (!snapshot) return <div style={{ padding: 16, background: '#fffbea', color: '#26152b' }}>Loading GUS…</div>;

  return (
    <WorldHelperSurface
      bridge={bridge}
      snapshot={snapshot}
      setupRequired={!snapshot.onboardingComplete && !snapshot.setupDismissed}
      onSnapshot={setSnapshot}
      onHide={() => { void bridge.hide(); }}
    />
  );
}
