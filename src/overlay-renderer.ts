import './overlay.css';
import type { OverlayMode } from './types';

// Lucide-style SVG icons (16×16)
const MIC_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
const PAUSE_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
const CHECK_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
const SPARKLE_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/></svg>';
const SPINNER_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 2a10 10 0 0 1 10 10"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/></path></svg>';
const CHECK_BIG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
const RETRY_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>';
const INFO_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
const COPY_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const X_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

type OverlayState = 'idle' | 'recording' | 'paused' | 'processing' | 'success' | 'error';

let mediaRecorder: MediaRecorder | null = null;
let audioChunks: BlobPart[] = [];
let recordingMs = 0;
let segmentStart = 0;
let timerInterval: ReturnType<typeof setInterval> | null = null;
let currentState: OverlayState = 'idle';
let isDragging = false;
let geminiConfigured = false;
let lastMode: OverlayMode = 'transcribe';
let lastAudioBuffer: ArrayBuffer | null = null;
let lastDurationMs = 0;
let lastErrorMessage = '';
let lastErrorCode = 'unknown';
let lastErrorDetail = '';
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let analyserSource: MediaStreamAudioSourceNode | null = null;
let waveAnimFrame: number | null = null;

const widget = document.getElementById('overlay-widget')!;
const micBtn = document.getElementById('mic-btn')!;
const timerEl = document.getElementById('timer')!;
const doneBtn = document.getElementById('done-btn')!;
const refineBtn = document.getElementById('refine-btn')!;
const closeBtn = document.getElementById('close-btn')!;

// Store original widget HTML for restoring after success/error
const originalWidgetHTML = widget.innerHTML;

// ── Timer ──
function getElapsedMs(): number {
  if (currentState === 'recording' && segmentStart > 0) {
    return recordingMs + (Date.now() - segmentStart);
  }
  return recordingMs;
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

function tickTimer() {
  document.getElementById('timer')!.textContent = formatTime(getElapsedMs());
}

function startTimerTick() {
  segmentStart = Date.now();
  timerInterval = setInterval(tickTimer, 200);
}

function stopTimerTick() {
  if (segmentStart > 0) { recordingMs += Date.now() - segmentStart; }
  segmentStart = 0;
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  tickTimer();
}

// ── Error labels ──
const ERROR_LABELS: Record<string, string> = {
  'no-internet':    'No internet',
  'auth-failed':    'Auth failed',
  'rate-limited':   'Rate limited',
  'no-text':        'No speech detected',
  'gemini-error':   'AI error',
  'not-configured': 'Not configured',
  'mic-denied':     'Mic denied',
  'api-error':      'Server error',
  'unknown':        'Error',
};

function getErrorLabel(code: string): string {
  return ERROR_LABELS[code] ?? (lastErrorMessage.length > 25 ? lastErrorMessage.slice(0, 22) + '...' : lastErrorMessage);
}

// ── State ──
function restoreWidget() {
  widget.innerHTML = originalWidgetHTML;
  rebindElements();
}

function rebindElements() {
  const mic = document.getElementById('mic-btn');
  const done = document.getElementById('done-btn');
  const refine = document.getElementById('refine-btn');
  const close = document.getElementById('close-btn');

  if (mic) bindMicBtn(mic);
  if (done) bindDoneBtn(done);
  if (refine) bindRefineBtn(refine);
  if (close) bindCloseBtn(close);
}

function setState(state: OverlayState) {
  currentState = state;

  if (state === 'success') {
    widget.className = 'success';
    widget.innerHTML = `<div class="result-icon">${CHECK_BIG}</div>`;
    return;
  }

  if (state === 'error') {
    widget.className = 'error';
    const label = getErrorLabel(lastErrorCode);
    const safeDetail = lastErrorDetail
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const safeTitle = lastErrorMessage.replace(/"/g, '&quot;');
    widget.innerHTML = `
      <div class="error-bar">
        <span class="error-label" title="${safeTitle}">${label}</span>
        <button class="info-btn" title="View error details">${INFO_SVG}</button>
        <button class="retry-btn" title="Retry">${RETRY_SVG}</button>
        <button class="error-close-btn" title="Dismiss">${X_SVG}</button>
      </div>
      <div class="error-detail-panel">
        <pre class="error-stack">${safeDetail}</pre>
        <button class="copy-detail-btn">${COPY_SVG} Copy</button>
      </div>
    `;

    let detailOpen = false;
    const infoBtn = widget.querySelector('.info-btn') as HTMLElement;
    const detailPanel = widget.querySelector('.error-detail-panel') as HTMLElement;
    const copyBtn = widget.querySelector('.copy-detail-btn') as HTMLElement;

    infoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      detailOpen = !detailOpen;
      infoBtn.classList.toggle('active', detailOpen);
      detailPanel.classList.toggle('visible', detailOpen);
      window.overlayAPI.resizeOverlay(detailOpen ? 140 : 52);
    });

    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.overlayAPI.copyToClipboard(lastErrorDetail);
      copyBtn.classList.add('copied');
      copyBtn.innerHTML = '&#10003; Copied!';
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyBtn.innerHTML = `${COPY_SVG} Copy`;
      }, 1500);
    });

    widget.querySelector('.retry-btn')!.addEventListener('click', (e) => {
      e.stopPropagation();
      if (detailOpen) window.overlayAPI.resizeOverlay(52);
      retryLastTranscription();
    });

    widget.querySelector('.error-close-btn')!.addEventListener('click', (e) => {
      e.stopPropagation();
      if (detailOpen) window.overlayAPI.resizeOverlay(52);
      resetToIdle();
    });
    return;
  }

  // If coming back from success/error, restore the full widget
  if (!document.getElementById('mic-btn')) {
    restoreWidget();
  }

  const mic = document.getElementById('mic-btn')!;
  const done = document.getElementById('done-btn')!;
  const refine = document.getElementById('refine-btn')!;

  widget.className = '';

  switch (state) {
    case 'idle':
      widget.classList.add('idle');
      mic.className = 'ctl-btn';
      mic.innerHTML = MIC_SVG;
      mic.title = 'Start Recording';
      done.innerHTML = CHECK_SVG;
      done.className = 'ctl-btn done-btn';
      refine.innerHTML = SPARKLE_SVG;
      refine.className = 'ctl-btn refine-btn';
      document.getElementById('timer')!.textContent = '0:00';
      break;
    case 'recording':
      widget.classList.add('recording-pulse');
      mic.className = 'ctl-btn recording';
      mic.innerHTML = PAUSE_SVG;
      mic.title = 'Pause';
      done.innerHTML = CHECK_SVG;
      done.className = 'ctl-btn done-btn';
      refine.innerHTML = SPARKLE_SVG;
      refine.className = 'ctl-btn refine-btn' + (!geminiConfigured ? ' disabled' : '');
      break;
    case 'paused':
      mic.className = 'ctl-btn paused';
      mic.innerHTML = MIC_SVG;
      mic.title = 'Resume';
      break;
    case 'processing':
      widget.classList.add('processing');
      if (lastMode === 'transcribe-refine') {
        refine.innerHTML = SPINNER_SVG;
        refine.classList.add('spinning');
      } else {
        done.innerHTML = SPINNER_SVG;
        done.classList.add('spinning');
      }
      break;
  }
}

