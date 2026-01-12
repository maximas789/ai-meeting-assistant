import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import {
  processAndStoreDocument,
  checkChromaDBHealth,
} from "@/lib/chromadb";
import { db } from "@/lib/db";
import { documents } from "@/lib/schema";

// Allowed MIME types for upload
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
];

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * GET /api/documents - List all documents
 */
export async function GET() {
  try {
    const allDocuments = await db
      .select()
      .from(documents)
      .orderBy(desc(documents.uploadedAt))
      .limit(100);

    return NextResponse.json(allDocuments);
  } catch (error) {
    console.error("Failed to list documents:", error);
    return NextResponse.json(
      { error: "Failed to list documents" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/documents - Upload a new document
 */
export async function POST(request: NextRequest) {
  try {
    // Check ChromaDB availability
    const isChromaAvailable = await checkChromaDBHealth();
    if (!isChromaAvailable) {
      return NextResponse.json(
        { error: "Document storage service unavailable. Please ensure ChromaDB is running." },
        { status: 503 }
      );
    }

    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Unsupported file type: ${file.type}. Allowed types: PDF, DOCX, TXT, MD`,
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB" },
        { status: 400 }
      );
    }

    // Generate a unique filename
    const timestamp = Date.now();
    const safeFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filename = `${timestamp}_${safeFilename}`;

    // Create document record in database first
    const insertResult = await db
      .insert(documents)
      .values({
        filename,
        originalName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        chromadbCollectionId: "documents",
      })
      .returning();

    const doc = insertResult[0];
    if (!doc) {
      return NextResponse.json(
        { error: "Failed to create document record" },
        { status: 500 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Process and store in ChromaDB
    try {
      const chunkCount = await processAndStoreDocument(
        doc.id.toString(),
        file.name,
        buffer,
        file.type
      );

      // Update document with processing info
      await db
        .update(documents)
        .set({
          processedAt: new Date(),
          chunkCount,
        })
        .where(eq(documents.id, doc.id));

      return NextResponse.json({
        id: doc.id,
        filename: doc.filename,
        originalName: file.name,
        chunkCount,
        message: "Document uploaded and processed successfully",
      });
    } catch (processingError) {
      // If ChromaDB processing fails, delete the database record
      await db
        .delete(documents)
        .where(eq(documents.id, doc.id));

      console.error("Failed to process document:", processingError);
      return NextResponse.json(
        { error: "Failed to process document content" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Document upload failed:", error);
    return NextResponse.json(
      { error: "Failed to upload document" },
      { status: 500 }
    );
  }
}
