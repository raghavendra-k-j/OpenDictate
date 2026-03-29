export async function refineText(
  text: string,
  apiKey: string,
  apiUrl: string,
  model: string,
  systemPrompt: string
): Promise<string> {
  const requestBody = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ],
  };

  // === TEMP DEBUG LOGGING ===
  console.log('[DEBUG][gemini-refine] REQUEST:', {
    url: apiUrl,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey.slice(0, 6)}...` },
    body: requestBody,
  });

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  // === TEMP DEBUG LOGGING ===
  const responseBody = await response.text();
  console.log('[DEBUG][gemini-refine] RESPONSE:', {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    body: responseBody.slice(0, 1000),
  });

  if (!response.ok) {
    throw new Error(`AI refinement failed (${response.status}): ${responseBody.slice(0, 200)}`);
  }

  const result = JSON.parse(responseBody) as { choices?: { message?: { content?: string } }[] };
  const refined = result.choices?.[0]?.message?.content?.trim();
  return refined || text;
}
