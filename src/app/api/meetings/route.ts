import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { fastModel } from "@/lib/ollama";
import { meetings } from "@/lib/schema";

// List all meetings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const search = searchParams.get("search");

    const query = db
      .select()
      .from(meetings)
      .orderBy(desc(meetings.startedAt))
      .limit(limit)
      .offset(offset);

    // Add full-text search if provided
    if (search) {
      const searchResults = await db.execute(sql`
        SELECT * FROM meetings
        WHERE to_tsvector('english', COALESCE(transcript, '') || ' ' || COALESCE(summary, '') || ' ' || COALESCE(title, ''))
        @@ plainto_tsquery('english', ${search})
        ORDER BY started_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `);
      return NextResponse.json(searchResults);
    }

    const allMeetings = await query;
    return NextResponse.json(allMeetings);
  } catch (error) {
    console.error("Error fetching meetings:", error);
    return NextResponse.json(
      { error: "Failed to fetch meetings" },
      { status: 500 }
    );
  }
}

// Start a new meeting
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title } = body;

    const [meeting] = await db
      .insert(meetings)
      .values({
        title: title || `Meeting ${new Date().toLocaleDateString()}`,
        startedAt: new Date(),
      })
      .returning();

    return NextResponse.json(meeting, { status: 201 });
  } catch (error) {
    console.error("Error creating meeting:", error);
    return NextResponse.json(
      { error: "Failed to create meeting" },
      { status: 500 }
    );
  }
}

// Generate summary for a meeting transcript
export async function summarizeMeeting(transcript: string): Promise<string> {
  try {
    const { text } = await generateText({
      model: fastModel,
      prompt: `Summarize this meeting transcript in 3-5 bullet points, focusing on key decisions made, action items assigned, and important topics discussed. Be concise and actionable.

TRANSCRIPT:
${transcript}

SUMMARY:`,
    });

    return text.trim();
  } catch (error) {
    console.error("Error generating summary:", error);
    return "Summary generation failed.";
  }
}
