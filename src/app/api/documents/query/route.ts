import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { z } from "zod";
import { queryDocuments, checkChromaDBHealth } from "@/lib/chromadb";
import { chatModel } from "@/lib/ollama";

// Request validation schema
const querySchema = z.object({
  query: z.string().min(1, "Query is required").max(1000, "Query too long"),
  nResults: z.number().int().min(1).max(20).optional().default(5),
  includeContext: z.boolean().optional().default(true),
  generateAnswer: z.boolean().optional().default(false),
});

/**
 * POST /api/documents/query - Query documents using RAG
 */
export async function POST(request: NextRequest) {
  try {
    // Check ChromaDB availability
    const isChromaAvailable = await checkChromaDBHealth();
    if (!isChromaAvailable) {
      return NextResponse.json(
        { error: "Document storage service unavailable" },
        { status: 503 }
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON" },
        { status: 400 }
      );
    }

    const parsed = querySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { query, nResults, includeContext, generateAnswer } = parsed.data;

    // Search ChromaDB for relevant chunks
    const results = await queryDocuments(query, nResults);

    if (results.length === 0) {
      return NextResponse.json({
        query,
        results: [],
        context: null,
        answer: generateAnswer ? "No relevant documents found to answer this question." : undefined,
      });
    }

    // Build context from results
    const context = includeContext
      ? results.map((r) => ({
          text: r.text,
          source: r.source,
          relevance: 1 - r.distance, // Convert distance to similarity
        }))
      : null;

    // Optionally generate an answer using the context
    let answer: string | undefined;
    if (generateAnswer) {
      const contextText = results
        .map((r) => `[Source: ${r.source}]\n${r.text}`)
        .join("\n\n---\n\n");

      const ragPrompt = `Use the following context to answer the question. If the answer is not in the context, say so.

Context:
${contextText}

Question: ${query}

Answer:`;

      try {
        const response = await generateText({
          model: chatModel,
          prompt: ragPrompt,
        });
        answer = response.text;
      } catch (llmError) {
        console.error("LLM generation failed:", llmError);
        answer = "Unable to generate answer. Please try again.";
      }
    }

    return NextResponse.json({
      query,
      results: results.map((r) => ({
        text: r.text,
        source: r.source,
        documentId: r.documentId,
        relevance: Math.round((1 - r.distance) * 100) / 100,
      })),
      context,
      answer,
    });
  } catch (error) {
    console.error("Document query failed:", error);
    return NextResponse.json(
      { error: "Failed to query documents" },
      { status: 500 }
    );
  }
}
