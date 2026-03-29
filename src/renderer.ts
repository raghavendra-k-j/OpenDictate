import './index.css';

// ── Tab switching ──
const tabBtns = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
const tabPanels = document.querySelectorAll<HTMLElement>('.tab-panel');
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    tabPanels.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const panel = document.getElementById(`tab-${btn.dataset.tab}`);
    if (panel) panel.classList.add('active');
  });
});

// ── DOM refs ──
const providerSelect = document.getElementById('provider-select') as HTMLSelectElement;
const curlInput = document.getElementById('curl-input') as HTMLTextAreaElement;
const saveCurlBtn = document.getElementById('save-curl-btn')!;
const clearCurlBtn = document.getElementById('clear-curl-btn')!;
const settingsStatus = document.getElementById('settings-status')!;
const configBadge = document.getElementById('config-badge')!;
const configBadgeText = document.getElementById('config-badge-text')!;
const shortcutInput = document.getElementById('shortcut-input') as HTMLInputElement;
const openOverlayBtn = document.getElementById('open-overlay-btn')!;
const saveShortcutBtn = document.getElementById('save-shortcut-btn')!;
const overlayPositionSelect = document.getElementById('overlay-position') as HTMLSelectElement;
const shortcutStatus = document.getElementById('shortcut-status')!;
const whisperApiUrlInput = document.getElementById('whisper-api-url') as HTMLInputElement;
const whisperApiKeyInput = document.getElementById('whisper-api-key') as HTMLInputElement;
const whisperModelInput = document.getElementById('whisper-model') as HTMLInputElement;
const saveWhisperBtn = document.getElementById('save-whisper-btn')!;
const whisperStatus = document.getElementById('whisper-status')!;
const geminiApiKeyInput = document.getElementById('gemini-api-key') as HTMLInputElement;
const geminiModelInput = document.getElementById('gemini-model') as HTMLInputElement;
const saveGeminiBtn = document.getElementById('save-gemini-btn')!;
const geminiStatus = document.getElementById('gemini-status')!;
const aiApiKeyInput = document.getElementById('ai-api-key') as HTMLInputElement;
const aiApiUrlInput = document.getElementById('ai-api-url') as HTMLInputElement;
const aiModelInput = document.getElementById('ai-model') as HTMLInputElement;
const aiSystemPromptInput = document.getElementById('ai-system-prompt') as HTMLTextAreaElement;
const saveAiBtn = document.getElementById('save-ai-btn')!;
const aiStatus = document.getElementById('ai-status')!;

let pendingShortcut = '';

// ── Provider selection ──
providerSelect.addEventListener('change', async () => {
  const provider = providerSelect.value;
  await window.openDictate.saveSettings({ transcriptionProvider: provider as any });
  await refreshConfig();
});

// ── Config badge ──
async function refreshConfig() {
  const settings = await window.openDictate.getSettings();
  const provider = settings.transcriptionProvider;
  let ready = false;

  switch (provider) {
    case 'web-speech':
    case 'windows-speech':
      ready = true;
      break;
    case 'curl': {
      const result = await window.openDictate.loadConfig();
      ready = result.configured;
      break;
    }
    case 'whisper-api':
      ready = !!(settings.whisperApiUrl);
      break;
    case 'gemini':
      ready = !!(settings.geminiApiKey);
      break;
  }

  if (ready) {
    configBadge.className = 'config-badge connected';
    configBadgeText.textContent = 'Ready';
  } else {
    configBadge.className = 'config-badge disconnected';
    configBadgeText.textContent = 'Not configured';
  }
}

// ── Open Overlay ──
openOverlayBtn.addEventListener('click', () => {
  window.openDictate.toggleOverlay();
});

// ── cURL ──
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
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return null;

  if (key === ' ') parts.push('Space');
  else if (key.length === 1) parts.push(key.toUpperCase());
  else parts.push(key);

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
  settings.overlayPosition = overlayPositionSelect.value;

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

