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

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Whisper API failed (${response.status}): ${body.slice(0, 200)}`);
  }

  const result = await response.json() as { text?: string };
  const text = result.text?.trim();

  if (!text) {
    throw new Error('No transcription text received from Whisper API');
  }

  return text;
}
