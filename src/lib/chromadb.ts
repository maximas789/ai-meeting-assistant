import { ChromaClient, Collection, Metadata } from "chromadb";
import mammoth from "mammoth";

// ChromaDB client configuration
const client = new ChromaClient({
  path: process.env.CHROMADB_URL || "http://localhost:8003",
});

let collection: Collection | null = null;

const COLLECTION_NAME = "documents";

/**
 * Get or create the documents collection
 */
export async function getCollection(): Promise<Collection> {
  if (!collection) {
    collection = await client.getOrCreateCollection({
      name: COLLECTION_NAME,
      metadata: { "hnsw:space": "cosine" },
    });
  }
  return collection;
}

/**
 * Reset the collection cache (useful for testing)
 */
export function resetCollectionCache(): void {
  collection = null;
}

// ===========================================
// Text Extraction
// ===========================================

/**
 * Extract text from a PDF file
 * Uses dynamic import to avoid build-time issues with pdf-parse
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // Dynamic import to avoid build-time initialization issues
  const pdfParse = require("pdf-parse/lib/pdf-parse");
  const data = await pdfParse(buffer);
  return data.text;
}

/**
 * Extract text from a DOCX file
 */
export async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * Extract text from a plain text file
 */
export function extractTextFromTXT(buffer: Buffer): string {
  return buffer.toString("utf-8");
}

/**
 * Extract text based on MIME type
 */
export async function extractText(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  switch (mimeType) {
    case "application/pdf":
      return extractTextFromPDF(buffer);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return extractTextFromDOCX(buffer);
    case "text/plain":
    case "text/markdown":
      return extractTextFromTXT(buffer);
    default:
      throw new Error(`Unsupported file type: ${mimeType}`);
  }
}

// ===========================================
// Text Chunking
// ===========================================

export interface ChunkOptions {
  chunkSize?: number;
  overlap?: number;
}

/**
 * Split text into overlapping chunks for better retrieval
 */
export function chunkText(
  text: string,
  options: ChunkOptions = {}
): string[] {
  const { chunkSize = 1000, overlap = 200 } = options;
  const chunks: string[] = [];

  // Clean up the text
  const cleanedText = text
    .replace(/\s+/g, " ")
    .trim();

  if (cleanedText.length <= chunkSize) {
    return [cleanedText];
  }

  let start = 0;
  while (start < cleanedText.length) {
    const end = Math.min(start + chunkSize, cleanedText.length);
    let chunk = cleanedText.slice(start, end);

    // Try to break at a sentence boundary
    if (end < cleanedText.length) {
      const lastPeriod = chunk.lastIndexOf(". ");
      const lastQuestion = chunk.lastIndexOf("? ");
      const lastExclaim = chunk.lastIndexOf("! ");
      const lastBreak = Math.max(lastPeriod, lastQuestion, lastExclaim);

      if (lastBreak > chunkSize / 2) {
        chunk = chunk.slice(0, lastBreak + 1).trim();
      }
    }

    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // Move start position with overlap
    start = start + chunk.length - overlap;
    if (start <= 0 && chunks.length > 0) {
      start = chunk.length;
    }
  }

  return chunks;
}

// ===========================================
// Document Storage
// ===========================================

export interface DocumentMetadata {
  documentId: string;
  filename: string;
  chunkIndex: number;
  totalChunks: number;
}

/**
 * Add a document to ChromaDB
 */
export async function addDocument(
  documentId: string,
  filename: string,
  chunks: string[]
): Promise<void> {
  const col = await getCollection();

  const ids = chunks.map((_, i) => `${documentId}_chunk_${i}`);
  const metadatas: Metadata[] = chunks.map((_, i) => ({
    documentId,
    filename,
    chunkIndex: i,
    totalChunks: chunks.length,
  }));

  await col.add({
    ids,
    documents: chunks,
    metadatas,
  });
}

/**
 * Delete a document from ChromaDB
 */
export async function deleteDocument(documentId: string): Promise<void> {
  const col = await getCollection();

  // Get all chunks for this document
  const results = await col.get({
    where: { documentId },
  });

  if (results.ids.length > 0) {
    await col.delete({
      ids: results.ids,
    });
  }
}

// ===========================================
// Document Querying
// ===========================================

export interface QueryResult {
  text: string;
  source: string;
  documentId: string;
  chunkIndex: number;
  distance: number;
}

/**
 * Query documents for relevant chunks
 */
export async function queryDocuments(
  query: string,
  nResults: number = 5
): Promise<QueryResult[]> {
  const col = await getCollection();

  const results = await col.query({
    queryTexts: [query],
    nResults,
  });

  if (!results.documents[0] || !results.metadatas[0] || !results.distances?.[0]) {
    return [];
  }

  return results.documents[0].map((doc, i) => {
    const metadata = results.metadatas[0]?.[i] as DocumentMetadata | undefined;
    return {
      text: doc || "",
      source: metadata?.filename ?? "Unknown",
      documentId: metadata?.documentId ?? "",
      chunkIndex: metadata?.chunkIndex ?? 0,
      distance: results.distances?.[0]?.[i] ?? 0,
    };
  });
}

/**
 * Check if ChromaDB is available
 */
export async function checkChromaDBHealth(): Promise<boolean> {
  try {
    await client.heartbeat();
    return true;
  } catch {
    return false;
  }
}

// ===========================================
// Full Document Processing Pipeline
// ===========================================

export interface ProcessDocumentResult {
  chunks: string[];
  text: string;
}

/**
 * Process a document: extract text and chunk it
 */
export async function processDocument(
  buffer: Buffer,
  mimeType: string,
  options?: ChunkOptions
): Promise<ProcessDocumentResult> {
  const text = await extractText(buffer, mimeType);
  const chunks = chunkText(text, options);
  return { chunks, text };
}

/**
 * Full pipeline: process document and store in ChromaDB
 */
export async function processAndStoreDocument(
  documentId: string,
  filename: string,
  buffer: Buffer,
  mimeType: string,
  options?: ChunkOptions
): Promise<number> {
  const { chunks } = await processDocument(buffer, mimeType, options);
  await addDocument(documentId, filename, chunks);
  return chunks.length;
}
