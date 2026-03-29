import type { ParsedCurl } from '../types';

export async function transcribe(
  audioBuffer: Buffer,
  durationMs: number,
  config: ParsedCurl
): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/webm;codecs=opus' });
  formData.append('file', blob, 'whisper.webm');
  formData.append('duration_ms', durationMs.toString());

  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(config.headers)) {
    // Skip content-type — FormData sets its own multipart boundary
    if (key.toLowerCase() === 'content-type') continue;
    // Skip content-length — will be auto-calculated
    if (key.toLowerCase() === 'content-length') continue;
    headers[key] = value;
  }

  if (config.cookies) {
    headers['cookie'] = config.cookies;
  }

  // === TEMP DEBUG LOGGING ===
  console.log('[DEBUG][transcription] REQUEST:', {
    url: config.url,
    method: 'POST',
    headers: Object.keys(headers),
    hasCookies: !!config.cookies,
  });

  const response = await fetch(config.url, {
    method: 'POST',
    headers,
    body: formData,
  });

  // === TEMP DEBUG LOGGING ===
  const responseBody = await response.text();
  console.log('[DEBUG][transcription] RESPONSE:', {
    status: response.status,
    statusText: response.statusText,
    body: responseBody.slice(0, 1000),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Session expired. Please paste a fresh cURL command.');
    }
    throw new Error(`Transcription failed (${response.status}): ${responseBody.slice(0, 200)}`);
  }

  const result = JSON.parse(responseBody) as Record<string, unknown>;
  const text = (result.text ?? result.transcript ?? '') as string;

  if (!text) {
    throw new Error('No transcription text received from API');
  }

  return text;
}
