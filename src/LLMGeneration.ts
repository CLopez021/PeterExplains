import { getLlama } from "node-llama-cpp";
import path from "path";
import fs from "fs";

const modelPath =
  process.env.LLM_MODEL_PATH || path.join(process.cwd(), "models", "model.gguf");

if (!fs.existsSync(modelPath)) throw new Error(`Model not found: ${modelPath}`);

export async function generate(prompt: string): Promise<string> {
  const llama   = await getLlama({ modelPath });
  const session = await llama.createChatSession();
  return await session.prompt(prompt);
}
