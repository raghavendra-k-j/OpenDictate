import { app, BrowserWindow, clipboard, globalShortcut, ipcMain, Menu, screen, Tray } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { parseCurl } from './services/curl-parser';
import { saveConfig, loadConfig, clearConfig } from './services/config-store';
import { transcribe } from './services/transcription';
import { insertText } from './services/text-inserter';
import { createTrayIcon } from './utils/tray-icons';
import { loadSettings, saveSettings as persistSettings } from './services/settings-store';
import { refineText } from './services/gemini-refine';
import * as db from './services/database';

if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let state: 'idle' | 'recording' | 'processing' = 'idle';
let currentShortcut: string | null = null;
let dragInterval: ReturnType<typeof setInterval> | null = null;
let dragOffset = { x: 0, y: 0 };

function updateState(newState: typeof state) {
  state = newState;
  if (tray) {
    tray.setImage(createTrayIcon(state));
    const labels: Record<string, string> = {
      idle: 'OpenDictate — Ready',
      recording: 'OpenDictate — Recording...',
      processing: 'OpenDictate — Processing...',
    };
    tray.setToolTip(labels[state]);
  }
  mainWindow?.webContents.send('dictation:state', state);
}

// ── Overlay Window ──
function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 265,
    height: 52,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    focusable: false,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'overlay-preload.js'),
    },
  });

  if (OVERLAY_WINDOW_VITE_DEV_SERVER_URL) {
    overlayWindow.loadURL(`${OVERLAY_WINDOW_VITE_DEV_SERVER_URL}/overlay.html`);
  } else {
    overlayWindow.loadFile(
      path.join(__dirname, `../renderer/${OVERLAY_WINDOW_VITE_NAME}/overlay.html`),
    );
  }

  overlayWindow.setIgnoreMouseEvents(false);
}

function positionOverlay() {
  if (!overlayWindow) return;
  const settings = loadSettings();
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  const { x: sx, y: sy } = display.workArea;
  const margin = 20;
  const ow = 265;
  const oh = 52;

  let x: number, y: number;
  switch (settings.overlayCorner) {
    case 'top-left': x = sx + margin; y = sy + margin; break;
    case 'top-right': x = sx + width - ow - margin; y = sy + margin; break;
    case 'bottom-left': x = sx + margin; y = sy + height - oh - margin; break;
    case 'bottom-center': x = sx + Math.round((width - ow) / 2); y = sy + height - oh - margin; break;
    case 'bottom-right': default: x = sx + width - ow - margin; y = sy + height - oh - margin; break;
  }
  overlayWindow.setPosition(Math.round(x), Math.round(y));
}

function showOverlay() {
  if (!overlayWindow) return;
  positionOverlay();
  overlayWindow.showInactive();
}

function hideOverlay() {
  if (dragInterval) { clearInterval(dragInterval); dragInterval = null; }
  overlayWindow?.hide();
}

function registerShortcut(accelerator: string): boolean {
  if (currentShortcut) {
    globalShortcut.unregister(currentShortcut);
    currentShortcut = null;
  }
  try {
    const success = globalShortcut.register(accelerator, handleShortcut);
    if (success) {
      currentShortcut = accelerator;
    }
    return success;
  } catch {
    return false;
  }
}

function handleShortcut() {
  if (!loadConfig()) {
    mainWindow?.show();
    return;
  }

  if (state === 'idle') {
    if (overlayWindow?.isVisible()) {
      hideOverlay();
    } else {
      showOverlay();
      updateState('recording');
      overlayWindow?.webContents.send('overlay:auto-start');
    }
  } else if (state === 'recording') {
    updateState('processing');
    overlayWindow?.webContents.send('overlay:stop');
  }
}

function createTray() {
  tray = new Tray(createTrayIcon('idle'));
  tray.setToolTip('OpenDictate — Ready');
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Window',
      click: () => mainWindow?.show(),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => mainWindow?.show());
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 700,
    minWidth: 760,
    minHeight: 500,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
};

