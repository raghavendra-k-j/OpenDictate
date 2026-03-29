import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('openDictate', {
  // Config
  saveCurlConfig: (curlString: string) =>
    ipcRenderer.invoke('config:save', curlString),
  loadConfig: () =>
    ipcRenderer.invoke('config:load'),
  clearConfig: () =>
    ipcRenderer.invoke('config:clear'),

  // Transcription
  sendAudio: (audioBuffer: ArrayBuffer, durationMs: number) =>
    ipcRenderer.invoke('dictation:transcribe', audioBuffer, durationMs),
  onStartRecording: (callback: () => void) => {
    ipcRenderer.on('dictation:start', () => callback());
  },
  onStopRecording: (callback: () => void) => {
    ipcRenderer.on('dictation:stop', () => callback());
  },
  onStateChange: (callback: (state: string) => void) => {
    ipcRenderer.on('dictation:state', (_event, state) => callback(state));
  },

  // Notes CRUD
  createNote: (title: string) =>
    ipcRenderer.invoke('notes:create', title),
  getAllNotes: () =>
    ipcRenderer.invoke('notes:getAll'),
  getNote: (id: number) =>
    ipcRenderer.invoke('notes:get', id),
  updateNoteTitle: (id: number, title: string) =>
    ipcRenderer.invoke('notes:updateTitle', id, title),
  updateNoteContent: (id: number, content: string) =>
    ipcRenderer.invoke('notes:updateContent', id, content),
  deleteNote: (id: number) =>
    ipcRenderer.invoke('notes:delete', id),

  // Settings
  getSettings: () =>
    ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: Record<string, unknown>) =>
    ipcRenderer.invoke('settings:save', settings),
});
