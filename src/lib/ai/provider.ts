/**
 * Vercel AI SDK provider for the OpenAI-compatible endpoint configured via
 * LOCAL_LLM_URL / LOCAL_LLM_MODEL / LOCAL_LLM_CLIENT_KEY.
 *
 * The SDK owns the tool-calling loop, message replay and retries, so routes
 * describe tools and let `generateText` drive. LOCAL_LLM_URL points at the
 * full `/v1/chat/completions` path, while the SDK wants the base URL, so the
 * suffix is stripped here.
 */
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export interface LlmEnv {
  baseURL: string;
  model: string;
  apiKey: string;
}

/** Throws when any of the three env vars is missing, so routes fail loudly. */
export function llmEnv(): LlmEnv {
  const url = process.env.LOCAL_LLM_URL;
  const model = process.env.LOCAL_LLM_MODEL;
  const apiKey = process.env.LOCAL_LLM_CLIENT_KEY;
  if (!url || !model || !apiKey) throw new Error("LLM configuration missing");
  return { baseURL: url.replace(/\/chat\/completions\/?$/, ""), model, apiKey };
}

/** Chat model handle for `generateText` / `streamText`. */
export function chatModel() {
  const env = llmEnv();
  const provider = createOpenAICompatible({
    name: "local-llm",
    baseURL: env.baseURL,
    apiKey: env.apiKey,
  });
  return provider.chatModel(env.model);
}
