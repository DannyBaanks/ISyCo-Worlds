import { useEffect, useRef, useState } from 'react';
import type { WorldHelperProviderId, WorldHelperProviderMetadata, WorldHelperSafeSnapshot } from '@shared/worldHelper';
import type { WorldHelperStreamEvent } from '@shared/worldHelper';

type HelperBridge = NonNullable<Window['gusOverlay']>;

const COLORS = {
  ink: '#26152b', cream: '#fffbea', creamDark: '#f4edc9', purple: '#9b70c5', lemon: '#efd02c', muted: '#776d7c', red: '#9b333e'
};

function explainError(category?: string): string {
  switch (category) {
    case 'invalid-key': return 'That API key was not accepted. Check it or replace it.';
    case 'offline': return 'The provider is offline or unreachable. Munder and your workers are still running.';
    case 'quota': return 'The provider reported a limit or quota. Munder and your workers are still running.';
    case 'invalid-response': case 'invalid-proposal': return 'The provider returned a response GUS could not safely use. No action was taken.';
    case 'unavailable-provider': return 'That worker engine is not currently installed. No worker was launched.';
    case 'unavailable-role': return 'That role does not exist in the current workforce. No worker was launched.';
    case 'workspace-unavailable': return 'There is no available workspace in the current Munder configuration.';
    case 'workspace-changed': return 'The selected workspace changed after this proposal. Ask GUS for an updated proposal before launching.';
    case 'launch-failed': return 'A worker could not be started. Any workers that did start remain under Munder control.';
    default: return 'World Helper could not complete that request. No unapproved action was taken.';
  }
}

