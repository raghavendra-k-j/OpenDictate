export interface ParsedCurl {
  url: string;
  headers: Record<string, string>;
  cookies: string;
}

export interface TranscriptionResult {
  success: boolean;
  text?: string;
  error?: string;
  errorCode?: string;
  detail?: string;
}

export interface Note {
  id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface AppSettings {
  shortcut: string;
  overlayCorner: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'bottom-center';
  geminiApiKey: string;
  geminiModel: string;
  systemPrompt: string;
}

export type OverlayMode = 'transcribe' | 'transcribe-refine';

export interface OverlayAPI {
  sendAudio(audioBuffer: ArrayBuffer, durationMs: number, mode: OverlayMode): Promise<TranscriptionResult>;
  closeOverlay(): void;
  onAutoStart(callback: () => void): void;
  onStop(callback: () => void): void;
  startDrag(): void;
  stopDrag(): void;
  getGeminiStatus(): Promise<{ configured: boolean }>;
  copyToClipboard(text: string): void;
  resizeOverlay(height: number): void;
}

export interface OpenDictateAPI {
  // Config
  saveCurlConfig(curlString: string): Promise<{ success: boolean; error?: string }>;
  loadConfig(): Promise<{ configured: boolean; url?: string }>;
  clearConfig(): Promise<void>;

  // Transcription
  sendAudio(audioBuffer: ArrayBuffer, durationMs: number): Promise<TranscriptionResult>;
  onStartRecording(callback: () => void): void;
  onStopRecording(callback: () => void): void;
  onStateChange(callback: (state: string) => void): void;

  // Settings
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: Partial<AppSettings>): Promise<{ success: boolean; shortcut: string; error?: string }>;

  // Notes CRUD
  createNote(title: string): Promise<Note>;
  getAllNotes(): Promise<Note[]>;
  getNote(id: number): Promise<Note | null>;
  updateNoteTitle(id: number, title: string): Promise<void>;
  updateNoteContent(id: number, content: string): Promise<void>;
  deleteNote(id: number): Promise<void>;
}

declare global {
  interface Window {
    openDictate: OpenDictateAPI;
    overlayAPI: OverlayAPI;
  }
}
