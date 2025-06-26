import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY!,
});

/**
 * Generates a chat completion via OpenRouter.
 */
export async function generate(prompt: string): Promise<string> {
  const model = process.env.LLM_MODEL!;
  const response = await openai.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
  });
  return response.choices[0].message.content ?? "";
}