// ── Waveform animation ──
function startWaveform(stream: MediaStream) {
  audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 64;
  analyserSource = audioContext.createMediaStreamSource(stream);
  analyserSource.connect(analyser);

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  const bars = document.querySelectorAll<HTMLElement>('.wave-bar');

  function animate() {
    if (!analyser) return;
    analyser.getByteFrequencyData(dataArray);

    // Map frequency bins to 5 bars
    const binCount = analyser.frequencyBinCount;
    const step = Math.floor(binCount / bars.length);

    bars.forEach((bar, i) => {
      // Average a range of bins for each bar
      let sum = 0;
      for (let j = i * step; j < (i + 1) * step && j < binCount; j++) {
        sum += dataArray[j];
      }
      const avg = sum / step; // 0-255
      const minH = 3;
      const maxH = 20;
      const h = minH + (avg / 255) * (maxH - minH);
      bar.style.height = `${h}px`;
    });

    waveAnimFrame = requestAnimationFrame(animate);
  }

  animate();
}

function stopWaveform() {
  if (waveAnimFrame != null) {
    cancelAnimationFrame(waveAnimFrame);
    waveAnimFrame = null;
  }
  if (analyserSource) {
    analyserSource.disconnect();
    analyserSource = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  analyser = null;

  // Reset bar heights
  document.querySelectorAll<HTMLElement>('.wave-bar').forEach((bar) => {
    bar.style.height = '3px';
  });
}

// ── Recording ──
async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus' : 'audio/webm';

    mediaRecorder = new MediaRecorder(stream, { mimeType });
    audioChunks = [];
    recordingMs = 0;
    lastAudioBuffer = null;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.start(100);
    setState('recording');
    startTimerTick();
    startWaveform(stream);
  } catch (err) {
    lastErrorMessage = err instanceof Error ? err.message : 'Microphone access denied';
    lastErrorCode = 'mic-denied';
    lastErrorDetail = err instanceof Error && err.stack
      ? `Timestamp: ${new Date().toISOString()}\nMessage: ${err.message}\n\nStack trace:\n${err.stack}`
      : `Timestamp: ${new Date().toISOString()}\nMessage: ${lastErrorMessage}`;
    setState('error');
  }
}

