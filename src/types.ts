export interface ParsedCurl {
  url: string;
  headers: Record<string, string>;
  cookies: string;
}

export type TranscriptionProvider = 'web-speech' | 'curl' | 'whisper-api' | 'gemini' | 'windows-speech';

export interface TranscriptionResult {
  success: boolean;
  text?: string;
  error?: string;
  errorCode?: string;
  detail?: string;
}

export type OverlayPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

export interface AppSettings {
  shortcut: string;
  overlayPosition: OverlayPosition;
  transcriptionProvider: TranscriptionProvider;
  whisperApiUrl: string;
  whisperApiKey: string;
  whisperModel: string;
  geminiApiKey: string;
  geminiModel: string;
  aiApiKey: string;
  aiApiUrl: string;
  aiModel: string;
  systemPrompt: string;
}

export type OverlayMode = 'transcribe' | 'transcribe-refine';

export interface OverlayAPI {
  sendAudio(audioBuffer: ArrayBuffer, durationMs: number, mode: OverlayMode): Promise<TranscriptionResult>;
  sendText(text: string, mode: OverlayMode): Promise<TranscriptionResult>;
  closeOverlay(): void;
  onAutoStart(callback: () => void): void;
  onStop(callback: () => void): void;
  startDrag(): void;
  stopDrag(): void;
  getAiStatus(): Promise<{ configured: boolean }>;
  getActiveProvider(): Promise<{ provider: TranscriptionProvider }>;
  startWindowsSpeech(): Promise<void>;
  stopWindowsSpeech(): Promise<string>;
  copyToClipboard(text: string): void;
  resizeOverlay(height: number): void;
}

export interface OpenDictateAPI {
  // Config
  saveCurlConfig(curlString: string): Promise<{ success: boolean; error?: string }>;
  loadConfig(): Promise<{ configured: boolean; url?: string }>;
  clearConfig(): Promise<void>;

  // Settings
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: Partial<AppSettings>): Promise<{ success: boolean; shortcut: string; error?: string }>;

  // Overlay
  toggleOverlay(): Promise<void>;
}

declare global {
  interface Window {
    openDictate: OpenDictateAPI;
    overlayAPI: OverlayAPI;
  }
}
