import type { CthApi } from './index';
import type { WorldHostBridge } from './worldHost';
import type { WorldHelperProviderMetadata, WorldHelperProviderId, WorldHelperSafeSnapshot, WorldHelperStreamEvent } from '../shared/worldHelper';

interface WorldHelperOverlayBridge {
  providers(): Promise<WorldHelperProviderMetadata[]>;
  snapshot(): Promise<WorldHelperSafeSnapshot>;
  configure(request: { provider: WorldHelperProviderId; model: string; apiKey?: string }): Promise<{ ok: boolean; category?: string }>;
  chat(message: string): Promise<{ ok: boolean; category?: string; proposal?: { id: string; reply: string; worldSuggestion?: string; workers: Array<{ name: string; provider: string; role: string; purpose: string }> } }>;
  cancel(requestId?: string): Promise<boolean>;
  approve(proposalId: string, selectedNames: string[]): Promise<{ ok: boolean; category?: string; launched?: string[] }>;
  stop(): Promise<{ ok: boolean }>;
  dismissSetup(): Promise<{ ok: boolean }>;
  onStream(callback: (event: WorldHelperStreamEvent) => void): () => void;
  onState(callback: (snapshot: WorldHelperSafeSnapshot) => void): () => void;
}

declare global {
  interface Window {
    cth: CthApi;
    worldPresentation: WorldHostBridge;
    gusOverlay?: WorldHelperOverlayBridge;
  }
}

export {};
