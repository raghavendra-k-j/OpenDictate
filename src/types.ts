export interface ParsedCurl {
  url: string;
  headers: Record<string, string>;
  cookies: string;
}

export interface TranscriptionResult {
  success: boolean;
  text?: string;
  error?: string;
}

export interface Note {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Entry {
  id: number;
  note_id: number;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface OpenDictateAPI {
  // Config
  saveCurlConfig(curlString: string): Promise<{ success: boolean; error?: string }>;
  loadConfig(): Promise<{ configured: boolean; url?: string }>;
  clearConfig(): Promise<void>;

  // Transcription
  sendAudio(audioBuffer: ArrayBuffer, durationMs: number, noteId: number): Promise<TranscriptionResult & { entryId?: number }>;
  onStartRecording(callback: () => void): void;
  onStopRecording(callback: () => void): void;
  onStateChange(callback: (state: string) => void): void;

  // Notes CRUD
  createNote(title: string): Promise<Note>;
  getAllNotes(): Promise<Note[]>;
  getNote(id: number): Promise<Note | null>;
  updateNoteTitle(id: number, title: string): Promise<void>;
  deleteNote(id: number): Promise<void>;

  // Entries CRUD
  getEntries(noteId: number): Promise<Entry[]>;
  updateEntry(id: number, content: string): Promise<void>;
  deleteEntry(id: number): Promise<void>;
}

declare global {
  interface Window {
    openDictate: OpenDictateAPI;
  }
}
