export interface WorldPresentationVisibility {
  globalView: 'office' | 'marketplace';
  settingsMenuOpen: boolean;
  settingsOpen: boolean;
  addAgentOpen: boolean;
  quitWarningOpen: boolean;
  fullscreenOpen: boolean;
  ideOpen: boolean;
  taskDetailOpen: boolean;
  memoryPanelOpen?: boolean;
  agentStripOverlayOpen?: boolean;
}

export interface WorldPresentationRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface WorldPresentationBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The isolated world renderer is an Electron-native view, not a DOM canvas;
 * it always stacks above the primary renderer. Yield its rectangle whenever
 * the primary renderer needs to show a surface or popover over the floor.
 */
export function shouldSuspendWorldPresentation(state: WorldPresentationVisibility): boolean {
  return state.globalView !== 'office'
    || state.settingsMenuOpen
    || state.settingsOpen
    || state.addAgentOpen
    || state.quitWarningOpen
    || state.fullscreenOpen
    || state.ideOpen
    || state.taskDetailOpen
    || state.memoryPanelOpen === true
    || state.agentStripOverlayOpen === true;
}

export function resolveWorldPresentationBounds(
  rect: WorldPresentationRect,
  ready: boolean,
  suspended: boolean
): WorldPresentationBounds {
  if (!ready || suspended || rect.width <= 0 || rect.height <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}
