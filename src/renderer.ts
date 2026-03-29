import './index.css';

// ── State ──
let activeNoteId: number | null = null;
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: BlobPart[] = [];
let recordingStartTime = 0;
let autoSaveTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

// ── DOM refs ──
const notesList = document.getElementById('notes-list')!;
const newNoteBtn = document.getElementById('new-note-btn')!;
const emptyState = document.getElementById('empty-state')!;
const noteView = document.getElementById('note-view')!;
const noteTitle = document.getElementById('note-title') as HTMLInputElement;
const noteContent = document.getElementById('note-content') as HTMLTextAreaElement;
const recordBtn = document.getElementById('record-btn')!;
const recIndicator = document.getElementById('recording-indicator')!;
const copyNoteBtn = document.getElementById('copy-note-btn')!;
const deleteNoteBtn = document.getElementById('delete-note-btn')!;
const saveStatus = document.getElementById('save-status')!;
const settingsModal = document.getElementById('settings-modal')!;
const settingsBtn = document.getElementById('settings-btn')!;
const closeSettings = document.getElementById('close-settings')!;
const curlInput = document.getElementById('curl-input') as HTMLTextAreaElement;
const saveCurlBtn = document.getElementById('save-curl-btn')!;
const clearCurlBtn = document.getElementById('clear-curl-btn')!;
const settingsStatus = document.getElementById('settings-status')!;
const configBadge = document.getElementById('config-badge')!;
const configBadgeText = document.getElementById('config-badge-text')!;
const shortcutInput = document.getElementById('shortcut-input') as HTMLInputElement;
const saveShortcutBtn = document.getElementById('save-shortcut-btn')!;
const overlayCornerSelect = document.getElementById('overlay-corner') as HTMLSelectElement;
const shortcutStatus = document.getElementById('shortcut-status')!;
const geminiApiKeyInput = document.getElementById('gemini-api-key') as HTMLInputElement;
const geminiModelInput = document.getElementById('gemini-model') as HTMLInputElement;
const geminiSystemPromptInput = document.getElementById('gemini-system-prompt') as HTMLTextAreaElement;
const saveGeminiBtn = document.getElementById('save-gemini-btn')!;
const geminiStatus = document.getElementById('gemini-status')!;

let pendingShortcut = '';

