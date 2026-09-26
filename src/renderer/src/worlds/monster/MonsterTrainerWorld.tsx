import { useEffect, useRef } from 'react';
import { Application, Container, Graphics, Text } from 'pixi.js';
// PixiJS uses new Function() internally, blocked by Electron CSP — this patches it.
import 'pixi.js/unsafe-eval';
import type { IdentityForAgent } from '../identityResolver';
import type { CanonicalWorldSnapshot, VisualTransition, WorldAgent, WorldTask } from '../worldProjection';
import { creaturePlan, stateMarker, visualStateFor } from './monsterArt';

const CELL = 4; // creature plans live on a 16x16 grid, painted at 4x
const SLOT_W = 120;
const SLOT_H = 108;

export interface MonsterTrainerWorldProps {
  snapshot: CanonicalWorldSnapshot;
  transitions: readonly VisualTransition[];
  identityFor: IdentityForAgent;
  onAgentSelect: (agentId: string) => void;
  onTaskOpen: (taskId: string) => void;
  reducedMotion: boolean;
  onReady?: () => void;
  onRenderFailure?: (cause: unknown) => void;
}

interface Ctx {
  agents: readonly WorldAgent[];
  tasks: readonly WorldTask[];
  identityFor: IdentityForAgent;
  onAgentSelect: (agentId: string) => void;
  onTaskOpen: (taskId: string) => void;
  reducedMotion: boolean;
  pulse: number;
}

function drawMarker(graphics: Graphics, state: ReturnType<typeof visualStateFor>, x: number, y: number): void {
  const marker = stateMarker(state);
  graphics.setFillStyle({ color: marker.color });
  if (marker.shape === 'circle') {
    graphics.circle(x + 7, y + 7, 7).fill();
  } else if (marker.shape === 'bar') {
    graphics.rect(x, y + 3, 14, 8).fill();
  } else if (marker.shape === 'triangle') {
    graphics.poly([x + 7, y, x + 14, y + 14, x, y + 14]).fill();
  } else {
    graphics.poly([x + 7, y, x + 14, y + 7, x + 7, y + 14, x, y + 7]).fill();
  }
}

function drawSlot(root: Container, agent: WorldAgent, task: WorldTask | undefined, ctx: Ctx, index: number): Graphics | null {
  const plan = creaturePlan(ctx.identityFor(agent.id));
  const state = visualStateFor(agent, ctx.tasks);
  const x0 = 24 + index * SLOT_W;
  const y0 = 28;

  const pad = new Graphics();
  pad.setFillStyle({ color: 0x1f2d3d });
  pad.roundRect(x0, y0, SLOT_W - 16, SLOT_H - 16, 4).fill();
  pad.eventMode = 'static';
  pad.cursor = 'pointer';
  pad.on('pointertap', () => ctx.onAgentSelect(agent.id));
  root.addChild(pad);

  const creature = new Graphics();
  for (const block of plan.blocks) {
    creature.setFillStyle({ color: block.color });
    creature.rect(block.x * CELL, block.y * CELL, block.w * CELL, block.h * CELL).fill();
  }
  creature.x = Math.round(x0 + (SLOT_W - 16 - 16 * CELL) / 2);
  creature.y = y0 + 6;
  creature.eventMode = 'static';
  creature.cursor = 'pointer';
  creature.on('pointertap', () => ctx.onAgentSelect(agent.id));
  root.addChild(creature);

  const marker = new Graphics();
  drawMarker(marker, state, x0 + SLOT_W - 32, y0 + 6);
  marker.eventMode = 'static';
  marker.cursor = 'pointer';
  marker.on('pointertap', () => ctx.onAgentSelect(agent.id));
  root.addChild(marker);

  const name = new Text({
    text: agent.name,
    style: { fill: 0xf5f0e6, fontSize: 11, fontFamily: 'monospace' }
  });
  name.x = x0 + 8;
  name.y = y0 + SLOT_H - 34;
  name.eventMode = 'static';
  name.cursor = 'pointer';
  name.on('pointertap', () => ctx.onAgentSelect(agent.id));
  root.addChild(name);

  if (task) {
    const chip = new Graphics();
    chip.setFillStyle({ color: task.awaitsHuman ? 0xe0a458 : 0x4a5a6a });
    chip.roundRect(x0 + 8, y0 + SLOT_H - 22, SLOT_W - 32, 12, 2).fill();
    chip.eventMode = 'static';
    chip.cursor = 'pointer';
    chip.on('pointertap', () => ctx.onTaskOpen(task.id));
    root.addChild(chip);
    const label = new Text({
      text: task.title.slice(0, 16),
      style: { fill: 0x100c08, fontSize: 8, fontFamily: 'monospace' }
    });
    label.x = x0 + 10;
    label.y = y0 + SLOT_H - 20;
    root.addChild(label);
  }
  return (state === 'awaitsHuman' || state === 'blocked') ? creature : null;
}

