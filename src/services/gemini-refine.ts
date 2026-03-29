export async function refineText(
  text: string,
  apiKey: string,
  apiUrl: string,
  model: string,
  systemPrompt: string
): Promise<string> {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`AI refinement failed (${response.status}): ${body.slice(0, 200)}`);
  }

  const result = await response.json() as { choices?: { message?: { content?: string } }[] };
  const refined = result.choices?.[0]?.message?.content?.trim();
  return refined || text;
}