// ── Helpers ──
function formatTime(iso: string): string {
  const d = new Date(iso + 'Z');
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function showSaveStatus(text: string) {
  saveStatus.textContent = text;
}

function debounce(key: string, fn: () => void, ms = 600) {
  const existing = autoSaveTimers.get(key);
  if (existing) clearTimeout(existing);
  autoSaveTimers.set(key, setTimeout(() => {
    fn();
    autoSaveTimers.delete(key);
  }, ms));
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

// ── Notes sidebar ──
async function refreshNotesList() {
  const notes = await window.openDictate.getAllNotes();
  notesList.innerHTML = '';

  for (const note of notes) {
    const btn = document.createElement('button');
    btn.className = 'note-item' + (note.id === activeNoteId ? ' active' : '');
    btn.innerHTML = `
      <span class="note-item-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      </span>
      <span class="note-item-text">${escapeHtml(note.title || 'Untitled note')}</span>
      <span class="note-item-time">${formatTime(note.updated_at)}</span>
    `;
    btn.addEventListener('click', () => openNote(note.id));
    notesList.appendChild(btn);
  }
}

// ── Open note ──
async function openNote(id: number) {
  activeNoteId = id;
  const note = await window.openDictate.getNote(id);
  if (!note) return;

  emptyState.style.display = 'none';
  noteView.style.display = 'flex';
  noteTitle.value = note.title;
  noteContent.value = note.content;

  await refreshNotesList();
}

// ── Insert text at cursor position ──
function insertAtCursor(text: string) {
  const start = noteContent.selectionStart;
  const end = noteContent.selectionEnd;
  const before = noteContent.value.substring(0, start);
  const after = noteContent.value.substring(end);

  // Add a space before if there's existing text and no trailing space/newline
  const separator = before.length > 0 && !/[\s\n]$/.test(before) ? ' ' : '';

  noteContent.value = before + separator + text + after;

  // Place cursor after inserted text
  const newPos = start + separator.length + text.length;
  noteContent.selectionStart = newPos;
  noteContent.selectionEnd = newPos;
  noteContent.focus();

  // Trigger auto-save
  saveNoteContent();
}

function saveNoteContent() {
  if (!activeNoteId) return;
  const id = activeNoteId;
  showSaveStatus('Saving...');
  debounce('note-content', async () => {
    await window.openDictate.updateNoteContent(id, noteContent.value);
    showSaveStatus('All changes saved');
    await refreshNotesList();
  });
}

// ── Recording ──
async function startRecording() {
  if (!activeNoteId) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    mediaRecorder = new MediaRecorder(stream, { mimeType });
    audioChunks = [];
    recordingStartTime = Date.now();

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.start(100);
    recordBtn.classList.add('recording');
    recIndicator.style.display = 'flex';
  } catch (err) {
    showSaveStatus(`Mic error: ${err instanceof Error ? err.message : err}`);
  }
}

async function stopRecordingAndTranscribe() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive' || !activeNoteId) return;

  recordBtn.classList.remove('recording');
  recordBtn.classList.add('processing');
  recIndicator.style.display = 'none';

  const result = await new Promise<{ buffer: ArrayBuffer; durationMs: number }>((resolve) => {
    mediaRecorder!.onstop = async () => {
      const durationMs = Date.now() - recordingStartTime;
      const blob = new Blob(audioChunks, { type: mediaRecorder!.mimeType });
      const buffer = await blob.arrayBuffer();
      mediaRecorder!.stream.getTracks().forEach((t) => t.stop());
      resolve({ buffer, durationMs });
    };
    mediaRecorder!.stop();
  });

  try {
    showSaveStatus('Transcribing...');
    const response = await window.openDictate.sendAudio(result.buffer, result.durationMs);

    if (response.success && response.text) {
      insertAtCursor(response.text);
      showSaveStatus('All changes saved');
    } else {
      showSaveStatus(response.error ?? 'Transcription failed');
    }
  } catch (err) {
    showSaveStatus(`Error: ${err instanceof Error ? err.message : err}`);
  }

  recordBtn.classList.remove('processing');
}

function updateRecordingState(state: string) {
  if (state === 'idle') {
    recordBtn.classList.remove('recording', 'processing');
    recIndicator.style.display = 'none';
  } else if (state === 'recording') {
    recordBtn.classList.add('recording');
    recordBtn.classList.remove('processing');
    recIndicator.style.display = 'flex';
  } else if (state === 'processing') {
    recordBtn.classList.remove('recording');
    recordBtn.classList.add('processing');
    recIndicator.style.display = 'none';
  }
}

// ── Config ──
async function refreshConfig() {
  const result = await window.openDictate.loadConfig();
  if (result.configured) {
    configBadge.className = 'config-badge connected';
    configBadgeText.textContent = 'Connected';
  } else {
    configBadge.className = 'config-badge disconnected';
    configBadgeText.textContent = 'Not connected';
  }
}

// ── Event listeners ──
newNoteBtn.addEventListener('click', async () => {
  const note = await window.openDictate.createNote('');
  await refreshNotesList();
  await openNote(note.id);
  noteTitle.focus();
});

noteTitle.addEventListener('input', () => {
  if (!activeNoteId) return;
  const id = activeNoteId;
  showSaveStatus('Saving...');
  debounce('note-title', async () => {
    await window.openDictate.updateNoteTitle(id, noteTitle.value);
    showSaveStatus('All changes saved');
    await refreshNotesList();
  });
});

noteContent.addEventListener('input', () => {
  saveNoteContent();
});

copyNoteBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(noteContent.value);
  const origInnerHTML = copyNoteBtn.innerHTML;
  copyNoteBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
  setTimeout(() => {
    copyNoteBtn.innerHTML = origInnerHTML;
  }, 1500);
});

deleteNoteBtn.addEventListener('click', async () => {
  if (!activeNoteId) return;
  await window.openDictate.deleteNote(activeNoteId);
  activeNoteId = null;
  noteView.style.display = 'none';
  emptyState.style.display = 'flex';
  await refreshNotesList();
});

recordBtn.addEventListener('click', () => {
  if (!activeNoteId) return;
  if (recordBtn.classList.contains('recording')) {
    stopRecordingAndTranscribe();
  } else if (!recordBtn.classList.contains('processing')) {
    startRecording();
  }
});

