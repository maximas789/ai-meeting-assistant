import { createOpenAI } from "@ai-sdk/openai";

// Configuration constants for optimal performance
const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";
const OLLAMA_FAST_MODEL = process.env.OLLAMA_FAST_MODEL || "llama3.2:1b";

// Use Ollama's OpenAI-compatible API endpoint
// See: https://ollama.com/blog/openai-compatibility
const ollama = createOpenAI({
  baseURL: `${OLLAMA_BASE_URL}/v1`,
  apiKey: "ollama", // Ollama doesn't require a real API key
  // Custom fetch with connection optimizations
  fetch: async (url, options) => {
    return fetch(url, {
      ...options,
      // Keep connection alive for faster subsequent requests
      keepalive: true,
    });
  },
});

// Default model for general chat
export const model = ollama(OLLAMA_MODEL);

// Default model for general chat (alias)
export const chatModel = ollama(OLLAMA_MODEL);

// Faster model for quick tasks (summarization, etc.)
export const fastModel = ollama(OLLAMA_FAST_MODEL);

/**
 * Pre-warm the Ollama connection by making a lightweight request.
 * Call this during app initialization to reduce first-request latency.
 */
export async function warmupOllama(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: "GET",
      keepalive: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Check if a specific model is loaded in Ollama.
 * Can be used to pre-load models for faster response times.
 */
export async function isModelLoaded(modelName: string): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!response.ok) return false;

    const data = (await response.json()) as {
      models?: Array<{ name: string }>;
    };
    return data.models?.some((m) => m.name.includes(modelName)) ?? false;
  } catch {
    return false;
  }
}

/**
 * Get the base URL for direct Ollama API calls
 */
export function getOllamaBaseUrl(): string {
  return OLLAMA_BASE_URL;
}