// ── Config IPC ──
ipcMain.handle('config:save', async (_event, curlString: string) => {
  try {
    const parsed = parseCurl(curlString);
    saveConfig(parsed);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to parse cURL';
    return { success: false, error: message };
  }
});

ipcMain.handle('config:load', async () => {
  const config = loadConfig();
  if (config) {
    return { configured: true, url: config.url };
  }
  return { configured: false };
});

ipcMain.handle('config:clear', async () => {
  clearConfig();
});

// ── Transcription IPC ──
ipcMain.handle('dictation:transcribe', async (_event, audioBuffer: ArrayBuffer, durationMs: number) => {
  try {
    const config = loadConfig();
    if (!config) {
      throw new Error('Not configured. Paste a cURL command first.');
    }

    const text = await transcribe(Buffer.from(audioBuffer), durationMs, config);

    return { success: true, text };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Transcription failed';
    return { success: false, error: message };
  } finally {
    updateState('idle');
  }
});

// ── Overlay IPC ──
function classifyError(err: unknown): { message: string; code: string; detail: string } {
  const isErr = err instanceof Error;
  const msg = isErr ? err.message : String(err);
  const stack = isErr ? (err.stack ?? msg) : msg;
  const causeMsg: string = (err as any)?.cause?.message ?? '';
  const causeCode: string = (err as any)?.cause?.code ?? '';

  const detail = [
    `Timestamp: ${new Date().toISOString()}`,
    `Message: ${msg}`,
    causeMsg ? `Cause: ${causeMsg}` : '',
    causeCode ? `Cause code: ${causeCode}` : '',
    '',
    'Stack trace:',
    stack,
  ].filter(Boolean).join('\n');

  if (
    msg.includes('fetch failed') ||
    causeCode === 'ENOTFOUND' || causeCode === 'ECONNREFUSED' ||
    causeCode === 'EAI_AGAIN' || causeCode === 'ETIMEDOUT' ||
    msg.toLowerCase().includes('enotfound') ||
    msg.toLowerCase().includes('network error')
  ) {
    return { message: 'No internet connection', code: 'no-internet', detail };
  }
  if (msg.includes('Session expired') || msg.includes('401') || msg.includes('403') || msg.toLowerCase().includes('unauthorized')) {
    return { message: 'Auth failed — re-paste your cURL', code: 'auth-failed', detail };
  }
  if (msg.includes('429') || msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('quota exceeded')) {
    return { message: 'Rate limited — try again later', code: 'rate-limited', detail };
  }
  if (msg.includes('No transcription text') || msg.toLowerCase().includes('no speech')) {
    return { message: 'No speech detected', code: 'no-text', detail };
  }
  if (msg.toLowerCase().includes('gemini') || msg.toLowerCase().includes('googlegenai') || msg.includes('Gemini API key')) {
    return { message: 'AI refinement failed', code: 'gemini-error', detail };
  }
  if (msg.includes('Not configured')) {
    return { message: 'Not configured — open settings', code: 'not-configured', detail };
  }
  if (msg.toLowerCase().includes('permission denied') || msg.toLowerCase().includes('notallowederror')) {
    return { message: 'Microphone access denied', code: 'mic-denied', detail };
  }
  const statusMatch = msg.match(/\((\d{3})\)/);
  if (statusMatch) {
    return { message: `Server error ${statusMatch[1]}`, code: 'api-error', detail };
  }
  return { message: msg.length > 50 ? msg.slice(0, 47) + '...' : msg, code: 'unknown', detail };
}

