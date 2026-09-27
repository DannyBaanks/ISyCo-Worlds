import { useEffect, useMemo, useRef, useState } from 'react';
import { Application, Container } from 'pixi.js';
import 'pixi.js/unsafe-eval';
import type { IdentityForAgent } from '../identityResolver';
import type { CanonicalWorldSnapshot, VisualTransition, WorldAgent, WorldTask } from '../worldProjection';
import { buildStarterVillageScene, STARTER_VILLAGE_HEIGHT, STARTER_VILLAGE_WIDTH } from './StarterVillageScene';
import { integerScaleForViewport, STARTER_VILLAGE_ASSET_CATALOG, STARTER_VILLAGE_COMPOSITION_DEFINITION, STARTER_VILLAGE_PRESET } from './StarterVillageScenario';
import { applyCompositionCommand, undoComposition, validateComposition, type CompositionCommand, type CompositionEditorState } from '@shared/worldComposition';
import type { WorldPresentationCommand, WorldPresentationComposition, WorldPresentationIntent } from '@shared/worldPresentationProtocol';
import { FreeBuildToolbar } from '../composition/FreeBuildToolbar';
import { acquireWorldRendererLease, disposeWorldRendererOnce } from '../pixiOwnership';

export interface MonsterTrainerWorldProps { snapshot: CanonicalWorldSnapshot; transitions: readonly VisualTransition[]; identityFor: IdentityForAgent; onAgentSelect: (agentId: string) => void; onTaskOpen: (taskId: string) => void; reducedMotion: boolean; composition?: WorldPresentationComposition; compositionSaveResult?: Extract<WorldPresentationCommand, { type: 'update-composition' }>; onIntent?: (intent: WorldPresentationIntent) => void; onReady?: () => void; onRenderFailure?: (cause: unknown) => void; onDisposed?: () => void; }
interface Ctx { agents: readonly WorldAgent[]; tasks: readonly WorldTask[]; identityFor: IdentityForAgent; onAgentSelect: (agentId: string) => void; onTaskOpen: (taskId: string) => void; layout: CompositionEditorState['present']; selectedPlacementId: string | null; buildMode: boolean; onPlacementSelect: (placementId: string) => void; }

