import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { deleteDocument } from "@/lib/chromadb";
import { db } from "@/lib/db";
import { documents } from "@/lib/schema";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/documents/[id] - Get a specific document
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const documentId = parseInt(id, 10);

    if (isNaN(documentId)) {
      return NextResponse.json(
        { error: "Invalid document ID" },
        { status: 400 }
      );
    }

    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    if (!doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(doc);
  } catch (error) {
    console.error("Failed to get document:", error);
    return NextResponse.json(
      { error: "Failed to get document" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/documents/[id] - Delete a document
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const documentId = parseInt(id, 10);

    if (isNaN(documentId)) {
      return NextResponse.json(
        { error: "Invalid document ID" },
        { status: 400 }
      );
    }

    // Check if document exists
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    if (!doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Delete from ChromaDB first
    try {
      await deleteDocument(documentId.toString());
    } catch (chromaError) {
      console.error("Failed to delete from ChromaDB:", chromaError);
      // Continue with database deletion even if ChromaDB fails
    }

    // Delete from database
    await db.delete(documents).where(eq(documents.id, documentId));

    return NextResponse.json({
      message: "Document deleted successfully",
      id: documentId,
    });
  } catch (error) {
    console.error("Failed to delete document:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
