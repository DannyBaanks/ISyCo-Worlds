import { useCallback, useId, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { WorldPresentationActivity } from '@shared/worldPresentationProtocol';
import type { CanonicalWorldSnapshot, VisualTransition, WorldAgent, WorldTask } from '../worldProjection';
import type { EvolutionStage } from './monsterArt';
import { formatSimulationClock, type MonsterVillageGameState, type SimulationSpeed } from './worldSimulation';
import { objectiveById } from '@shared/monsterVillageDemo';
import { placeForAgent, VILLAGE_PLACE_LABEL_KEYS } from './villagePlaces';

type Props = {
  snapshot: CanonicalWorldSnapshot;
  transitions: readonly VisualTransition[];
  game: MonsterVillageGameState;
  growthStageForAgent: (agentId: string) => EvolutionStage;
  selectedTaskId: string | null;
  onTaskSelect: (taskId: string) => void;
  onTaskOpen: (taskId: string) => void;
  onAgentSelect: (agentId: string) => void;
  onPauseToggle: () => void;
  onSpeedChange: (speed: SimulationSpeed) => void;
  demoTask?: WorldTask;
  playerPosition: { x: number; y: number };
  activeDemoObjectiveId?: string;
  onDemoSeed: () => void;
  onDemoAction: () => void;
};

const statusClass = (status: string): string => {
  if (status === 'done') return 'done';
  if (status === 'blocked') return 'blocked';
  if (status === 'doing' || status === 'running') return 'doing';
  return 'todo';
};

function statusLabel(status: string, t: (key: string) => string): string {
  if (status === 'done') return t('worldsVisual.statusDone');
  if (status === 'blocked') return t('worldsVisual.statusBlocked');
  if (status === 'doing' || status === 'running') return t('worldsVisual.statusDoing');
  if (status === 'todo') return t('worldsVisual.statusTodo');
  return status;
}

function stateLabel(state: WorldAgent['state'], t: (key: string) => string): string {
  if (state === 'working') return t('worldsVisual.statusDoing');
  if (state === 'waiting') return t('worldsVisual.statusWaiting');
  if (state === 'blocked') return t('worldsVisual.statusBlocked');
  if (state === 'idle') return t('worldsVisual.statusIdle');
  return t('worldsVisual.statusOther');
}

function agentName(snapshot: CanonicalWorldSnapshot, id: string | null): string {
  if (!id) return '—';
  return snapshot.agents.find((agent) => agent.id === id)?.name ?? id;
}

function taskTitle(snapshot: CanonicalWorldSnapshot, id: string): string {
  return snapshot.tasks.find((task) => task.id === id)?.title ?? id;
}

function transitionDetail(transition: VisualTransition, snapshot: CanonicalWorldSnapshot, t: (key: string, options?: Record<string, unknown>) => string): string {
  const state = (value: string): string => stateLabel(value as WorldAgent['state'], t);
  if (transition.kind === 'agent-state-changed') {
    const name = agentName(snapshot, transition.agentId);
    return `${name}: ${state(transition.from)} → ${state(transition.to)}`;
  }
  if (transition.kind === 'task-status-changed') {
    return `${taskTitle(snapshot, transition.taskId)}: ${statusLabel(transition.from, t)} → ${statusLabel(transition.to, t)}`;
  }
  if (transition.kind === 'task-assignee-changed') {
    const task = taskTitle(snapshot, transition.taskId);
    return `${task}: ${agentName(snapshot, transition.from)} → ${agentName(snapshot, transition.to)}`;
  }
  if (transition.kind === 'task-awaits-human-changed') {
    return t(transition.to ? 'worldsVisual.activityHumanRequested' : 'worldsVisual.activityHumanCleared', { task: taskTitle(snapshot, transition.taskId) });
  }
  if (transition.kind === 'task-added') return t('worldsVisual.activityTaskAdded', { task: taskTitle(snapshot, transition.taskId) });
  if (transition.kind === 'task-removed') return t('worldsVisual.activityTaskRemoved', { task: transition.taskId });
  if (transition.kind === 'agent-added') return t('worldsVisual.activityAgentAdded', { name: agentName(snapshot, transition.agentId) });
  if (transition.kind === 'agent-removed') return t('worldsVisual.activityAgentRemoved', { name: transition.agentId });
  return '';
}

/** Which HUD cards are expanded. Every card starts folded to a one-line tab so
 *  the village stays visible; the choice is a per-viewer convenience. */
const HUD_OPEN_KEY = 'cth.villageHud.open';
type HudPanelId = 'ops' | 'missions' | 'demo' | 'simulation' | 'activity';

function readOpenPanels(): Partial<Record<HudPanelId, boolean>> {
  try {
    const raw = JSON.parse(window.localStorage.getItem(HUD_OPEN_KEY) ?? '{}') as unknown;
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Partial<Record<HudPanelId, boolean>> : {};
  } catch { return {}; }
}

function HudPanel({ id, title, summary, badge, badgeWorld, open, onToggle, children, ...rest }: {
  id: HudPanelId; title: string; summary?: ReactNode; badge?: string; badgeWorld?: boolean;
  open: boolean; onToggle: (id: HudPanelId) => void; children: ReactNode;
} & Record<`data-${string}`, string>) {
  const bodyId = useId();
  return (
    <section className={`monster-village-panel monster-village-panel--${id}`} data-open={open ? 'true' : 'false'} {...rest}>
      <button type="button" className="monster-village-panel-heading" aria-expanded={open} aria-controls={bodyId} onClick={() => onToggle(id)}>
        <span className="monster-village-panel-chevron" aria-hidden="true" />
        <strong>{title}</strong>
        {!open && summary !== undefined && <span className="monster-village-panel-summary">{summary}</span>}
        {open && badge && <span className={`monster-village-source-badge${badgeWorld ? ' monster-village-source-badge--world' : ''}`}>{badge}</span>}
      </button>
      {open && <div id={bodyId} className="monster-village-panel-body">{children}</div>}
    </section>
  );
}

function ActivityRow({ item, sourceLabel }: { item: WorldPresentationActivity; sourceLabel?: string }) {
  return (
    <li className="monster-village-activity-row">
      <span className="monster-village-activity-time">{item.ts ? new Date(item.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
      <span className="monster-village-activity-detail">{item.detail}</span>
      <span className="monster-village-activity-source">{sourceLabel ?? item.source}</span>
    </li>
  );
}

export function MonsterVillageHud({
  snapshot,
  transitions,
  game,
  growthStageForAgent,
  selectedTaskId,
  onTaskSelect,
  onTaskOpen,
  onAgentSelect,
  onPauseToggle,
  onSpeedChange,
  demoTask,
  playerPosition,
  activeDemoObjectiveId,
  onDemoSeed,
  onDemoAction
}: Props) {
  const { t } = useTranslation();
  const [openPanels, setOpenPanels] = useState(readOpenPanels);
  const togglePanel = useCallback((id: HudPanelId) => setOpenPanels((current) => {
    const next = { ...current, [id]: !current[id] };
    try { window.localStorage.setItem(HUD_OPEN_KEY, JSON.stringify(next)); } catch { /* stays for this session only */ }
    return next;
  }), []);
  const activeAgents = snapshot.agents.filter((agent) => !agent.archived);
  const counts = useMemo(() => ({
    todo: snapshot.tasks.filter((task) => statusClass(task.status) === 'todo').length,
    doing: snapshot.tasks.filter((task) => statusClass(task.status) === 'doing').length,
    blocked: snapshot.tasks.filter((task) => statusClass(task.status) === 'blocked').length,
    done: snapshot.tasks.filter((task) => statusClass(task.status) === 'done').length
  }), [snapshot.tasks]);
  const selectedTask = snapshot.tasks.find((task) => task.id === selectedTaskId) ?? snapshot.tasks[0] ?? null;
  const transitionRows = transitions.slice(-5).map((transition, index) => ({
    id: `snapshot:${index}:${transition.kind}`,
    ts: Date.now(),
    source: t('worldsVisual.hiveSnapshot'),
    kind: 'snapshot',
    detail: transitionDetail(transition, snapshot, t)
  }));
  const activity = [...transitionRows, ...snapshot.activity].sort((a, b) => b.ts - a.ts).slice(0, 8);

  return (
    <div className="monster-village-hud" aria-label={t('worldsVisual.hudTitle')}>
      <div className="monster-village-hud-column">
        <HudPanel id="ops" title={t('worldsVisual.operational')} badge={t('worldsVisual.sourceHive')} summary={<>{activeAgents.length} · {counts.doing} {t('worldsVisual.statusDoing')}{counts.blocked ? <b className="is-alert"> · {counts.blocked} {t('worldsVisual.statusBlocked')}</b> : null}</>} open={!!openPanels.ops} onToggle={togglePanel}>
          <div className="monster-village-statline">
            <span>{t('worldsVisual.activeAgents')} <b>{activeAgents.length}</b></span>
            <span>{t('worldsVisual.tasks')} <b>{snapshot.tasks.length}</b></span>
          </div>
          <div className="monster-village-task-counts" aria-label={t('worldsVisual.taskCounts')}>
            <span className="todo">{t('worldsVisual.statusTodo')} {counts.todo}</span>
            <span className="doing">{t('worldsVisual.statusDoing')} {counts.doing}</span>
            <span className="blocked">{t('worldsVisual.statusBlocked')} {counts.blocked}</span>
            <span className="done">{t('worldsVisual.statusDone')} {counts.done}</span>
          </div>
          <div className="monster-village-agent-list">
            {activeAgents.length ? activeAgents.map((agent) => (
              <button key={agent.id} type="button" className="monster-village-agent-row" onClick={() => onAgentSelect(agent.id)}>
                <span className="monster-village-agent-dot" data-state={agent.state} aria-hidden="true" />
                <span className="monster-village-agent-copy">
                  <b>{agent.name}</b>
                  <small>{agent.isGod ? `${t('worldsVisual.roleProfessor')} · ` : ''}{stateLabel(agent.state, t)} · {t(VILLAGE_PLACE_LABEL_KEYS[placeForAgent(agent, snapshot.tasks)])}{agent.tool ? ` · ${agent.tool}` : ''}</small>
                </span>
                <span className="monster-village-stage" title={t('worldsVisual.worldOnly')}>{t(`worldsVisual.stage.${growthStageForAgent(agent.id)}`)}</span>
              </button>
            )) : <span className="monster-village-empty">{t('worldsVisual.noAgents')}</span>}
          </div>
        </HudPanel>

        <HudPanel id="demo" title={t('worldsVisual.demoTitle')} badge={t('worldsVisual.demoFixture')} badgeWorld summary={demoTask ? statusLabel(demoTask.status, t) : undefined} open={!!openPanels.demo} onToggle={togglePanel} data-monster-demo-mission="true">
          {!demoTask ? (
            <>
              <p className="monster-village-demo-copy">{t('worldsVisual.demoIntro')}</p>
              <button type="button" className="monster-village-button" onClick={onDemoSeed}>{t('worldsVisual.demoStart')}</button>
            </>
          ) : (
            <>
              <b>{demoTask.title}</b>
              <small className="monster-village-demo-controls">{t('worldsVisual.demoControls')} · {t('worldsVisual.demoPosition', { x: playerPosition.x, y: playerPosition.y })}</small>
              <ul className="monster-village-demo-objectives">
                {demoTask.worldDemo?.objectiveIds.map((objectiveId) => (
                  <li key={objectiveId} data-complete={demoTask.worldDemo?.completedObjectiveIds.includes(objectiveId) ? 'true' : 'false'}>
                    {demoTask.worldDemo?.completedObjectiveIds.includes(objectiveId) ? '✓' : '○'} {objectiveById(objectiveId)?.label ?? objectiveId}
                  </li>
                ))}
              </ul>
              {demoTask.status !== 'done' && <button type="button" className="monster-village-button" disabled={!activeDemoObjectiveId} onClick={onDemoAction}>
                {demoTask.status === 'todo' ? t('worldsVisual.demoAccept') : activeDemoObjectiveId === 'return-professor' ? t('worldsVisual.demoDeliver') : t('worldsVisual.demoInteract')}
              </button>}
              {demoTask.status === 'done' && <small>{t('worldsVisual.demoComplete')}</small>}
            </>
          )}
        </HudPanel>

        <HudPanel id="simulation" title={t('worldsVisual.worldState')} badge={t('worldsVisual.worldOnly')} badgeWorld summary={<>{formatSimulationClock(game.elapsedMs)}{game.paused ? ` · ${t('worldsVisual.paused')}` : ''}</>} open={!!openPanels.simulation} onToggle={togglePanel}>
          <div className="monster-village-simulation-row">
            <span>{t('worldsVisual.worldClock')} <b>{formatSimulationClock(game.elapsedMs)}</b></span>
            <span>{t('worldsVisual.rewards')} <b>{game.rewardIds.length}</b></span>
          </div>
          <div className="monster-village-simulation-controls">
            <button type="button" className="monster-village-button" aria-pressed={game.paused} onClick={onPauseToggle}>{game.paused ? t('worldsVisual.resume') : t('worldsVisual.pause')}</button>
            {[0.5, 1, 2].map((speed) => (
              <button key={speed} type="button" className="monster-village-button" aria-pressed={game.speed === speed} onClick={() => onSpeedChange(speed as SimulationSpeed)}>{speed}×</button>
            ))}
          </div>
          <small>{t('worldsVisual.worldStateNote')}</small>
        </HudPanel>
      </div>
      <div className="monster-village-hud-column monster-village-hud-column--end">
        <HudPanel id="missions" title={t('worldsVisual.backlog')} badge={t('worldsVisual.sourceHive')} summary={<>{snapshot.tasks.length}{counts.blocked ? <b className="is-alert"> · {counts.blocked} {t('worldsVisual.statusBlocked')}</b> : null}</>} open={!!openPanels.missions} onToggle={togglePanel}>
          <div className="monster-village-mission-list">
            {snapshot.tasks.slice(0, 6).map((task) => (
              <button
                key={task.id}
                type="button"
                className={`monster-village-mission-row${selectedTask?.id === task.id ? ' is-selected' : ''}`}
                aria-pressed={selectedTask?.id === task.id}
                onClick={() => onTaskSelect(task.id)}
              >
                <span className={`monster-village-status-chip ${statusClass(task.status)}`}>{statusLabel(task.status, t)}</span>
                <span className="monster-village-mission-title">{task.title}</span>
                <span className="monster-village-mission-owner">{agentName(snapshot, task.assignee)}</span>
              </button>
            ))}
            {!snapshot.tasks.length && <span className="monster-village-empty">{t('worldsVisual.noMissions')}</span>}
          </div>
          <div className="monster-village-selected-mission">
            <span className="monster-village-kicker">{t('worldsVisual.mission')}</span>
            <b>{selectedTask?.title ?? t('worldsVisual.noMission')}</b>
            {selectedTask && (
              <>
                <small>{statusLabel(selectedTask.status, t)} · {agentName(snapshot, selectedTask.assignee)}</small>
                <button type="button" className="monster-village-button" onClick={() => onTaskOpen(selectedTask.id)}>{t('worldsVisual.openTask')}</button>
              </>
            )}
          </div>
        </HudPanel>

        <HudPanel id="activity" title={t('worldsVisual.recentActivity')} badge={t('worldsVisual.sourceHive')} summary={activity.length || undefined} open={!!openPanels.activity} onToggle={togglePanel}>
          <ul className="monster-village-activity-list">
            {activity.map((item) => <ActivityRow key={item.id} item={item} sourceLabel={item.source === t('worldsVisual.hiveSnapshot') ? item.source : undefined} />)}
            {!activity.length && <li className="monster-village-empty">{t('worldsVisual.noActivity')}</li>}
          </ul>
        </HudPanel>
      </div>
    </div>
  );
}
