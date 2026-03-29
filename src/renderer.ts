import './index.css';
import type { Note, Entry } from './types';

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
const entriesContainer = document.getElementById('entries-container')!;
const recordBtn = document.getElementById('record-btn')!;
const recIndicator = document.getElementById('recording-indicator')!;
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

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

// ── Open note ──
async function openNote(id: number) {
  activeNoteId = id;
  const note = await window.openDictate.getNote(id);
  if (!note) return;

  emptyState.style.display = 'none';
  noteView.style.display = 'flex';
  noteTitle.value = note.title;

  await refreshEntries();
  await refreshNotesList();
}

// ── Entries ──
async function refreshEntries() {
  if (!activeNoteId) return;
  const entries = await window.openDictate.getEntries(activeNoteId);
  entriesContainer.innerHTML = '';

  for (const entry of entries) {
    entriesContainer.appendChild(createEntryCard(entry));
  }

  scrollToBottom();
}

function createEntryCard(entry: Entry): HTMLElement {
  const card = document.createElement('div');
  card.className = 'entry-card';
  card.dataset.entryId = String(entry.id);

  const header = document.createElement('div');
  header.className = 'entry-header';

  const time = document.createElement('span');
  time.className = 'entry-time';
  time.textContent = formatTime(entry.created_at);

  const actions = document.createElement('div');
  actions.className = 'entry-actions';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn-icon';
  copyBtn.title = 'Copy';
  copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(textarea.value);
    copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
    setTimeout(() => {
      copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    }, 1500);
  });

  const delBtn = document.createElement('button');
  delBtn.className = 'btn-icon btn-danger';
  delBtn.title = 'Delete';
  delBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
  delBtn.addEventListener('click', async () => {
    await window.openDictate.deleteEntry(entry.id);
    card.remove();
    showSaveStatus('Entry deleted');
  });

  actions.append(copyBtn, delBtn);
  header.append(time, actions);

  const textarea = document.createElement('textarea');
  textarea.className = 'entry-content';
  textarea.value = entry.content;
  textarea.placeholder = 'Empty entry...';
  textarea.rows = 1;

  // Auto-resize
  const autoResize = () => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  };

  textarea.addEventListener('input', () => {
    autoResize();
    showSaveStatus('Saving...');
    debounce(`entry-${entry.id}`, async () => {
      await window.openDictate.updateEntry(entry.id, textarea.value);
      showSaveStatus('All changes saved');
    });
  });

  // Resize after append
  requestAnimationFrame(autoResize);

  card.append(header, textarea);
  return card;
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    entriesContainer.scrollTop = entriesContainer.scrollHeight;
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

  const noteId = activeNoteId;

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
    const response = await window.openDictate.sendAudio(result.buffer, result.durationMs, noteId);

    if (response.success) {
      await refreshEntries();
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
    window.openDictate.onStopRecording; // handled via IPC below
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

// IPC event handlers from global shortcut
window.openDictate.onStartRecording(() => startRecording());
window.openDictate.onStopRecording(() => stopRecordingAndTranscribe());
window.openDictate.onStateChange((state) => updateRecordingState(state));

// ── Init ──
(async () => {
  await refreshConfig();
  await refreshNotesList();
})();
