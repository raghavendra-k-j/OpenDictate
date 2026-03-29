import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('openDictate', {
  // Config
  saveCurlConfig: (curlString: string) =>
    ipcRenderer.invoke('config:save', curlString),
  loadConfig: () =>
    ipcRenderer.invoke('config:load'),
  clearConfig: () =>
    ipcRenderer.invoke('config:clear'),

  // Settings
  getSettings: () =>
    ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: Record<string, unknown>) =>
    ipcRenderer.invoke('settings:save', settings),

  // Overlay
  toggleOverlay: () =>
    ipcRenderer.invoke('overlay:toggle'),
});
