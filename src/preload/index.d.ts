import type { CthApi } from './index';
import type { WorldHostBridge } from './worldHost';

declare global {
  interface Window {
    cth: CthApi;
    worldPresentation: WorldHostBridge;
  }
}

export {};
