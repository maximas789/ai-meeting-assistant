import { NextRequest, NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";

const PIPER_SERVICE_URL =
  process.env.PIPER_SERVICE_URL || "http://localhost:8002";

interface SpeakRequest {
  text: string;
  speed?: "slow" | "normal" | "fast" | "very_fast";
  useConfiguredSpeed?: boolean;
}

interface VoiceInfo {
  name: string;
  path: string;
}

interface VoicesResponse {
  current_voice: string;
  available_voices: VoiceInfo[];
  sample_rate: number;
}

/**
 * POST /api/speak
 *
 * Synthesize speech from text using the local Piper TTS service.
 * Returns WAV audio data.
 */
export async function POST(request: NextRequest) {
  try {
    const body: SpeakRequest = await request.json();

    if (!body.text || typeof body.text !== "string") {
      return NextResponse.json(
        { error: "No text provided" },
        { status: 400 }
      );
    }

    // Validate text length (prevent extremely long TTS requests)
    if (body.text.length > 5000) {
      return NextResponse.json(
        { error: "Text too long. Maximum 5000 characters." },
        { status: 400 }
      );
    }

    // Validate speed if provided
    const validSpeeds = ["slow", "normal", "fast", "very_fast"];
    if (body.speed && !validSpeeds.includes(body.speed)) {
      return NextResponse.json(
        { error: `Invalid speed. Must be one of: ${validSpeeds.join(", ")}` },
        { status: 400 }
      );
    }

    // Determine speed: use explicit speed, or configured speed if requested, or default to normal
    let speed = body.speed;
    if (!speed && body.useConfiguredSpeed !== false) {
      // Get speed from admin settings
      const configuredSpeed = await getSetting("voiceSpeed");
      speed = configuredSpeed as "slow" | "normal" | "fast";
    }
    speed = speed || "normal";

    const response = await fetch(`${PIPER_SERVICE_URL}/speak`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: body.text,
        speed,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Piper service error:", errorText);
      return NextResponse.json(
        { error: "Speech synthesis failed", details: errorText },
        { status: response.status }
      );
    }

    // Get audio data as ArrayBuffer
    const audioData = await response.arrayBuffer();

    // Get metadata from headers
    const duration = response.headers.get("X-Audio-Duration");
    const sampleRate = response.headers.get("X-Sample-Rate");

    // Return audio with appropriate headers
    return new NextResponse(audioData, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": audioData.byteLength.toString(),
        "Content-Disposition": 'inline; filename="speech.wav"',
        ...(duration && { "X-Audio-Duration": duration }),
        ...(sampleRate && { "X-Sample-Rate": sampleRate }),
      },
    });
  } catch (error) {
    console.error("TTS API error:", error);

    // Check if it's a connection error
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return NextResponse.json(
        {
          error: "Piper service unavailable",
          details: "Could not connect to the TTS service",
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
 * GET /api/speak
 *
 * Health check for the TTS service and list available voices.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  try {
    if (action === "voices") {
      // List available voices
      const response = await fetch(`${PIPER_SERVICE_URL}/voices`);

      if (!response.ok) {
        return NextResponse.json(
          { error: "Could not fetch voices" },
          { status: 503 }
        );
      }

      const voices: VoicesResponse = await response.json();
      return NextResponse.json(voices);
    }

    // Default: health check
    const response = await fetch(`${PIPER_SERVICE_URL}/health`);

    if (!response.ok) {
      return NextResponse.json(
        { status: "unhealthy", error: "Piper service not responding" },
        { status: 503 }
      );
    }

    const health = await response.json();
    return NextResponse.json({
      status: "healthy",
      service: "piper",
      ...health,
    });
  } catch {
    return NextResponse.json(
      {
        status: "unhealthy",
        error: "Cannot connect to Piper service",
      },
      { status: 503 }
    );
  }
}
