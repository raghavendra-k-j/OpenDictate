import { app, BrowserWindow, globalShortcut, ipcMain, Menu, Tray } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { parseCurl } from './services/curl-parser';
import { saveConfig, loadConfig, clearConfig } from './services/config-store';
import { transcribe } from './services/transcription';
import { createTrayIcon } from './utils/tray-icons';
import * as db from './services/database';

if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let state: 'idle' | 'recording' | 'processing' = 'idle';

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

function handleShortcut() {
  if (!loadConfig()) {
    mainWindow?.show();
    return;
  }

  if (state === 'idle') {
    updateState('recording');
    mainWindow?.webContents.send('dictation:start');
  } else if (state === 'recording') {
    updateState('processing');
    mainWindow?.webContents.send('dictation:stop');
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
ipcMain.handle('dictation:transcribe', async (_event, audioBuffer: ArrayBuffer, durationMs: number, noteId: number) => {
  try {
    const config = loadConfig();
    if (!config) {
      throw new Error('Not configured. Paste a cURL command first.');
    }

    const text = await transcribe(Buffer.from(audioBuffer), durationMs, config);
    const entry = db.addEntry(noteId, text);

    return { success: true, text, entryId: entry.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Transcription failed';
    return { success: false, error: message };
  } finally {
    updateState('idle');
  }
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

ipcMain.handle('notes:delete', async (_event, id: number) => {
  db.deleteNote(id);
});

// ── Entries IPC ──
ipcMain.handle('entries:getAll', async (_event, noteId: number) => {
  return db.getEntries(noteId);
});

ipcMain.handle('entries:update', async (_event, id: number, content: string) => {
  db.updateEntry(id, content);
});

ipcMain.handle('entries:delete', async (_event, id: number) => {
  db.deleteEntry(id);
});

// ── App lifecycle ──
app.on('ready', () => {
  createWindow();
  createTray();
  globalShortcut.register('CommandOrControl+Shift+Space', handleShortcut);
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
