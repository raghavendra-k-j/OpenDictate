import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export type OverlayPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

export type TranscriptionProvider = 'web-speech' | 'curl' | 'whisper-api' | 'gemini' | 'windows-speech';

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

const DEFAULT_SYSTEM_PROMPT = `You are a transcription editor. Clean up the following dictated text:
- Remove filler words (um, uh, like, you know, so, basically, actually, I mean)
- Fix grammar and punctuation
- Organize into clear paragraphs if needed
- Keep the original meaning and tone intact
- Return ONLY the cleaned text, no explanations`;

const defaults: AppSettings = {
  shortcut: 'CommandOrControl+Shift+Space',
  overlayPosition: 'bottom-center',
  transcriptionProvider: 'web-speech',
  whisperApiUrl: 'https://api.openai.com/v1/audio/transcriptions',
  whisperApiKey: '',
  whisperModel: 'whisper-1',
  geminiApiKey: '',
  geminiModel: 'gemini-2.0-flash',
  aiApiKey: '',
  aiApiUrl: 'https://api.openai.com/v1/chat/completions',
  aiModel: 'gpt-4o-mini',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
};

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

export function loadSettings(): AppSettings {
  try {
    const data = fs.readFileSync(getSettingsPath(), 'utf-8');
    return { ...defaults, ...JSON.parse(data) };
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const current = loadSettings();
  const merged = { ...current, ...settings };
  fs.writeFileSync(getSettingsPath(), JSON.stringify(merged, null, 2), 'utf-8');
  return merged;
}