function pauseRecording() {
  if (!mediaRecorder || mediaRecorder.state !== 'recording') return;
  mediaRecorder.pause();
  stopTimerTick();
  setState('paused');
  if (audioContext && audioContext.state === 'running') audioContext.suspend();
}

function resumeRecording() {
  if (!mediaRecorder || mediaRecorder.state !== 'paused') return;
  mediaRecorder.resume();
  setState('recording');
  startTimerTick();
  if (audioContext && audioContext.state === 'suspended') audioContext.resume();
}

function resetToIdle() {
  recordingMs = 0;
  segmentStart = 0;
  setState('idle');
}

async function stopAndTranscribe(mode: OverlayMode = 'transcribe') {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return;

  stopTimerTick();
  stopWaveform();
  lastMode = mode;
  setState('processing');

  const durationMs = recordingMs;

  const buffer = await new Promise<ArrayBuffer>((resolve) => {
    mediaRecorder!.onstop = async () => {
      const blob = new Blob(audioChunks, { type: mediaRecorder!.mimeType });
      const buf = await blob.arrayBuffer();
      mediaRecorder!.stream.getTracks().forEach((t) => t.stop());
      resolve(buf);
    };
    mediaRecorder!.stop();
  });

  // Store for retry
  lastAudioBuffer = buffer;
  lastDurationMs = durationMs;

  await sendAndHandle(buffer, durationMs, mode);
}

async function retryLastTranscription() {
  if (!lastAudioBuffer) {
    resetToIdle();
    return;
  }
  setState('processing');
  await sendAndHandle(lastAudioBuffer, lastDurationMs, lastMode);
}

async function sendAndHandle(buffer: ArrayBuffer, durationMs: number, mode: OverlayMode) {
  try {
    const response = await window.overlayAPI.sendAudio(buffer, durationMs, mode);
    if (response.success) {
      setState('success');
      setTimeout(() => resetToIdle(), 800);
    } else {
      lastErrorMessage = response.error || 'Transcription failed';
      lastErrorCode = response.errorCode || 'unknown';
      lastErrorDetail = response.detail || `Timestamp: ${new Date().toISOString()}\nMessage: ${lastErrorMessage}`;
      setState('error');
    }
  } catch (err) {
    lastErrorMessage = err instanceof Error ? err.message : 'Unknown error';
    lastErrorCode = 'unknown';
    lastErrorDetail = err instanceof Error && err.stack
      ? `Timestamp: ${new Date().toISOString()}\nMessage: ${err.message}\n\nStack trace:\n${err.stack}`
      : `Timestamp: ${new Date().toISOString()}\nMessage: ${lastErrorMessage}`;
    setState('error');
  }
}

// ── Button bindings ──
function bindMicBtn(btn: HTMLElement) {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentState === 'idle') startRecording();
    else if (currentState === 'recording') pauseRecording();
    else if (currentState === 'paused') resumeRecording();
  });
}

function bindDoneBtn(btn: HTMLElement) {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentState === 'recording' || currentState === 'paused') stopAndTranscribe('transcribe');
  });
}

function bindRefineBtn(btn: HTMLElement) {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!geminiConfigured) return;
    if (currentState === 'recording' || currentState === 'paused') stopAndTranscribe('transcribe-refine');
  });
}

function bindCloseBtn(btn: HTMLElement) {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    window.overlayAPI.closeOverlay();
  });
}

// Initial bindings
bindMicBtn(micBtn);
bindDoneBtn(doneBtn);
bindRefineBtn(refineBtn);
bindCloseBtn(closeBtn);

// ── Drag ──
widget.addEventListener('mousedown', (e) => {
  if ((e.target as HTMLElement).closest('button')) return;
  isDragging = true;
  widget.classList.add('dragging');
  window.overlayAPI.startDrag();
});

document.addEventListener('mouseup', () => {
  if (!isDragging) return;
  isDragging = false;
  widget.classList.remove('dragging');
  window.overlayAPI.stopDrag();
});

// ── IPC: auto-start from global shortcut ──
window.overlayAPI.onAutoStart(async () => {
  try {
    const status = await window.overlayAPI.getGeminiStatus();
    geminiConfigured = status.configured;
  } catch {
    geminiConfigured = false;
  }
  startRecording();
});

// ── IPC: stop from global shortcut ──
window.overlayAPI.onStop(() => {
  stopAndTranscribe('transcribe');
});

// Start in idle state
setState('idle');