export function WorldHelperSurface({ snapshot, setupRequired, onSnapshot, bridge, onHide }: {
  snapshot: WorldHelperSafeSnapshot;
  setupRequired: boolean;
  onSnapshot: (snapshot: WorldHelperSafeSnapshot) => void;
  bridge: HelperBridge;
  onHide: () => void;
}) {
  const [providers, setProviders] = useState<WorldHelperProviderMetadata[]>([]);
  const [provider, setProvider] = useState<WorldHelperProviderId>('nvidia-nim');
  const [model, setModel] = useState('nvidia/nemotron-3-nano-omni-30b-a3b-reasoning');
  const [apiKey, setApiKey] = useState('');
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');
  const [streamDraft, setStreamDraft] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(setupRequired);
  const [showSetup, setShowSetup] = useState(setupRequired);
  const [error, setError] = useState('');
  const streamRequestId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void bridge.providers().then((list) => {
      if (cancelled) return;
      setProviders(list);
      const initial = list.find((item) => item.id === snapshot.provider) ?? list[0];
      if (initial) { setProvider(initial.id); setModel(snapshot.model ?? initial.models[0]?.id ?? ''); }
    }).catch(() => setError('Could not load the provider list.'));
    return () => { cancelled = true; };
  }, [bridge]);

  useEffect(() => bridge.onStream((event: WorldHelperStreamEvent) => {
    if (event.type === 'delta') {
      if (streamRequestId.current && streamRequestId.current !== event.requestId) return;
      streamRequestId.current = event.requestId;
      setStreamDraft((current) => current + event.text);
      return;
    }
    if (streamRequestId.current && streamRequestId.current !== event.requestId) return;
    streamRequestId.current = event.requestId;
    if (event.type === 'failed') {
      setStreamDraft('');
      setError(explainError(event.category));
    }
  }), [bridge]);

  useEffect(() => {
    setShowSetup(setupRequired);
    setExpanded((wasExpanded) => setupRequired || wasExpanded);
    if (snapshot.pendingProposal) setSelected(snapshot.pendingProposal.workers.map((worker) => worker.name));
  }, [setupRequired, snapshot.pendingProposal?.id]);

  const activeProvider = providers.find((item) => item.id === provider);
  const updateProvider = (next: WorldHelperProviderId): void => {
    const item = providers.find((candidate) => candidate.id === next);
    setProvider(next);
    setModel(item?.models[0]?.id ?? '');
  };

  const dismissSetup = async (): Promise<void> => {
    await bridge.dismissSetup();
    setShowSetup(false);
    setExpanded(false);
    setError('');
    const next = await bridge.snapshot();
    onSnapshot(next);
    onHide();
  };

  const configure = async (): Promise<boolean> => {
    setBusy(true); setError('');
    try {
      const result = await bridge.configure({ provider, model, ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}) });
      if (!result.ok) { setError(explainError(result.category)); return false; }
      setApiKey('');
      setShowSetup(false);
      setExpanded(true);
      onSnapshot(await bridge.snapshot());
      return true;
    } catch { setError('The helper could not reach its local host. Restart the helper and try again.'); return false; }
    finally { setBusy(false); }
  };

  const send = async (): Promise<void> => {
    if (!message.trim()) return;
    streamRequestId.current = null;
    setBusy(true); setError(''); setReply(''); setStreamDraft('');
    try {
      const result = await bridge.chat(message);
      if (!result.ok) { setStreamDraft(''); setError(explainError(result.category)); return; }
      setMessage('');
      setStreamDraft('');
      setSelected(result.proposal?.workers.map((worker) => worker.name) ?? []);
      onSnapshot(await bridge.snapshot());
    } catch { setError('World Helper is offline. Your workers are still running.'); }
    finally { setBusy(false); }
  };

  const approve = async (): Promise<void> => {
    const proposal = snapshot.pendingProposal;
    if (!proposal || selected.length === 0) return;
    setBusy(true); setError('');
    try {
      const result = await bridge.approve(proposal.id, selected);
      if (!result.ok) { setError(explainError(result.category)); return; }
      setReply(`Launched ${result.launched?.length ?? selected.length} approved worker${(result.launched?.length ?? selected.length) === 1 ? '' : 's'} through Munder.`);
      setSelected([]);
      onSnapshot(await bridge.snapshot());
    } catch { setError('The team could not be launched. No further action was taken.'); }
    finally { setBusy(false); }
  };

  const stop = async (): Promise<void> => {
    const confirmed = window.confirm('Stop World Helper? GUS will stop monitoring and explaining your World. Your workers do NOT automatically stop. Munder/Core continue running, and you can start GUS again later.');
    if (!confirmed) return;
    await bridge.stop();
    setExpanded(false);
    setShowSetup(false);
    onSnapshot(await bridge.snapshot());
  };

  const frame: React.CSSProperties = {
    background: COLORS.cream, color: COLORS.ink, border: `2px solid ${COLORS.ink}`,
    boxShadow: `5px 5px 0 ${COLORS.purple}`, fontFamily: 'var(--cth-font-ui)',
  };
  const button: React.CSSProperties = {
    background: COLORS.creamDark, border: `1px solid ${COLORS.purple}`, color: COLORS.ink,
    padding: '7px 10px', cursor: 'pointer', fontFamily: 'var(--cth-font-ui)', fontSize: 12
  };

  if (setupRequired || showSetup) {
    return (
      <div style={{ position: 'fixed', zIndex: 1500, inset: 0, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(38,21,43,.45)' }}>
        <section aria-label="Configure World Helper" style={{ ...frame, width: 'min(500px, 96vw)', maxHeight: '90vh', overflow: 'auto', padding: 24 }}>
          <div style={{ color: COLORS.purple, fontSize: 11, letterSpacing: 2 }}>OPTIONAL · WORLD HELPER</div>
          <h1 style={{ fontFamily: 'var(--cth-font-display)', fontSize: 22, margin: '8px 0' }}>Configure GUS</h1>
          <p style={{ color: COLORS.muted, lineHeight: 1.5, fontSize: 13 }}>
            GUS helps configure your workers, roles and world, watches their progress, and explains what is happening. It uses an external provider you choose. The API key belongs only to GUS; workers do not inherit it. GUS has no implicit admin authority.
          </p>
          <label style={{ display: 'grid', gap: 5, marginTop: 16, fontSize: 12 }}>Provider
            <select value={provider} onChange={(event) => updateProvider(event.target.value as WorldHelperProviderId)} style={{ padding: 8, border: `1px solid ${COLORS.purple}`, background: 'white' }}>
              {providers.map((item) => <option key={item.id} value={item.id}>{item.displayName}{item.recommended ? ' · Recommended' : ''}</option>)}
            </select>
          </label>
          {activeProvider?.availabilityNote && <p style={{ margin: '5px 0', color: COLORS.muted, fontSize: 11 }}>{activeProvider.availabilityNote}</p>}
          <label style={{ display: 'grid', gap: 5, marginTop: 12, fontSize: 12 }}>Model
            <select value={model} onChange={(event) => setModel(event.target.value)} style={{ padding: 8, border: `1px solid ${COLORS.purple}`, background: 'white' }}>
              {activeProvider?.models.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 5, marginTop: 12, fontSize: 12 }}>API key
            <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={snapshot.configured && snapshot.provider === provider ? 'Leave blank to keep saved key · or paste replacement' : 'Paste key · stored encrypted on this device'} autoComplete="new-password" style={{ padding: 9, border: `1px solid ${COLORS.purple}`, background: 'white' }} />
          </label>
          <button type="button" style={{ ...button, marginTop: 7, fontSize: 11 }} onClick={() => activeProvider && void bridge.openProviderHelp(activeProvider.id)}>Get API key ↗</button>
          <label style={{ display: 'grid', gap: 5, marginTop: 14, fontSize: 12 }}>How do you want to use this World?
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} placeholder="For example: maintain a repo, investigate bugs and prepare PRs." style={{ padding: 9, resize: 'vertical', border: `1px solid ${COLORS.purple}`, background: 'white' }} />
          </label>
          {error && <p role="alert" style={{ color: COLORS.red, fontSize: 12 }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 16 }}>
            <button type="button" style={button} onClick={() => void dismissSetup()}>Skip for now</button>
            <div style={{ display: 'flex', gap: 8 }}>
              {snapshot.configured && snapshot.provider === provider && <button type="button" style={{ ...button, color: COLORS.red, fontSize: 11 }} disabled={busy} onClick={() => void (async () => { await bridge.removeKey(); onSnapshot(await bridge.snapshot()); setError('Saved key removed. GUS is stopped; your workers continue running.'); })()}>Remove key</button>}
              <button type="button" style={button} disabled={busy} onClick={() => void configure()}>{busy ? 'Connecting…' : 'Verify & continue'}</button>
              <button type="button" style={{ ...button, background: COLORS.lemon }} disabled={busy || !message.trim()} onClick={() => { void (async () => { if (await configure()) { setExpanded(true); await send(); } })(); }}>Connect & ask GUS</button>
            </div>
          </div>
          {reply && <p style={{ fontSize: 12 }}>{reply}</p>}
        </section>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', zIndex: 1300, right: 16, bottom: 16 }}>
      {expanded && (
        <section aria-label="GUS World Helper" style={{ ...frame, width: 'min(360px, calc(100vw - 32px))', height: 430, display: 'flex', flexDirection: 'column', marginBottom: 10 }}>
          <header style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderBottom: `1px solid ${COLORS.purple}`, background: COLORS.creamDark }}>
            <span aria-hidden="true">✦</span><strong style={{ flex: 1 }}>GUS · World Helper</strong>
            <span style={{ color: COLORS.muted, fontSize: 10 }}>{snapshot.lifecycle.toLowerCase()}</span>
            <button type="button" aria-label="Minimize GUS" style={{ ...button, padding: '3px 7px' }} onClick={() => setExpanded(false)}>−</button>
            <button type="button" aria-label="Hide GUS overlay" style={{ ...button, padding: '3px 7px' }} onClick={onHide}>×</button>
          </header>
          {snapshot.lifecycle === 'STOPPED' || !snapshot.enabled ? (
            <div style={{ padding: 14 }}>
              <p style={{ fontSize: 12, color: COLORS.muted }}>GUS is stopped. Your workers continue running under Munder.</p>
              <button type="button" style={button} onClick={() => { setShowSetup(true); setExpanded(false); }}>Start / configure</button>
              <button type="button" style={{ ...button, marginLeft: 8 }} onClick={() => void (async () => { await bridge.remove(); onSnapshot(await bridge.snapshot()); })()}>Remove GUS</button>
            </div>
          ) : (
            <>
              <div style={{ flex: 1, overflow: 'auto', padding: 11, fontSize: 12 }}>
                {snapshot.transcript?.map((item, index) => <p key={`${item.at}-${index}`} style={{ margin: '7px 0', whiteSpace: 'pre-wrap' }}><b>{item.role === 'user' ? 'You' : 'GUS'}:</b> {item.text}</p>)}
                {streamDraft && <p className="world-helper-stream" aria-live="polite" style={{ color: COLORS.muted, whiteSpace: 'pre-wrap' }}>{streamDraft}<span className="world-helper-caret" aria-hidden="true">▍</span></p>}
                {reply && <p style={{ color: COLORS.muted }}>{reply}</p>}
                {snapshot.pendingProposal && <div style={{ borderTop: `1px solid ${COLORS.purple}`, marginTop: 10, paddingTop: 8 }}>
                  <strong>Proposed team · review before launch</strong>
                  {snapshot.pendingProposal.workspace && <p style={{ margin: '8px 0', color: COLORS.muted, overflowWrap: 'anywhere' }}>Launch target (bound to this approval): <b>{snapshot.pendingProposal.workspace}</b></p>}
                  {snapshot.pendingProposal.worldSuggestion && <p style={{ margin: '8px 0', color: COLORS.muted }}>World suggestion: <b>{snapshot.pendingProposal.worldSuggestion === 'monster-trainer' ? 'Monster Trainer' : 'Office'}</b> · advisory only; select the world yourself from Worlds.</p>}
                  {snapshot.pendingProposal.workers.map((worker) => <label key={`${worker.name}-${worker.role}`} style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: 5, marginTop: 9 }}>
                    <input type="checkbox" checked={selected.includes(worker.name)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, worker.name] : current.filter((name) => name !== worker.name))} />
                    <span><b>{worker.name}</b> · {worker.role}<br /><span style={{ color: COLORS.muted }}>{worker.purpose} · {worker.provider}</span></span>
                  </label>)}
                  <button type="button" style={{ ...button, marginTop: 10, background: COLORS.lemon }} disabled={busy || !selected.length} onClick={() => void approve()}>Launch approved team</button>
                </div>}
                {snapshot.notices.slice(-4).map((notice) => <p key={notice.id} style={{ borderLeft: `3px solid ${notice.severity === 'requires_action' ? COLORS.lemon : COLORS.purple}`, paddingLeft: 7 }}>{notice.title}</p>)}
              </div>
              {error && <div role="alert" style={{ color: COLORS.red, fontSize: 11, padding: '0 10px 5px' }}>{error}</div>}
              <form onSubmit={(event) => { event.preventDefault(); void send(); }} style={{ display: 'flex', gap: 6, padding: 8, borderTop: `1px solid ${COLORS.purple}` }}>
                <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="How do you want to use this World?" style={{ flex: 1, minWidth: 0, padding: 7, border: `1px solid ${COLORS.purple}` }} />
                {busy && <button type="button" onClick={() => { void bridge.cancel(streamRequestId.current ?? undefined); }} style={button}>Stop</button>}
                <button type="submit" disabled={busy || !message.trim()} style={button}>Send</button>
              </form>
              <footer style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px 8px' }}>
                <button type="button" style={{ ...button, fontSize: 10 }} onClick={() => { setShowSetup(true); setError(''); }}>Provider settings</button>
                <button type="button" style={{ ...button, fontSize: 10 }} onClick={() => void stop()}>Stop Helper</button>
              </footer>
            </>
          )}
        </section>
      )}
      <button type="button" aria-label={expanded ? 'Minimize GUS' : 'Open GUS World Helper'} onClick={() => setExpanded((value) => !value)} style={{ ...frame, width: 56, height: 48, cursor: 'pointer', fontSize: 18, borderRadius: 8 }}>
        ✦{snapshot.notices.some((notice) => notice.severity === 'requires_action') ? <span style={{ color: COLORS.red }}>●</span> : null}
      </button>
    </div>
  );
}
