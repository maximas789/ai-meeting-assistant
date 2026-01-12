import { NextResponse } from "next/server";
import { generateText } from "ai";
import { chatModel } from "@/lib/ollama";

export async function GET() {
  try {
    const ollamaBaseUrl =
      process.env.OLLAMA_BASE_URL || "http://localhost:11434";

    // First check if Ollama is reachable
    const healthCheck = await fetch(`${ollamaBaseUrl}/api/tags`, {
      method: "GET",
    }).catch(() => null);

    if (!healthCheck || !healthCheck.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "Ollama not reachable",
          hint: "Make sure Ollama is running with: ollama serve",
        },
        { status: 503 }
      );
    }

    // Try to generate a simple response
    const { text } = await generateText({
      model: chatModel,
      prompt: "Say 'Hello from Ollama!' in exactly 5 words or less.",
    });

    return NextResponse.json({
      success: true,
      message: "Ollama is working correctly",
      response: text.trim(),
      model: process.env.OLLAMA_MODEL || "llama3.2",
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        hint: "Check that the model is downloaded: ollama pull llama3.2",
      },
      { status: 500 }
    );
  }
}
