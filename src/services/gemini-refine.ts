import { GoogleGenAI } from '@google/genai';

export async function refineText(
  text: string,
  apiKey: string,
  model: string,
  systemPrompt: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: text,
    config: {
      systemInstruction: systemPrompt,
    },
  });
  return response.text?.trim() || text;
}
