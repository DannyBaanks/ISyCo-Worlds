/**
 * The single vocabulary that ties runtime facts to the village. The Hive hook
 * layer reports a station and a tool for each agent; this module decides which
 * place that means. Movement, status bubbles and the HUD all read it, so what
 * an agent does in code and what its monster does on the map cannot drift apart.
 */

export const VILLAGE_PLACE_IDS = [
  'professor',
  'stable',
  'training-grass',
  'village-idle',
  'route-exit',
  'library',
  'workshop',
  'observatory',
  'notice-board',
  'post-office',
  'portal',
  'well'
] as const;

export type VillagePlaceId = typeof VILLAGE_PLACE_IDS[number];

export interface VillagePlaceAgent {
  id: string;
  state: string;
  station?: string;
  tool?: string;
  isGod?: boolean;
}

export interface VillagePlaceTask {
  assignee: string | null;
  awaitsHuman: boolean;
  status?: string;
}

/**
 * Where each reported station lives:
 *   shelf    (Read / Grep / Glob)      → library, reading the codebase
 *   desk     (Edit / Write)            → workshop, crafting changes
 *   terminal (Bash)                    → stable, putting the work through its paces
 *   web      (WebFetch / WebSearch)    → observatory, looking beyond the village
 *   board    (TodoWrite)               → notice board, planning
 *   mailbox  (Task / Hive messages)    → post office, talking to teammates
 *   mcp      (external tools)          → portal
 */
const STATION_PLACES: Readonly<Record<string, VillagePlaceId>> = {
  shelf: 'library',
  terminal: 'stable',
  web: 'observatory',
  board: 'notice-board',
  mailbox: 'post-office',
  mcp: 'portal'
};

const CRAFTING_TOOLS = new Set(['Edit', 'Write']);

/** A working agent's place. `desk` is also the resting default, so it only counts with a crafting tool in hand. */
export function placeForStation(station: string | undefined, tool: string | undefined): VillagePlaceId {
  if (station && Object.prototype.hasOwnProperty.call(STATION_PLACES, station)) return STATION_PLACES[station];
  if (station === 'desk' && tool && CRAFTING_TOOLS.has(tool)) return 'workshop';
  // Thinking with no tool in hand: practice in the tall grass.
  return 'training-grass';
}

/** Workers that are stuck, or whose task waits on the human, go and stand with the Professor. */
export function placeForWorker(agent: VillagePlaceAgent, tasks: readonly VillagePlaceTask[]): VillagePlaceId {
  if (tasks.some((task) => task.assignee === agent.id && task.awaitsHuman)) return 'professor';
  if (agent.state === 'blocked') return 'professor';
  if (agent.state === 'working') return placeForStation(agent.station, agent.tool);
  if (agent.state === 'waiting') return 'well';
  return 'village-idle';
}

/**
 * The coordinator is the Professor. It hands out and tracks work at the notice
 * board, and otherwise stays at the laboratory, where stuck workers come to it.
 */
export function placeForCoordinator(agent: VillagePlaceAgent): VillagePlaceId {
  if (agent.state === 'working' && (agent.station === 'board' || agent.station === 'mailbox')) return 'notice-board';
  return 'professor';
}

export function placeForAgent(agent: VillagePlaceAgent, tasks: readonly VillagePlaceTask[]): VillagePlaceId {
  return agent.isGod ? placeForCoordinator(agent) : placeForWorker(agent, tasks);
}

/** Flat i18n keys under `worldsVisual`. */
export const VILLAGE_PLACE_LABEL_KEYS: Readonly<Record<VillagePlaceId, string>> = {
  professor: 'worldsVisual.placeLaboratory',
  stable: 'worldsVisual.placeStable',
  'training-grass': 'worldsVisual.placeTrainingGrass',
  'village-idle': 'worldsVisual.placeCampfire',
  'route-exit': 'worldsVisual.placeRouteExit',
  library: 'worldsVisual.placeLibrary',
  workshop: 'worldsVisual.placeWorkshop',
  observatory: 'worldsVisual.placeObservatory',
  'notice-board': 'worldsVisual.placeNoticeBoard',
  'post-office': 'worldsVisual.placePostOffice',
  portal: 'worldsVisual.placePortal',
  well: 'worldsVisual.placeWell'
};
