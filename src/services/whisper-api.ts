export async function transcribeWhisper(
  audioBuffer: Buffer,
  apiUrl: string,
  apiKey: string,
  model: string
): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/webm;codecs=opus' });
  formData.append('file', blob, 'audio.webm');
  formData.append('model', model);

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  // === TEMP DEBUG LOGGING ===
  console.log('[DEBUG][whisper-api] REQUEST:', {
    url: apiUrl,
    method: 'POST',
    model,
    hasApiKey: !!apiKey,
  });

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: formData,
  });

  // === TEMP DEBUG LOGGING ===
  const responseBody = await response.text();
  console.log('[DEBUG][whisper-api] RESPONSE:', {
    status: response.status,
    statusText: response.statusText,
    body: responseBody.slice(0, 1000),
  });

  if (!response.ok) {
    throw new Error(`Whisper API failed (${response.status}): ${responseBody.slice(0, 200)}`);
  }

  const result = JSON.parse(responseBody) as { text?: string };
  const text = result.text?.trim();

  if (!text) {
    throw new Error('No transcription text received from Whisper API');
  }

  return text;
}
