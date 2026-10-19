import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { WorldPresentationActivity } from '@shared/worldPresentationProtocol';
import type { CanonicalWorldSnapshot, VisualTransition, WorldAgent, WorldTask } from '../worldProjection';
import type { EvolutionStage } from './monsterArt';
import { formatSimulationClock, type MonsterVillageGameState, type SimulationSpeed } from './worldSimulation';

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
};

const buttonStyle: React.CSSProperties = {
  border: '1px solid #8b673d',
  background: 'linear-gradient(#fff0c9, #d6ae70)',
  color: '#332719',
  padding: '4px 7px',
  font: '700 10px/14px var(--cth-font-ui)',
  cursor: 'pointer'
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

function stationLabel(station: string | undefined, t: (key: string) => string): string {
  if (station === 'shelf' || station === 'web' || station === 'mcp') return t('worldsVisual.stationResearch');
  if (station === 'terminal' || station === 'board') return t('worldsVisual.stationCare');
  if (station === 'mailbox') return t('worldsVisual.stationProfessor');
  if (station) return station;
  return t('worldsVisual.neutral');
}

function agentName(snapshot: CanonicalWorldSnapshot, id: string | null): string {
  if (!id) return '—';
  return snapshot.agents.find((agent) => agent.id === id)?.name ?? id;
}

function taskTitle(snapshot: CanonicalWorldSnapshot, id: string): string {
  return snapshot.tasks.find((task) => task.id === id)?.title ?? id;
}

function transitionDetail(transition: VisualTransition, snapshot: CanonicalWorldSnapshot): string {
  if (transition.kind === 'agent-state-changed') {
    const name = agentName(snapshot, transition.agentId);
    return `${name}: ${transition.from} → ${transition.to}`;
  }
  if (transition.kind === 'task-status-changed') {
    return `${taskTitle(snapshot, transition.taskId)}: ${transition.from} → ${transition.to}`;
  }
  if (transition.kind === 'task-assignee-changed') {
    const task = taskTitle(snapshot, transition.taskId);
    return `${task}: ${agentName(snapshot, transition.from)} → ${agentName(snapshot, transition.to)}`;
  }
  if (transition.kind === 'task-awaits-human-changed') return `${taskTitle(snapshot, transition.taskId)}: human input ${transition.to ? 'requested' : 'cleared'}`;
  if (transition.kind === 'task-added') return `Task added: ${taskTitle(snapshot, transition.taskId)}`;
  if (transition.kind === 'task-removed') return `Task removed: ${transition.taskId}`;
  if (transition.kind === 'agent-added') return `Agent added: ${agentName(snapshot, transition.agentId)}`;
  if (transition.kind === 'agent-removed') return `Agent removed: ${transition.agentId}`;
  return `Transition: ${transition.kind}`;
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
  onSpeedChange
}: Props) {
  const { t } = useTranslation();
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
    detail: transitionDetail(transition, snapshot)
  }));
  const activity = [...transitionRows, ...snapshot.activity].sort((a, b) => b.ts - a.ts).slice(0, 8);

  return (
    <div className="monster-village-hud" aria-label={t('worldsVisual.hudTitle')}>
      <section className="monster-village-panel monster-village-panel--ops">
        <div className="monster-village-panel-heading">
          <strong>{t('worldsVisual.operational')}</strong>
          <span className="monster-village-source-badge">{t('worldsVisual.sourceHive')}</span>
        </div>
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
                <small>{stateLabel(agent.state, t)} · {stationLabel(agent.station, t)}{agent.tool ? ` · ${agent.tool}` : ` · ${t('worldsVisual.neutral')}`}</small>
              </span>
              <span className="monster-village-stage" title={t('worldsVisual.worldOnly')}>{growthStageForAgent(agent.id)}</span>
            </button>
          )) : <span className="monster-village-empty">{t('worldsVisual.noAgents')}</span>}
        </div>
      </section>

      <section className="monster-village-panel monster-village-panel--missions">
        <div className="monster-village-panel-heading">
          <strong>{t('worldsVisual.backlog')}</strong>
          <span className="monster-village-source-badge">tasks.json</span>
        </div>
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
              <button type="button" style={buttonStyle} onClick={() => onTaskOpen(selectedTask.id)}>{t('worldsVisual.openTask')}</button>
            </>
          )}
        </div>
      </section>

      <section className="monster-village-panel monster-village-panel--simulation">
        <div className="monster-village-panel-heading">
          <strong>{t('worldsVisual.worldState')}</strong>
          <span className="monster-village-source-badge monster-village-source-badge--world">{t('worldsVisual.worldOnly')}</span>
        </div>
        <div className="monster-village-simulation-row">
          <span>{t('worldsVisual.worldClock')} <b>{formatSimulationClock(game.elapsedMs)}</b></span>
          <span>{t('worldsVisual.rewards')} <b>{game.rewardIds.length}</b></span>
        </div>
        <div className="monster-village-simulation-controls">
          <button type="button" style={buttonStyle} aria-pressed={game.paused} onClick={onPauseToggle}>{game.paused ? t('worldsVisual.resume') : t('worldsVisual.pause')}</button>
          {[0.5, 1, 2].map((speed) => (
            <button key={speed} type="button" style={{ ...buttonStyle, opacity: game.speed === speed ? 1 : 0.62 }} aria-pressed={game.speed === speed} onClick={() => onSpeedChange(speed as SimulationSpeed)}>{speed}×</button>
          ))}
        </div>
        <small>{t('worldsVisual.worldStateNote')}</small>
      </section>

      <section className="monster-village-panel monster-village-panel--activity">
        <div className="monster-village-panel-heading">
          <strong>{t('worldsVisual.recentActivity')}</strong>
          <span className="monster-village-source-badge">{t('worldsVisual.sourceHive')}</span>
        </div>
        <ul className="monster-village-activity-list">
          {activity.map((item) => <ActivityRow key={item.id} item={item} sourceLabel={item.source === t('worldsVisual.hiveSnapshot') ? item.source : undefined} />)}
          {!activity.length && <li className="monster-village-empty">{t('worldsVisual.noActivity')}</li>}
        </ul>
      </section>
    </div>
  );
}
