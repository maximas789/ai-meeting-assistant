import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { fastModel } from "@/lib/ollama";
import { meetings } from "@/lib/schema";

type RouteParams = { params: Promise<{ id: string }> };

// Get a single meeting
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const meetingId = parseInt(id);

    if (isNaN(meetingId)) {
      return NextResponse.json({ error: "Invalid meeting ID" }, { status: 400 });
    }

    const [meeting] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, meetingId));

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    return NextResponse.json(meeting);
  } catch (error) {
    console.error("Error fetching meeting:", error);
    return NextResponse.json(
      { error: "Failed to fetch meeting" },
      { status: 500 }
    );
  }
}

// Update a meeting (e.g., add transcript, end meeting)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const meetingId = parseInt(id);

    if (isNaN(meetingId)) {
      return NextResponse.json({ error: "Invalid meeting ID" }, { status: 400 });
    }

    const body = await request.json();
    const { title, transcript, endMeeting, appendTranscript } = body;

    // Fetch current meeting to potentially append transcript
    const [currentMeeting] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, meetingId));

    if (!currentMeeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const updateData: Partial<typeof meetings.$inferInsert> = {};

    if (title) {
      updateData.title = title;
    }

    // Handle transcript updates
    if (transcript) {
      updateData.transcript = transcript;
    } else if (appendTranscript) {
      // Append new transcription to existing
      updateData.transcript = currentMeeting.transcript
        ? `${currentMeeting.transcript}\n${appendTranscript}`
        : appendTranscript;
    }

    // End meeting and generate summary
    if (endMeeting) {
      updateData.endedAt = new Date();

      // Generate summary if we have a transcript
      const finalTranscript = updateData.transcript || currentMeeting.transcript;
      if (finalTranscript) {
        updateData.summary = await generateMeetingSummary(finalTranscript);
      }
    }

    const [updatedMeeting] = await db
      .update(meetings)
      .set(updateData)
      .where(eq(meetings.id, meetingId))
      .returning();

    return NextResponse.json(updatedMeeting);
  } catch (error) {
    console.error("Error updating meeting:", error);
    return NextResponse.json(
      { error: "Failed to update meeting" },
      { status: 500 }
    );
  }
}

// Delete a meeting
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const meetingId = parseInt(id);

    if (isNaN(meetingId)) {
      return NextResponse.json({ error: "Invalid meeting ID" }, { status: 400 });
    }

    const [deletedMeeting] = await db
      .delete(meetings)
      .where(eq(meetings.id, meetingId))
      .returning();

    if (!deletedMeeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, id: meetingId });
  } catch (error) {
    console.error("Error deleting meeting:", error);
    return NextResponse.json(
      { error: "Failed to delete meeting" },
      { status: 500 }
    );
  }
}

// Generate summary for a meeting transcript
async function generateMeetingSummary(transcript: string): Promise<string> {
  try {
    const { text } = await generateText({
      model: fastModel,
      prompt: `Summarize this meeting transcript in 3-5 bullet points, focusing on:
- Key decisions made
- Action items assigned
- Important topics discussed
- Any deadlines or next steps mentioned

Be concise and actionable.

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
