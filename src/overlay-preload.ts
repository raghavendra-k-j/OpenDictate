import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('overlayAPI', {
  sendAudio: (audioBuffer: ArrayBuffer, durationMs: number, mode: string) =>
    ipcRenderer.invoke('overlay:transcribe', audioBuffer, durationMs, mode),
  sendText: (text: string, mode: string) =>
    ipcRenderer.invoke('overlay:transcribe-text', text, mode),
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
  getAiStatus: () => ipcRenderer.invoke('settings:ai-status'),
  getActiveProvider: () => ipcRenderer.invoke('settings:active-provider'),
  startWindowsSpeech: () => ipcRenderer.invoke('overlay:start-windows-speech'),
  stopWindowsSpeech: () => ipcRenderer.invoke('overlay:stop-windows-speech') as Promise<string>,
  copyToClipboard: (text: string) => ipcRenderer.send('overlay:copy-clipboard', text),
  resizeOverlay: (height: number) => ipcRenderer.send('overlay:resize', height),
});
