import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('overlayAPI', {
  sendAudio: (audioBuffer: ArrayBuffer, durationMs: number, mode: string) =>
    ipcRenderer.invoke('overlay:transcribe', audioBuffer, durationMs, mode),
  closeOverlay: () =>
    ipcRenderer.send('overlay:close'),
  onAutoStart: (callback: () => void) => {
    ipcRenderer.on('overlay:auto-start', () => callback());
  },
  onStop: (callback: () => void) => {
    ipcRenderer.on('overlay:stop', () => callback());
  },
  startDrag: () => ipcRenderer.send('overlay:drag-start'),
  stopDrag: () => ipcRenderer.send('overlay:drag-end'),
  getGeminiStatus: () => ipcRenderer.invoke('settings:gemini-status'),
  copyToClipboard: (text: string) => ipcRenderer.send('overlay:copy-clipboard', text),
  resizeOverlay: (height: number) => ipcRenderer.send('overlay:resize', height),
});
