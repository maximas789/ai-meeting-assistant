import { streamText, UIMessage, convertToModelMessages } from "ai";
import { z } from "zod";
import { queryDocuments, checkChromaDBHealth } from "@/lib/chromadb";
import { chatModel } from "@/lib/ollama";
import { getSetting, getResponseLengthPrompt } from "@/lib/settings";

// Zod schema for message validation
const messagePartSchema = z.object({
  type: z.string(),
  text: z.string().max(10000, "Message text too long").optional(),
});

const messageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(["user", "assistant", "system"]),
  parts: z.array(messagePartSchema).optional(),
  content: z.union([z.string(), z.array(messagePartSchema)]).optional(),
});

const chatRequestSchema = z.object({
  messages: z.array(messageSchema).max(100, "Too many messages"),
  useRAG: z.boolean().optional().default(true),
});

export async function POST(req: Request) {
  // Parse and validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: "Invalid request",
        details: parsed.error.flatten().fieldErrors,
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const { messages, useRAG }: { messages: UIMessage[]; useRAG: boolean } =
    parsed.data as { messages: UIMessage[]; useRAG: boolean };

  // Convert UI messages to model messages (async in AI SDK v6)
  const modelMessages = await convertToModelMessages(messages);

  // Get the latest user message for RAG query
  const lastUserMessage = messages.filter((m) => m.role === "user").pop();

  // Extract query text from the message for RAG
  const queryText =
    lastUserMessage?.parts
      ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join(" ") || "";

  // Parallelize RAG query and settings fetch for better performance
  const [ragResults, responseLength] = await Promise.all([
    // RAG query (if enabled)
    useRAG && queryText
      ? (async () => {
          try {
            const isChromaAvailable = await checkChromaDBHealth();
            if (!isChromaAvailable) return [];
            return await queryDocuments(queryText, 3);
          } catch (error) {
            console.error("RAG query failed:", error);
            return [];
          }
        })()
      : Promise.resolve([]),
    // Settings fetch
    getSetting("responseLength"),
  ]);

  // Build RAG context from results
  const ragContext =
    ragResults.length > 0
      ? `

RELEVANT DOCUMENT CONTEXT:
${ragResults
  .map(
    (r) =>
      `[Source: ${r.source}]
${r.text}`
  )
  .join("\n\n---\n\n")}

Use this context to help answer the user's question when relevant. Cite sources when using information from documents.`
      : "";

  const responseLengthPrompt = getResponseLengthPrompt(responseLength);

  const systemPrompt = `You are a helpful AI meeting assistant. You help teams during meetings by:
- Answering questions about documents and past discussions
- Providing concise, relevant information
- Helping track action items and decisions
- Being conversational yet professional

${responseLengthPrompt}${ragContext}`;

  const result = streamText({
    model: chatModel,
    messages: modelMessages,
    system: systemPrompt,
  });

  return result.toUIMessageStreamResponse();
}