// ── AI settings ──
saveAiBtn.addEventListener('click', async () => {
  saveAiBtn.setAttribute('disabled', '');
  const result = await window.openDictate.saveSettings({
    aiApiKey: aiApiKeyInput.value.trim(),
    aiApiUrl: aiApiUrlInput.value.trim() || 'https://api.openai.com/v1/chat/completions',
    aiModel: aiModelInput.value.trim() || 'gpt-4o-mini',
    systemPrompt: aiSystemPromptInput.value.trim(),
  });
  saveAiBtn.removeAttribute('disabled');

  if (result.success) {
    aiStatus.textContent = 'AI settings saved!';
    aiStatus.className = 'settings-msg success';
  } else {
    aiStatus.textContent = result.error ?? 'Failed to save';
    aiStatus.className = 'settings-msg error';
  }
});

// ── Whisper API settings ──
saveWhisperBtn.addEventListener('click', async () => {
  saveWhisperBtn.setAttribute('disabled', '');
  const result = await window.openDictate.saveSettings({
    whisperApiUrl: whisperApiUrlInput.value.trim() || 'https://api.openai.com/v1/audio/transcriptions',
    whisperApiKey: whisperApiKeyInput.value.trim(),
    whisperModel: whisperModelInput.value.trim() || 'whisper-1',
  });
  saveWhisperBtn.removeAttribute('disabled');

  if (result.success) {
    whisperStatus.textContent = 'Whisper settings saved!';
    whisperStatus.className = 'settings-msg success';
  } else {
    whisperStatus.textContent = result.error ?? 'Failed to save';
    whisperStatus.className = 'settings-msg error';
  }
  await refreshConfig();
});

// ── Gemini settings ──
saveGeminiBtn.addEventListener('click', async () => {
  saveGeminiBtn.setAttribute('disabled', '');
  const result = await window.openDictate.saveSettings({
    geminiApiKey: geminiApiKeyInput.value.trim(),
    geminiModel: geminiModelInput.value.trim() || 'gemini-2.0-flash',
  });
  saveGeminiBtn.removeAttribute('disabled');

  if (result.success) {
    geminiStatus.textContent = 'Gemini settings saved!';
    geminiStatus.className = 'settings-msg success';
  } else {
    geminiStatus.textContent = result.error ?? 'Failed to save';
    geminiStatus.className = 'settings-msg error';
  }
  await refreshConfig();
});

// ── Load settings into UI ──
async function loadSettingsUI() {
  const settings = await window.openDictate.getSettings();
  providerSelect.value = settings.transcriptionProvider;
  shortcutInput.value = settings.shortcut;
  overlayPositionSelect.value = settings.overlayPosition;
  whisperApiUrlInput.value = settings.whisperApiUrl;
  whisperApiKeyInput.value = settings.whisperApiKey;
  whisperModelInput.value = settings.whisperModel;
  geminiApiKeyInput.value = settings.geminiApiKey;
  geminiModelInput.value = settings.geminiModel;
  aiApiKeyInput.value = settings.aiApiKey;
  aiApiUrlInput.value = settings.aiApiUrl;
  aiModelInput.value = settings.aiModel;
  aiSystemPromptInput.value = settings.systemPrompt;

  // Show saved cURL config in the textarea
  const curlConfig = await window.openDictate.loadConfig();
  if (curlConfig.configured) {
    const headers = curlConfig.headers || {};
    const parts: string[] = [`curl '${curlConfig.url}'`];
    for (const [k, v] of Object.entries(headers)) {
      parts.push(`  -H '${k}: ${v}'`);
    }
    if (curlConfig.cookies) {
      parts.push(`  -b '${curlConfig.cookies}'`);
    }
    curlInput.value = parts.join(' \\\n');
    settingsStatus.textContent = 'Configuration loaded from saved data';
    settingsStatus.className = 'settings-msg success';
  }
}

// ── Init ──
(async () => {
  await refreshConfig();
  await loadSettingsUI();
})();
