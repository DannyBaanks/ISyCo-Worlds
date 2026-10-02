import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Application, Ticker } from 'pixi.js';
import 'pixi.js/unsafe-eval';
import type { IdentityForAgent } from '../identityResolver';
import type { CanonicalWorldSnapshot, VisualTransition, WorldAgent, WorldTask } from '../worldProjection';
import { buildStarterVillageScene } from './StarterVillageScene';
import { displayScaleForViewport, upgradeStarterVillageLayout, STARTER_VILLAGE_ASSET_CATALOG, STARTER_VILLAGE_COLUMNS, STARTER_VILLAGE_COMPOSITION_DEFINITION, STARTER_VILLAGE_PRESET, STARTER_VILLAGE_ROWS, STARTER_VILLAGE_TILE_SIZE } from './StarterVillageScenario';
import { applyCompositionCommand, compositionSpan, placementFits, topPlacementAt, undoComposition, validateComposition, type CompositionCommand, type CompositionEditorState, type WorldCompositionV1 } from '@shared/worldComposition';
import type { WorldPresentationCommand, WorldPresentationComposition, WorldPresentationIntent } from '@shared/worldPresentationProtocol';
import { FreeBuildToolbar, moveCommand, paintCommand, placeCommand, type BuildTool } from '../composition/FreeBuildToolbar';
import { acquireWorldRendererLease, disposeWorldRendererOnce } from '../pixiOwnership';
import { MonsterWorkerMotion } from './monsterMovement';
import type { EvolutionStage } from './monsterArt';
import { advanceLocationReaction, deriveLocationReactionBursts, type LocationReactionBurst } from './locationReactions';

export interface MonsterTrainerWorldProps { snapshot: CanonicalWorldSnapshot; transitions: readonly VisualTransition[]; identityFor: IdentityForAgent; growthStageForAgent?: (agentId: string) => EvolutionStage; onAgentSelect: (agentId: string) => void; onTaskOpen: (taskId: string) => void; reducedMotion: boolean; composition?: WorldPresentationComposition; compositionSaveResult?: Extract<WorldPresentationCommand, { type: 'update-composition' }>; onIntent?: (intent: WorldPresentationIntent) => void; onReady?: () => void; onRenderFailure?: (cause: unknown) => void; onDisposed?: () => void; }
interface Ctx { agents: readonly WorldAgent[]; tasks: readonly WorldTask[]; transitions: readonly VisualTransition[]; identityFor: IdentityForAgent; growthStageForAgent?: (agentId: string) => EvolutionStage; onAgentSelect: (agentId: string) => void; onTaskOpen: (taskId: string) => void; layout: CompositionEditorState['present']; selectedPlacementId: string | null; buildMode: boolean; onPlacementSelect: (placementId: string) => void; }
interface CityPan { x: number; y: number; }
type CityDrag =
  | { kind: 'pan'; pointerId: number; originX: number; originY: number; panX: number; panY: number; immediate: boolean }
  | { kind: 'paint'; pointerId: number; terrainId: string | null; lastX: number; lastY: number }
  | { kind: 'move'; pointerId: number; placementId: string; x: number; y: number; offsetX: number; offsetY: number };

function clampCityPan(pan: CityPan, hostW: number, hostH: number, viewW: number, viewH: number): CityPan {
  if (hostW <= viewW + 0.5 && hostH <= viewH + 0.5) return { x: 0, y: 0 };
  const maxX = Math.max(0, (hostW - viewW) / 2);
  const maxY = Math.max(0, (hostH - viewH) / 2);
  return { x: Math.min(maxX, Math.max(-maxX, pan.x)), y: Math.min(maxY, Math.max(-maxY, pan.y)) };
}

function tileFromPointer(event: { clientX: number; clientY: number }, host: HTMLElement, columns: number, rows: number): { x: number; y: number } | null {
  const rect = host.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * columns);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * rows);
  if (x < 0 || y < 0 || x >= columns || y >= rows) return null;
  return { x, y };
}