ipcMain.handle('overlay:transcribe', async (_event, audioBuffer: ArrayBuffer, durationMs: number, mode: string) => {
  try {
    const config = loadConfig();
    if (!config) throw new Error('Not configured. Paste a cURL command first.');

    let text = await transcribe(Buffer.from(audioBuffer), durationMs, config);

    if (mode === 'transcribe-refine') {
      const settings = loadSettings();
      if (!settings.geminiApiKey) throw new Error('Gemini API key not configured.');
      text = await refineText(text, settings.geminiApiKey, settings.geminiModel, settings.systemPrompt);
    }

    await insertText(text);

    updateState('idle');
    return { success: true, text };
  } catch (err: unknown) {
    updateState('idle');
    const { message, code, detail } = classifyError(err);
    return { success: false, error: message, errorCode: code, detail };
  }
});

ipcMain.on('overlay:close', () => {
  hideOverlay();
  if (state !== 'idle') updateState('idle');
});

ipcMain.on('overlay:copy-clipboard', (_event, text: string) => {
  clipboard.writeText(text);
});

ipcMain.on('overlay:resize', (_event, height: number) => {
  if (!overlayWindow) return;
  const clamped = Math.max(52, Math.min(200, height));
  const [x, y] = overlayWindow.getPosition();
  const [w, oldH] = overlayWindow.getSize();
  // Keep baseline (bottom edge) fixed — grow window upward
  overlayWindow.setBounds({ x, y: y - (clamped - oldH), width: w, height: clamped });
});

ipcMain.on('overlay:drag-start', () => {
  if (!overlayWindow) return;
  const cursor = screen.getCursorScreenPoint();
  const [wx, wy] = overlayWindow.getPosition();
  dragOffset = { x: cursor.x - wx, y: cursor.y - wy };
  dragInterval = setInterval(() => {
    if (!overlayWindow) return;
    const cur = screen.getCursorScreenPoint();
    overlayWindow.setPosition(cur.x - dragOffset.x, cur.y - dragOffset.y);
  }, 16);
});

ipcMain.on('overlay:drag-end', () => {
  if (dragInterval) { clearInterval(dragInterval); dragInterval = null; }
});

ipcMain.handle('settings:gemini-status', async () => {
  const settings = loadSettings();
  return { configured: !!settings.geminiApiKey };
});

// ── Settings IPC ──
ipcMain.handle('settings:get', async () => {
  return loadSettings();
});

ipcMain.handle('settings:save', async (_event, newSettings: Record<string, unknown>) => {
  const old = loadSettings();
  const updated = persistSettings(newSettings);

  if (newSettings.shortcut && newSettings.shortcut !== old.shortcut) {
    const ok = registerShortcut(updated.shortcut);
    if (!ok) {
      // Revert to old shortcut
      persistSettings({ shortcut: old.shortcut });
      registerShortcut(old.shortcut);
      return { success: false, shortcut: old.shortcut, error: `Could not register "${updated.shortcut}". Reverted to "${old.shortcut}".` };
    }
  }

  return { success: true, shortcut: updated.shortcut };
});

// ── Notes IPC ──
ipcMain.handle('notes:create', async (_event, title: string) => {
  return db.createNote(title);
});

ipcMain.handle('notes:getAll', async () => {
  return db.getAllNotes();
});

ipcMain.handle('notes:get', async (_event, id: number) => {
  return db.getNote(id) ?? null;
});

ipcMain.handle('notes:updateTitle', async (_event, id: number, title: string) => {
  db.updateNoteTitle(id, title);
});

ipcMain.handle('notes:updateContent', async (_event, id: number, content: string) => {
  db.updateNoteContent(id, content);
});

ipcMain.handle('notes:delete', async (_event, id: number) => {
  db.deleteNote(id);
});

// ── App lifecycle ──
app.on('ready', () => {
  createWindow();
  createOverlayWindow();
  createTray();

  const settings = loadSettings();
  registerShortcut(settings.shortcut);
});

(app as Electron.App & { isQuitting: boolean }).isQuitting = false;

app.on('before-quit', () => {
  (app as Electron.App & { isQuitting: boolean }).isQuitting = true;
  db.closeDb();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
