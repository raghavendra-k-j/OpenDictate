export async function transcribeGemini(
  audioBuffer: Buffer,
  apiKey: string,
  model: string
): Promise<string> {
  const base64Audio = Buffer.from(audioBuffer).toString('base64');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

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

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Gemini transcription failed (${response.status}): ${body.slice(0, 200)}`);
  }

  const result = await response.json() as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  if (!text) {
    throw new Error('No transcription text received from Gemini');
  }

  return text;
}