export function MonsterTrainerWorld(props: MonsterTrainerWorldProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null); const hostRef = useRef<HTMLDivElement | null>(null); const ctxRef = useRef<Ctx | null>(null); const [scale, setScale] = useState<1 | 2 | 3 | 4>(1);
  const initialLayout = props.composition?.layout ?? STARTER_VILLAGE_PRESET;
  const [editor, setEditor] = useState<CompositionEditorState>(() => ({ present: validateComposition(initialLayout, STARTER_VILLAGE_COMPOSITION_DEFINITION).ok ? initialLayout : STARTER_VILLAGE_PRESET, past: [] }));
  const [mode, setMode] = useState<'explore' | 'build'>('explore');
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState(props.composition?.source === 'invalid-fallback' ? 'Saved layout was invalid; showing Starter Village preset without overwriting it.' : '');
  const [pendingSave, setPendingSave] = useState<string | null>(null);
  const savedLayoutRef = useRef<CompositionEditorState['present']>(initialLayout);
  const catalog = useMemo(() => Object.values(STARTER_VILLAGE_ASSET_CATALOG).map((item) => ({
    id: item.id, label: item.label, kind: item.kind,
    removable: STARTER_VILLAGE_COMPOSITION_DEFINITION.objects[item.id]?.removable ?? false
  })), []);
  const activeAgents = props.snapshot.agents.filter((agent) => !agent.archived).slice(0, 2); const activeIds = activeAgents.map((agent) => agent.id).join('|');
  useEffect(() => { const viewport = viewportRef.current; if (!viewport || typeof ResizeObserver === 'undefined') return; const observer = new ResizeObserver(([entry]) => { const next = integerScaleForViewport(entry.contentRect.width, entry.contentRect.height); setScale((current) => current === next ? current : next); }); observer.observe(viewport); return () => observer.disconnect(); }, []);
  useEffect(() => {
    const host = hostRef.current; if (!host) return; const app = new Application(); let ticker: (() => void) | null = null; let alive = true; let initSettled = false; let disposedReported = false; let failed = false; let releaseLease: (() => boolean) | undefined;
    const release = () => disposeWorldRendererOnce(app, () => {
      try { if (ticker) app.ticker.remove(ticker); } catch { /* partial Pixi init */ }
      try { app.ticker?.stop(); } catch { /* partial Pixi init */ }
      try { app.destroy(true); } catch { /* partial Pixi init */ }
    });
    const finalizeDisposal = () => {
      if (disposedReported) return;
      disposedReported = true;
      release();
      releaseLease?.();
      props.onDisposed?.();
    };
    function reportFailure(cause: unknown): void { if (failed) return; failed = true; if (ticker) app.ticker.remove(ticker); props.onRenderFailure?.(cause); }
    void (async () => { try {
      releaseLease = await acquireWorldRendererLease();
      if (!alive) return;
      await app.init({ background: 0x132532, width: STARTER_VILLAGE_WIDTH * scale, height: STARTER_VILLAGE_HEIGHT * scale, antialias: false, roundPixels: true, resolution: 1, autoDensity: true, preference: 'webgl' });
      if (!alive) return; host.appendChild(app.canvas);
      const render = () => { const ctx = ctxRef.current; if (!ctx) return; const scene: Container = buildStarterVillageScene({ ...ctx, composition: ctx.layout }); scene.scale.set(scale); app.stage.removeChildren().forEach((child) => child.destroy({ children: true })); app.stage.addChild(scene); };
      render(); app.renderer.render(app.stage); props.onReady?.(); let signature = '';
      ticker = () => { try { const ctx = ctxRef.current; if (!ctx || failed) return; const next = JSON.stringify([ctx.agents.map((agent) => [agent.id, agent.state]), ctx.tasks.map((task) => [task.id, task.assignee, task.awaitsHuman]), ctx.layout, ctx.selectedPlacementId, ctx.buildMode]); if (next !== signature) { signature = next; render(); } } catch (cause) { reportFailure(cause); } };
      app.ticker.add(ticker);
    } catch (cause) { release(); if (!alive) return; reportFailure(cause); }
    finally { initSettled = true; if (!alive) finalizeDisposal(); } })();
    return () => { alive = false; if (initSettled) finalizeDisposal(); };
  }, [activeIds, scale]);
  useEffect(() => { ctxRef.current = { agents: activeAgents, tasks: props.snapshot.tasks, identityFor: props.identityFor, onAgentSelect: props.onAgentSelect, onTaskOpen: props.onTaskOpen, layout: editor.present, selectedPlacementId, buildMode: mode === 'build', onPlacementSelect: setSelectedPlacementId }; });
  useEffect(() => {
    const result = props.compositionSaveResult;
    if (!result || result.requestId !== pendingSave) return;
    if (result.saveStatus === 'accepted' && result.layout && validateComposition(result.layout, STARTER_VILLAGE_COMPOSITION_DEFINITION).ok) {
      savedLayoutRef.current = result.layout;
      setEditor({ present: result.layout, past: [] });
      setFeedback('Village layout saved.');
    } else setFeedback('Save failed. The last saved village remains unchanged; your valid draft is still available.');
    setPendingSave(null);
  }, [props.compositionSaveResult, pendingSave]);

  const edit = (command: CompositionCommand): void => {
    const next = applyCompositionCommand(editor, command, STARTER_VILLAGE_COMPOSITION_DEFINITION);
    if (!next.ok) { setFeedback(`Edit rejected: ${next.error.replaceAll('-', ' ')}.`); return; }
    setEditor(next.state);
    setFeedback('');
  };
  const save = (): void => {
    if (!props.onIntent) { setFeedback('Saving is available from the hosted Monster Trainer world.'); return; }
    const requestId = `composition-${Date.now().toString(36)}`;
    setPendingSave(requestId);
    setFeedback('Saving village layout…');
    props.onIntent({ type: 'save-composition', requestId, layout: editor.present });
  };

  return <div ref={viewportRef} style={{ position: 'absolute', inset: 0, overflow: 'auto', background: '#132532' }}>
    <div ref={hostRef} style={{ width: STARTER_VILLAGE_WIDTH * scale, height: STARTER_VILLAGE_HEIGHT * scale, imageRendering: 'pixelated' }} />
    <FreeBuildToolbar
      catalog={catalog}
      terrainIds={STARTER_VILLAGE_COMPOSITION_DEFINITION.terrainIds}
      layout={editor.present}
      mode={mode}
      onModeChange={setMode}
      onCommand={edit}
      onSelectPlacement={setSelectedPlacementId}
      onUndo={() => { setEditor(undoComposition(editor)); setFeedback(''); }}
      onCancel={() => { setEditor({ present: savedLayoutRef.current, past: [] }); setFeedback('Unsaved edits cancelled.'); }}
      onSave={save}
      onReset={() => { setEditor({ present: STARTER_VILLAGE_PRESET, past: [] }); setSelectedPlacementId('lab-nw'); setFeedback('Starter Village preset restored in this draft. Save to persist it.'); }}
      feedback={feedback}
    />
  </div>;
}
