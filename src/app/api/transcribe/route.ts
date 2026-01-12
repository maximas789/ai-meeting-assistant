import { NextRequest, NextResponse } from "next/server";

const WHISPER_SERVICE_URL =
  process.env.WHISPER_SERVICE_URL || "http://localhost:8001";

interface TranscriptionResponse {
  text: string;
  language?: string;
  language_probability?: number;
  duration?: number;
}

interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    probability: number;
  }>;
}

interface DetailedTranscriptionResponse extends TranscriptionResponse {
  segments: TranscriptionSegment[];
}

/**
 * POST /api/transcribe
 *
 * Transcribe audio to text using the local Whisper service.
 * Accepts audio files via multipart form data.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audio = formData.get("audio");

    if (!audio || !(audio instanceof Blob)) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    // Get optional parameters
    const language = formData.get("language") as string | null;
    const task = formData.get("task") as string | null;
    const detailed = formData.get("detailed") === "true";

    // Build form data for Whisper service
    const whisperFormData = new FormData();
    whisperFormData.append("audio", audio, "audio.wav");

    if (language) {
      whisperFormData.append("language", language);
    }

    if (task) {
      whisperFormData.append("task", task);
    }

    // Choose endpoint based on detail level
    const endpoint = detailed ? "/transcribe/detailed" : "/transcribe";

    const response = await fetch(`${WHISPER_SERVICE_URL}${endpoint}`, {
      method: "POST",
      body: whisperFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Whisper service error:", errorText);
      return NextResponse.json(
        { error: "Transcription failed", details: errorText },
        { status: response.status }
      );
    }

    const result: TranscriptionResponse | DetailedTranscriptionResponse =
      await response.json();

    return NextResponse.json(result);
  } catch (error) {
    console.error("Transcription API error:", error);

    // Check if it's a connection error
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return NextResponse.json(
        {
          error: "Whisper service unavailable",
          details: "Could not connect to the transcription service",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/transcribe
 *
 * Health check for the transcription service.
 */
export async function GET() {
  try {
    const response = await fetch(`${WHISPER_SERVICE_URL}/health`);

    if (!response.ok) {
      return NextResponse.json(
        { status: "unhealthy", error: "Whisper service not responding" },
        { status: 503 }
      );
    }

    const health = await response.json();
    return NextResponse.json({
      status: "healthy",
      service: "whisper",
      ...health,
    });
  } catch {
    return NextResponse.json(
      {
        status: "unhealthy",
        error: "Cannot connect to Whisper service",
      },
      { status: 503 }
    );
  }
}
