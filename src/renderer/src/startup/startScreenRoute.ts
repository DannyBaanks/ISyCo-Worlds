import type { WorldId } from '@shared/worlds';

export interface WorldStartScreenRouteState {
  onboardingComplete: boolean;
  hiveOpened: boolean;
  activeProfileId: string | null | undefined;
}

/** One entry surface owns every pre-runtime state; the live app starts only
 * after setup, a harness, and a semantic world profile are all ready. */
export function shouldShowWorldStartScreen(state: WorldStartScreenRouteState): boolean {
  return !state.onboardingComplete || !state.hiveOpened || state.activeProfileId === null;
}

export type StartupSelectionPlan =
  | { type: 'switch-harness'; harnessHome: string; preferredProfileId: WorldId }
  | { type: 'activate-profile'; profileId: WorldId }
  | { type: 'enter' };

export function planStartupSelection(selection: {
  selectedHome: string;
  currentHome: string | null;
  selectedProfileId: WorldId;
  activeProfileId: string | null;
}): StartupSelectionPlan {
  if (selection.selectedHome !== selection.currentHome) {
    return {
      type: 'switch-harness',
      harnessHome: selection.selectedHome,
      preferredProfileId: selection.selectedProfileId
    };
  }
  if (selection.activeProfileId !== selection.selectedProfileId) {
    return { type: 'activate-profile', profileId: selection.selectedProfileId };
  }
  return { type: 'enter' };
}