export function MonsterTrainerWorld(props: MonsterTrainerWorldProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null); const hostRef = useRef<HTMLDivElement | null>(null); const ctxRef = useRef<Ctx | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [zoomMultiplier, setZoomMultiplier] = useState(1);
  const [pan, setPan] = useState<CityPan>({ x: 0, y: 0 });
  const initialLayout = upgradeStarterVillageLayout(props.composition?.layout ?? STARTER_VILLAGE_PRESET);
  const [editor, setEditor] = useState<CompositionEditorState>(() => ({ present: validateComposition(initialLayout, STARTER_VILLAGE_COMPOSITION_DEFINITION).ok ? initialLayout : STARTER_VILLAGE_PRESET, past: [] }));
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const [mode, setMode] = useState<'explore' | 'build'>('explore');
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const [tool, setTool] = useState<BuildTool>({ kind: 'place', definitionId: Object.keys(STARTER_VILLAGE_ASSET_CATALOG)[0] ?? 'tree' });
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [moveGhost, setMoveGhost] = useState<{ id: string; x: number; y: number } | null>(null);
  const [feedback, setFeedback] = useState(props.composition?.source === 'invalid-fallback' ? 'Saved layout was invalid; showing Starter Village preset without overwriting it.' : '');
  const [pendingSave, setPendingSave] = useState<string | null>(null);
  const savedLayoutRef = useRef<CompositionEditorState['present']>(initialLayout);
  const dragRef = useRef<CityDrag | null>(null);
  const placeSerial = useRef(0);
  const catalog = useMemo(() => Object.values(STARTER_VILLAGE_ASSET_CATALOG).map((item) => ({
    id: item.id, label: item.label, kind: item.kind,
    removable: STARTER_VILLAGE_COMPOSITION_DEFINITION.objects[item.id]?.removable ?? false
  })), []);
  const activeAgents = props.snapshot.agents.filter((agent) => !agent.archived);
  const span = compositionSpan(editor.present, STARTER_VILLAGE_COLUMNS, STARTER_VILLAGE_ROWS);
  const mapWidth = span.columns * STARTER_VILLAGE_TILE_SIZE;
  const mapHeight = span.rows * STARTER_VILLAGE_TILE_SIZE;
  const fitScale = displayScaleForViewport(viewportSize.width, viewportSize.height, mapWidth, mapHeight);
  const zoom = fitScale * zoomMultiplier;
  const hostW = mapWidth * zoom;
  const hostH = mapHeight * zoom;
  useEffect(() => { const viewport = viewportRef.current; if (!viewport || typeof ResizeObserver === 'undefined') return; const observer = new ResizeObserver(([entry]) => { const width = entry.contentRect.width; const height = entry.contentRect.height; setViewportSize((current) => current.width === width && current.height === height ? current : { width, height }); }); observer.observe(viewport); return () => observer.disconnect(); }, []);
  useEffect(() => {
    setPan((current) => {
      const next = clampCityPan(current, hostW, hostH, viewportSize.width, viewportSize.height);
      return next.x === current.x && next.y === current.y ? current : next;
    });
  }, [hostW, hostH, viewportSize.width, viewportSize.height]);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event: WheelEvent): void => {
      if (event.target instanceof Element && event.target.closest('[data-free-build-toolbar]')) return;
      event.preventDefault();
      const direction = event.deltaY < 0 ? 1 : -1;
      setZoomMultiplier((current) => Math.min(8, Math.max(0.25, current * (direction > 0 ? 1.12 : 1 / 1.12))));
    };
    viewport.addEventListener('wheel', onWheel, { capture: true, passive: false });
    return () => viewport.removeEventListener('wheel', onWheel, true);
  }, []);
  useEffect(() => {
    const host = hostRef.current; if (!host) return; const app = new Application(); let ticker: ((ticker: Ticker) => void) | null = null; let alive = true; let initSettled = false; let disposedReported = false; let failed = false; let releaseLease: (() => boolean) | undefined;
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
      await app.init({ background: 0x1c3b2c, width: mapWidth, height: mapHeight, antialias: false, roundPixels: true, resolution: 1, autoDensity: true, preference: 'webgl' });
      if (!alive) return; host.appendChild(app.canvas);
      app.canvas.style.width = '100%';
      app.canvas.style.height = '100%';
      app.canvas.style.imageRendering = 'pixelated';
      const motion = new MonsterWorkerMotion();
      let locationReactions: LocationReactionBurst[] = [];
      let scene: ReturnType<typeof buildStarterVillageScene> | null = null;
      const render = (ctx: Ctx) => {
        const nextScene = buildStarterVillageScene({ ...ctx, composition: ctx.layout, workerMotions: motion.snapshot(), locationReactions });
        app.stage.removeChildren().forEach((child) => child.destroy({ children: true }));
        app.stage.addChild(nextScene);
        scene = nextScene;
      };
      const initialCtx = ctxRef.current;
      if (!initialCtx) throw new Error('Monster Trainer projection was unavailable during bootstrap');
      motion.updateProjection(initialCtx.agents, initialCtx.tasks, initialCtx.layout);
      render(initialCtx); app.renderer.render(app.stage); props.onReady?.();
      let signature = JSON.stringify([
        initialCtx.agents.map((agent) => [agent.id, agent.state, agent.monsterCharacter]),
        initialCtx.tasks.map((task) => [task.id, task.assignee, task.status, task.awaitsHuman]),
        initialCtx.transitions, initialCtx.layout, initialCtx.selectedPlacementId, initialCtx.buildMode,
        initialCtx.agents.map((agent) => initialCtx.growthStageForAgent?.(agent.id) ?? 'baby')
      ]);
      ticker = (tick) => { try {
        const ctx = ctxRef.current; if (!ctx || failed) return;
        const next = JSON.stringify([
          ctx.agents.map((agent) => [agent.id, agent.state, agent.monsterCharacter]),
          ctx.tasks.map((task) => [task.id, task.assignee, task.status, task.awaitsHuman]),
          ctx.transitions, ctx.layout, ctx.selectedPlacementId, ctx.buildMode,
          ctx.agents.map((agent) => ctx.growthStageForAgent?.(agent.id) ?? 'baby')
        ]);
        if (next !== signature) {
          signature = next;
          const locationsBeforeProjection = new Map(motion.snapshot().map((worker) => [worker.id, worker.destination]));
          locationReactions.push(...deriveLocationReactionBursts(ctx.transitions, ctx.tasks, locationsBeforeProjection));
          motion.updateProjection(ctx.agents, ctx.tasks, ctx.layout);
          render(ctx);
        }
        locationReactions = locationReactions.flatMap((reaction) => {
          const advanced = advanceLocationReaction(reaction, tick.deltaMS);
          return advanced ? [advanced] : [];
        });
        scene?.updateLocationReactions(locationReactions);
        scene?.updateWorkers(motion.tick(tick.deltaMS));
      } catch (cause) { reportFailure(cause); } };
      app.ticker.add(ticker);
    } catch (cause) { release(); if (!alive) return; reportFailure(cause); }
    finally { initSettled = true; if (!alive) finalizeDisposal(); } })();
    return () => { alive = false; if (initSettled) finalizeDisposal(); };
  }, [mapWidth, mapHeight]);
  useEffect(() => { ctxRef.current = { agents: activeAgents, tasks: props.snapshot.tasks, transitions: props.transitions, identityFor: props.identityFor, growthStageForAgent: props.growthStageForAgent, onAgentSelect: props.onAgentSelect, onTaskOpen: props.onTaskOpen, layout: editor.present, selectedPlacementId, buildMode: mode === 'build', onPlacementSelect: setSelectedPlacementId }; });
  useEffect(() => {
    const result = props.compositionSaveResult;
    if (!result || result.requestId !== pendingSave) return;
    if (result.saveStatus === 'accepted' && result.layout && validateComposition(result.layout, STARTER_VILLAGE_COMPOSITION_DEFINITION).ok) {
      savedLayoutRef.current = result.layout;
      editorRef.current = { present: result.layout, past: [] };
      setEditor(editorRef.current);
      setFeedback('Village layout saved.');
    } else setFeedback('Save failed. The last saved village remains unchanged; your valid draft is still available.');
    setPendingSave(null);
  }, [props.compositionSaveResult, pendingSave]);

  const edit = (command: CompositionCommand): boolean => {
    const next = applyCompositionCommand(editorRef.current, command, STARTER_VILLAGE_COMPOSITION_DEFINITION);
    if (!next.ok) { setFeedback(`Edit rejected: ${next.error.replaceAll('-', ' ')}.`); return false; }
    editorRef.current = next.state;
    setEditor(next.state);
    setFeedback('');
    return true;
  };
  const replaceEditor = (next: CompositionEditorState, message: string): void => {
    editorRef.current = next;
    setEditor(next);
    setFeedback(message);
  };
  const save = (): void => {
    if (!props.onIntent) { setFeedback('Saving is available from the hosted Monster Trainer world.'); return; }
    const requestId = `composition-${Date.now().toString(36)}`;
    setPendingSave(requestId);
    setFeedback('Saving village layout…');
    props.onIntent({ type: 'save-composition', requestId, layout: editor.present });
  };
  const fitCity = (): void => { setZoomMultiplier(1); setPan({ x: 0, y: 0 }); };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.target instanceof Element && event.target.closest('[data-free-build-toolbar]')) return;
    const host = hostRef.current;
    if (!host) return;
    if (event.button === 1 || event.altKey) {
      dragRef.current = { kind: 'pan', pointerId: event.pointerId, originX: event.clientX, originY: event.clientY, panX: pan.x, panY: pan.y, immediate: true };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (event.button !== 0 && event.button !== 2) return;
    const tile = tileFromPointer(event, host, span.columns, span.rows);
    if (mode !== 'build') {
      if (event.button === 0) dragRef.current = { kind: 'pan', pointerId: event.pointerId, originX: event.clientX, originY: event.clientY, panX: pan.x, panY: pan.y, immediate: false };
      return;
    }
    if (!tile) return;
    if (event.button === 2) {
      event.preventDefault();
      const hit = topPlacementAt(editorRef.current.present, STARTER_VILLAGE_COMPOSITION_DEFINITION, tile.x, tile.y);
      if (hit) edit({ type: 'remove-object', placementId: hit.id });
      else edit(paintCommand(tile, null));
      return;
    }
    if (tool.kind === 'paint') {
      edit(paintCommand(tile, tool.terrainId));
      dragRef.current = { kind: 'paint', pointerId: event.pointerId, terrainId: tool.terrainId, lastX: tile.x, lastY: tile.y };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (tool.kind === 'move') {
      const hit = topPlacementAt(editorRef.current.present, STARTER_VILLAGE_COMPOSITION_DEFINITION, tile.x, tile.y);
      if (!hit) return;
      setSelectedPlacementId(hit.id);
      setMoveGhost({ id: hit.id, x: hit.x, y: hit.y });
      dragRef.current = { kind: 'move', pointerId: event.pointerId, placementId: hit.id, x: hit.x, y: hit.y, offsetX: tile.x - hit.x, offsetY: tile.y - hit.y };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    const id = `build-${Date.now().toString(36)}-${placeSerial.current++}`;
    if (edit(placeCommand(tool.definitionId, tile, id))) setSelectedPlacementId(id);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const host = hostRef.current;
    const drag = dragRef.current;
    if (drag?.kind === 'pan' && drag.pointerId === event.pointerId) {
      const distance = Math.hypot(event.clientX - drag.originX, event.clientY - drag.originY);
      if (!drag.immediate && distance < 5) return;
      if (!drag.immediate) event.currentTarget.setPointerCapture(event.pointerId);
      setPan(clampCityPan({
        x: drag.panX + event.clientX - drag.originX,
        y: drag.panY + event.clientY - drag.originY
      }, hostW, hostH, viewportSize.width, viewportSize.height));
      return;
    }
    if (!host) return;
    const tile = tileFromPointer(event, host, span.columns, span.rows);
    if (mode === 'build') setHover(tile);
    if (!tile || !drag || drag.pointerId !== event.pointerId) return;
    if (drag.kind === 'paint') {
      if (drag.lastX === tile.x && drag.lastY === tile.y) return;
      drag.lastX = tile.x;
      drag.lastY = tile.y;
      edit(paintCommand(tile, drag.terrainId));
      return;
    }
    if (drag.kind === 'move') {
      const placement = editorRef.current.present.placements.find((item) => item.id === drag.placementId);
      if (!placement) return;
      const next = { id: drag.placementId, x: tile.x - drag.offsetX, y: tile.y - drag.offsetY };
      drag.x = next.x;
      drag.y = next.y;
      setMoveGhost(next);
      setHover(tile);
    }
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (drag.kind === 'move') {
      const placement = editorRef.current.present.placements.find((item) => item.id === drag.placementId);
      if (placement && (placement.x !== drag.x || placement.y !== drag.y)) edit(moveCommand(drag.placementId, drag));
      setMoveGhost(null);
    }
  };

  const ghost = ghostFor(mode, tool, hover, moveGhost, editor.present);
  return <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#1c3b2c' }}>
    <div ref={viewportRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      onContextMenu={(event) => { if (mode === 'build') event.preventDefault(); }}
      style={{ position: 'relative', flex: '1 1 auto', minHeight: 0, overflow: 'hidden', overscrollBehavior: 'contain', touchAction: 'none' }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: hostW, height: hostH, transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))`, imageRendering: 'pixelated' }}>
        <div ref={hostRef} style={{ width: '100%', height: '100%' }} />
        {ghost && <div aria-hidden="true" style={{ position: 'absolute', left: `${(ghost.x / span.columns) * 100}%`, top: `${(ghost.y / span.rows) * 100}%`, width: `${(ghost.width / span.columns) * 100}%`, height: `${(ghost.height / span.rows) * 100}%`, background: ghost.ok ? 'rgba(189,252,240,.35)' : 'rgba(255,120,96,.4)', boxShadow: ghost.ok ? 'inset 0 0 0 2px #bdfcf0' : 'inset 0 0 0 2px #ffb4a8', pointerEvents: 'none' }} />}
      </div>
    </div>
    <FreeBuildToolbar
      catalog={catalog}
      terrainIds={STARTER_VILLAGE_COMPOSITION_DEFINITION.terrainIds}
      layout={editor.present}
      baseColumns={STARTER_VILLAGE_COLUMNS}
      baseRows={STARTER_VILLAGE_ROWS}
      mode={mode}
      tool={tool}
      zoomPercent={Math.round(zoomMultiplier * 100)}
      onModeChange={setMode}
      onToolChange={setTool}
      onCommand={edit}
      onUndo={() => replaceEditor(undoComposition(editorRef.current), '')}
      onCancel={() => { setSelectedPlacementId(null); replaceEditor({ present: savedLayoutRef.current, past: [] }, 'Unsaved edits cancelled.'); }}
      onSave={save}
      onReset={() => { setSelectedPlacementId('lab-nw'); replaceEditor({ present: STARTER_VILLAGE_PRESET, past: [] }, 'Starter Village preset restored in this draft. Save to persist it.'); }}
      onFit={fitCity}
      feedback={feedback}
    />
  </div>;
}

function ghostFor(
  mode: 'explore' | 'build',
  tool: BuildTool,
  hover: { x: number; y: number } | null,
  moveGhost: { id: string; x: number; y: number } | null,
  layout: WorldCompositionV1
): { x: number; y: number; width: number; height: number; ok: boolean } | null {
  if (mode !== 'build') return null;
  const definition = STARTER_VILLAGE_COMPOSITION_DEFINITION;
  if (tool.kind === 'move') {
    if (!moveGhost) return null;
    const placement = layout.placements.find((item) => item.id === moveGhost.id);
    const object = placement ? definition.objects[placement.definitionId] : undefined;
    if (!placement || !object) return null;
    return {
      x: moveGhost.x, y: moveGhost.y, width: object.footprint.width, height: object.footprint.height,
      ok: placementFits(layout, definition, placement.definitionId, moveGhost.x, moveGhost.y, placement.id)
    };
  }
  if (!hover) return null;
  if (tool.kind === 'paint') return { x: hover.x, y: hover.y, width: 1, height: 1, ok: true };
  const object = definition.objects[tool.definitionId];
  if (!object) return null;
  return {
    x: hover.x, y: hover.y, width: object.footprint.width, height: object.footprint.height,
    ok: placementFits(layout, definition, tool.definitionId, hover.x, hover.y)
  };
}
