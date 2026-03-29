import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface AppSettings {
  shortcut: string;
  overlayCorner: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'bottom-center';
  geminiApiKey: string;
  geminiModel: string;
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
  overlayCorner: 'bottom-center',
  geminiApiKey: '',
  geminiModel: 'gemini-2.5-flash',
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