/**
 * Self-contained Pixi canvas. It receives snapshot/identity/callbacks as props
 * only; every operational read happens one level up in MonsterTrainerSurface.
 */
export function MonsterTrainerWorld(props: MonsterTrainerWorldProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const ctxRef = useRef<Ctx | null>(null);

  const activeAgents = props.snapshot.agents.filter((agent) => !agent.archived).slice(0, 2);
  const activeIds = activeAgents.map((agent) => agent.id).join('|');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const app = new Application();
    let ticker: (() => void) | null = null;
    let alive = true;
    let initialized = false;
    let readyReported = false;
    let failed = false;
    const pulseStart = performance.now();
    function reportFailure(cause: unknown): void {
      if (failed) return;
      failed = true;
      if (ticker) app.ticker.remove(ticker);
      props.onRenderFailure?.(cause);
    }

    void (async () => {
      try {
        await app.init({
          backgroundAlpha: 0,
          resizeTo: host,
          antialias: false,
          roundPixels: true,
          resolution: Math.round(window.devicePixelRatio || 1),
          autoDensity: true,
          preference: 'webgl'
        });
      } catch (cause) {
        // Async initialization errors bypass React error boundaries, so report
        // them explicitly and let the host restore Office immediately.
        reportFailure(cause);
        return;
      }
      if (!alive) { app.destroy(true); return; }
      initialized = true;
      host.appendChild(app.canvas);
      const pulseStartNow = () => (performance.now() - pulseStart) / 300;
      let lastSignature = '';
      let pulsingCreatures: Graphics[] = [];
      const render = () => {
        const ctx = ctxRef.current;
        if (!ctx) return;
        ctx.pulse = pulseStartNow();
        const layer = new Container();
        pulsingCreatures = [];
        ctx.agents.forEach((agent, index) => {
          const task = ctx.tasks.find((candidate) => candidate.assignee === agent.id);
          const pulsing = drawSlot(layer, agent, task, ctx, index);
          if (pulsing) pulsingCreatures.push(pulsing);
        });
        if (ctx.agents.length === 0) {
          const empty = new Text({
            text: 'No active agents',
            style: { fill: 0x9db4d0, fontSize: 12, fontFamily: 'monospace' }
          });
          empty.x = 24;
          empty.y = 24;
          layer.addChild(empty);
        }
        app.stage.removeChildren().forEach((child) => child.destroy({ children: true }));
        app.stage.addChild(layer);
      };
      try {
        render();
        app.renderer.render(app.stage);
      } catch (cause) {
        reportFailure(cause);
        return;
      }
      if (!readyReported) {
        readyReported = true;
        props.onReady?.();
      }
      ticker = () => {
        try {
          const ctx = ctxRef.current;
          if (!ctx || failed) return;
          // Rebuild only when visible state changes; rebuilding mid-gesture would
          // destroy the Graphic under the cursor and swallow the click. The
          // blocked/awaiting pulse animates alpha on the existing Graphics instead.
          const signature = JSON.stringify([
            ctx.agents.map((a) => [a.id, a.name, a.state]),
            ctx.tasks.map((t) => [t.id, t.title, t.assignee, t.status, t.awaitsHuman])
          ]);
          if (signature !== lastSignature) {
            lastSignature = signature;
            render();
          }
          if (!ctx.reducedMotion && pulsingCreatures.length > 0) {
            const alpha = 0.85 + 0.15 * Math.sin(pulseStartNow());
            for (const creature of pulsingCreatures) creature.alpha = alpha;
          }
        } catch (cause) {
          reportFailure(cause);
        }
      };
      app.ticker.add(ticker);
    })();

    return () => {
      alive = false;
      // Destroying before init() resolves crashes inside Pixi (React StrictMode
      // unmounts once right after mount in dev); then the init path destroys.
      if (!initialized) return;
      if (ticker) app.ticker.remove(ticker);
      app.destroy(true);
    };
  }, [activeIds]);

  useEffect(() => {
    ctxRef.current = {
      agents: activeAgents,
      tasks: props.snapshot.tasks,
      identityFor: props.identityFor,
      onAgentSelect: props.onAgentSelect,
      onTaskOpen: props.onTaskOpen,
      reducedMotion: props.reducedMotion,
      pulse: 0
    };
  });

  return <div ref={hostRef} style={{ position: 'absolute', inset: 0, imageRendering: 'pixelated' }} />;
}
