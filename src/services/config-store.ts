import { app, safeStorage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type { ParsedCurl } from '../types';

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'session.enc');
}

export function saveConfig(config: ParsedCurl): void {
  const json = JSON.stringify(config);
  const configPath = getConfigPath();

  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(json);
    fs.writeFileSync(configPath, encrypted);
  } else {
    // Fallback: base64 encoding (not truly secure, but better than plaintext)
    fs.writeFileSync(configPath + '.fallback', Buffer.from(json).toString('base64'), 'utf-8');
  }
}

export function loadConfig(): ParsedCurl | null {
  const configPath = getConfigPath();

  try {
    if (safeStorage.isEncryptionAvailable() && fs.existsSync(configPath)) {
      const encrypted = fs.readFileSync(configPath);
      const json = safeStorage.decryptString(encrypted);
      return JSON.parse(json);
    }

    const fallbackPath = configPath + '.fallback';
    if (fs.existsSync(fallbackPath)) {
      const b64 = fs.readFileSync(fallbackPath, 'utf-8');
      return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
    }
  } catch {
    return null;
  }

  return null;
}

export function clearConfig(): void {
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
  if (fs.existsSync(configPath + '.fallback')) fs.unlinkSync(configPath + '.fallback');
}
