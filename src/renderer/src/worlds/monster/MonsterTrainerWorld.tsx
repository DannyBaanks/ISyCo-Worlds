import { useEffect, useRef, useState } from 'react';
import { Application, Container } from 'pixi.js';
import 'pixi.js/unsafe-eval';
import type { IdentityForAgent } from '../identityResolver';
import type { CanonicalWorldSnapshot, VisualTransition, WorldAgent, WorldTask } from '../worldProjection';
import { buildStarterVillageScene, STARTER_VILLAGE_HEIGHT, STARTER_VILLAGE_WIDTH } from './StarterVillageScene';
import { integerScaleForViewport } from './StarterVillageScenario';
import { acquireWorldRendererLease, disposeWorldRendererOnce } from '../pixiOwnership';

export interface MonsterTrainerWorldProps { snapshot: CanonicalWorldSnapshot; transitions: readonly VisualTransition[]; identityFor: IdentityForAgent; onAgentSelect: (agentId: string) => void; onTaskOpen: (taskId: string) => void; reducedMotion: boolean; onReady?: () => void; onRenderFailure?: (cause: unknown) => void; onDisposed?: () => void; }
interface Ctx { agents: readonly WorldAgent[]; tasks: readonly WorldTask[]; identityFor: IdentityForAgent; onAgentSelect: (agentId: string) => void; onTaskOpen: (taskId: string) => void; }

export function MonsterTrainerWorld(props: MonsterTrainerWorldProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null); const hostRef = useRef<HTMLDivElement | null>(null); const ctxRef = useRef<Ctx | null>(null); const [scale, setScale] = useState<1 | 2 | 3 | 4>(1);
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
      const render = () => { const ctx = ctxRef.current; if (!ctx) return; const scene: Container = buildStarterVillageScene(ctx); scene.scale.set(scale); app.stage.removeChildren().forEach((child) => child.destroy({ children: true })); app.stage.addChild(scene); };
      render(); app.renderer.render(app.stage); props.onReady?.(); let signature = '';
      ticker = () => { try { const ctx = ctxRef.current; if (!ctx || failed) return; const next = JSON.stringify([ctx.agents.map((agent) => [agent.id, agent.state]), ctx.tasks.map((task) => [task.id, task.assignee, task.awaitsHuman])]); if (next !== signature) { signature = next; render(); } } catch (cause) { reportFailure(cause); } };
      app.ticker.add(ticker);
    } catch (cause) { release(); if (!alive) return; reportFailure(cause); }
    finally { initSettled = true; if (!alive) finalizeDisposal(); } })();
    return () => { alive = false; if (initSettled) finalizeDisposal(); };
  }, [activeIds, scale]);
  useEffect(() => { ctxRef.current = { agents: activeAgents, tasks: props.snapshot.tasks, identityFor: props.identityFor, onAgentSelect: props.onAgentSelect, onTaskOpen: props.onTaskOpen }; });
  return <div ref={viewportRef} style={{ position: 'absolute', inset: 0, overflow: 'auto', background: '#132532' }}><div ref={hostRef} style={{ width: STARTER_VILLAGE_WIDTH * scale, height: STARTER_VILLAGE_HEIGHT * scale, imageRendering: 'pixelated' }} /></div>;
}
