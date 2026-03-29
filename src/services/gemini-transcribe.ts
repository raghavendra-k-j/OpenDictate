export async function transcribeGemini(
  audioBuffer: Buffer,
  apiKey: string,
  model: string
): Promise<string> {
  const base64Audio = Buffer.from(audioBuffer).toString('base64');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

  // === TEMP DEBUG LOGGING ===
  console.log('[DEBUG][gemini-transcribe] REQUEST:', {
    url: url.replace(apiKey, apiKey.slice(0, 6) + '...'),
    method: 'POST',
    audioSize: base64Audio.length,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: 'audio/webm',
                data: base64Audio,
              },
            },
            {
              text: 'Transcribe this audio exactly as spoken. Return ONLY the transcribed text, nothing else.',
            },
          ],
        },
      ],
    }),
  });

  // === TEMP DEBUG LOGGING ===
  const responseBody = await response.text();
  console.log('[DEBUG][gemini-transcribe] RESPONSE:', {
    status: response.status,
    statusText: response.statusText,
    body: responseBody.slice(0, 1000),
  });

  if (!response.ok) {
    throw new Error(`Gemini transcription failed (${response.status}): ${responseBody.slice(0, 200)}`);
  }

  const result = JSON.parse(responseBody) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  if (!text) {
    throw new Error('No transcription text received from Gemini');
  }

  return text;
}
