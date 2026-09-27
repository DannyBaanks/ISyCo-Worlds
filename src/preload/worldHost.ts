import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { WorldPresentationCommand, WorldPresentationEvent } from '../shared/worldPresentationProtocol';

const api = {
  onCommand(cb: (command: WorldPresentationCommand) => void): () => void {
    const listener = (_event: IpcRendererEvent, command: WorldPresentationCommand) => cb(command);
    ipcRenderer.on('world-presentation:command', listener);
    return () => ipcRenderer.removeListener('world-presentation:command', listener);
  },
  emit(event: WorldPresentationEvent): void {
    ipcRenderer.send('world-presentation:event', event);
  }
};

contextBridge.exposeInMainWorld('worldPresentation', api);

export type WorldHostBridge = typeof api;
