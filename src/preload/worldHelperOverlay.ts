import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { WorldHelperProviderMetadata, WorldHelperProviderId, WorldHelperSafeSnapshot, WorldHelperStreamEvent } from '../shared/worldHelper';

contextBridge.exposeInMainWorld('gusOverlay', {
  providers: (): Promise<WorldHelperProviderMetadata[]> => ipcRenderer.invoke('world-helper:overlay-providers'),
  snapshot: (): Promise<WorldHelperSafeSnapshot> => ipcRenderer.invoke('world-helper:overlay-snapshot'),
  configure: (request: { provider: WorldHelperProviderId; model: string; apiKey?: string }): Promise<{ ok: boolean; category?: string }> =>
    ipcRenderer.invoke('world-helper:overlay-configure', request),
  removeKey: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('world-helper:overlay-removeKey'),
  remove: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('world-helper:overlay-remove'),
  openProviderHelp: (provider: WorldHelperProviderId): Promise<boolean> => ipcRenderer.invoke('world-helper:overlay-openProviderHelp', provider),
  chat: (message: string): Promise<{ ok: boolean; category?: string; proposal?: { id: string; reply: string; worldSuggestion?: string; workers: Array<{ name: string; provider: string; role: string; purpose: string }> } }> =>
    ipcRenderer.invoke('world-helper:overlay-chat', message),
  cancel: (requestId?: string): Promise<boolean> => ipcRenderer.invoke('world-helper:overlay-cancel', requestId),
  approve: (proposalId: string, selectedNames: string[]): Promise<{ ok: boolean; category?: string; launched?: string[] }> =>
    ipcRenderer.invoke('world-helper:overlay-approve', proposalId, selectedNames),
  stop: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('world-helper:overlay-stop'),
  hide: (): Promise<boolean> => ipcRenderer.invoke('world-helper:overlay-hide'),
  dismissSetup: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('world-helper:overlay-dismissSetup'),
  onStream: (callback: (event: WorldHelperStreamEvent) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, payload: WorldHelperStreamEvent) => callback(payload);
    ipcRenderer.on('world-helper:stream', listener);
    return () => ipcRenderer.removeListener('world-helper:stream', listener);
  },
  onState: (callback: (snapshot: WorldHelperSafeSnapshot) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, snapshot: WorldHelperSafeSnapshot) => callback(snapshot);
    ipcRenderer.on('world-helper:overlay-state', listener);
    return () => ipcRenderer.removeListener('world-helper:overlay-state', listener);
  }
});