// Settings
settingsBtn.addEventListener('click', () => {
  settingsModal.style.display = 'flex';
  settingsStatus.textContent = '';
  settingsStatus.className = 'settings-msg';
});

closeSettings.addEventListener('click', () => {
  settingsModal.style.display = 'none';
});

settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) settingsModal.style.display = 'none';
});

saveCurlBtn.addEventListener('click', async () => {
  const text = curlInput.value.trim();
  if (!text) return;

  saveCurlBtn.setAttribute('disabled', '');
  const result = await window.openDictate.saveCurlConfig(text);

  if (result.success) {
    curlInput.value = '';
    settingsStatus.textContent = 'Configuration saved!';
    settingsStatus.className = 'settings-msg success';
  } else {
    settingsStatus.textContent = result.error ?? 'Failed to save';
    settingsStatus.className = 'settings-msg error';
  }

  saveCurlBtn.removeAttribute('disabled');
  await refreshConfig();
});

clearCurlBtn.addEventListener('click', async () => {
  await window.openDictate.clearConfig();
  settingsStatus.textContent = 'Configuration cleared';
  settingsStatus.className = 'settings-msg success';
  await refreshConfig();
});

// ── Shortcut recorder ──
function keyEventToAccelerator(e: KeyboardEvent): string | null {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');

  const key = e.key;
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return null; // modifiers only

  if (key === ' ') parts.push('Space');
  else if (key.length === 1) parts.push(key.toUpperCase());
  else parts.push(key); // F1, F2, etc.

  return parts.join('+');
}

shortcutInput.addEventListener('keydown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  shortcutInput.classList.add('recording-keys');
  const accel = keyEventToAccelerator(e);
  if (accel) {
    pendingShortcut = accel;
    shortcutInput.value = accel;
    shortcutInput.classList.remove('recording-keys');
  }
});

shortcutInput.addEventListener('blur', () => {
  shortcutInput.classList.remove('recording-keys');
});

saveShortcutBtn.addEventListener('click', async () => {
  const settings: Record<string, unknown> = {};
  if (pendingShortcut) settings.shortcut = pendingShortcut;
  settings.overlayCorner = overlayCornerSelect.value;

  saveShortcutBtn.setAttribute('disabled', '');
  const result = await window.openDictate.saveSettings(settings);
  saveShortcutBtn.removeAttribute('disabled');

  if (result.success) {
    shortcutStatus.textContent = `Saved! Shortcut: ${result.shortcut}`;
    shortcutStatus.className = 'settings-msg success';
    pendingShortcut = '';
  } else {
    shortcutStatus.textContent = result.error ?? 'Failed to save';
    shortcutStatus.className = 'settings-msg error';
  }
});

async function loadSettingsUI() {
  const settings = await window.openDictate.getSettings();
  shortcutInput.value = settings.shortcut;
  overlayCornerSelect.value = settings.overlayCorner;
  geminiApiKeyInput.value = settings.geminiApiKey;
  geminiModelInput.value = settings.geminiModel;
  geminiSystemPromptInput.value = settings.systemPrompt;
}

// IPC event handlers from global shortcut
window.openDictate.onStartRecording(() => startRecording());
window.openDictate.onStopRecording(() => stopRecordingAndTranscribe());
window.openDictate.onStateChange((state) => updateRecordingState(state));

// Gemini settings
saveGeminiBtn.addEventListener('click', async () => {
  saveGeminiBtn.setAttribute('disabled', '');
  const result = await window.openDictate.saveSettings({
    geminiApiKey: geminiApiKeyInput.value.trim(),
    geminiModel: geminiModelInput.value.trim() || 'gemini-2.5-flash',
    systemPrompt: geminiSystemPromptInput.value.trim(),
  });
  saveGeminiBtn.removeAttribute('disabled');

  if (result.success) {
    geminiStatus.textContent = 'Gemini settings saved!';
    geminiStatus.className = 'settings-msg success';
  } else {
    geminiStatus.textContent = result.error ?? 'Failed to save';
    geminiStatus.className = 'settings-msg error';
  }
});

// ── Init ──
(async () => {
  await refreshConfig();
  await refreshNotesList();
  await loadSettingsUI();
})();
