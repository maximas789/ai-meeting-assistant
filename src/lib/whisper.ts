/**
 * Whisper Client Library
 *
 * Client for the local Faster-Whisper STT service.
 * Supports batch and streaming transcription modes.
 */

export interface TranscriptionResult {
  text: string;
  language?: string | undefined;
  languageProbability?: number | undefined;
  duration?: number | undefined;
}

export interface TranscriptionSegment {
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

export interface DetailedTranscriptionResult extends TranscriptionResult {
  segments: TranscriptionSegment[];
}

export interface TranscribeOptions {
  /** Language code (e.g., "en", "es"). Auto-detected if not provided. */
  language?: string | undefined;
  /** Task: "transcribe" (default) or "translate" (to English) */
  task?: "transcribe" | "translate" | undefined;
  /** Include detailed segment information */
  detailed?: boolean | undefined;
}

export interface StreamingTranscriptionEvent {
  type: "info" | "segment" | "done" | "error";
  language?: string;
  probability?: number;
  start?: number;
  end?: number;
  text?: string;
  error?: string;
}

/**
 * Transcribe audio blob to text.
 *
 * @param audioBlob - Audio data as Blob (WAV, WebM, etc.)
 * @param options - Transcription options
 * @returns Transcription result with text and metadata
 *
 * @example
 * ```ts
 * const blob = await recorder.getAudioBlob();
 * const result = await transcribeAudio(blob);
 * console.log(result.text);
 * ```
 */
export async function transcribeAudio(
  audioBlob: Blob,
  options: TranscribeOptions = {}
): Promise<TranscriptionResult> {
  const formData = new FormData();
  formData.append("audio", audioBlob, "audio.wav");

  if (options.language) {
    formData.append("language", options.language);
  }

  if (options.task) {
    formData.append("task", options.task);
  }

  if (options.detailed) {
    formData.append("detailed", "true");
  }

  const response = await fetch("/api/transcribe", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new TranscriptionError(
      error.error || "Transcription failed",
      response.status,
      error.details
    );
  }

  const result = await response.json();

  return {
    text: result.text,
    language: result.language,
    languageProbability: result.language_probability,
    duration: result.duration,
    ...(options.detailed && { segments: result.segments }),
  };
}

/**
 * Transcribe audio with detailed segment information.
 *
 * @param audioBlob - Audio data as Blob
 * @param options - Transcription options
 * @returns Detailed result with segments and timing
 */
export async function transcribeAudioDetailed(
  audioBlob: Blob,
  options: Omit<TranscribeOptions, "detailed"> = {}
): Promise<DetailedTranscriptionResult> {
  const result = await transcribeAudio(audioBlob, { ...options, detailed: true });
  return result as DetailedTranscriptionResult;
}

/**
 * Stream transcription results as segments are processed.
 *
 * @param audioBlob - Audio data as Blob
 * @param onSegment - Callback for each transcribed segment
 * @param options - Transcription options
 * @returns Final complete transcription
 *
 * @example
 * ```ts
 * const result = await transcribeAudioStream(
 *   audioBlob,
 *   (event) => {
 *     if (event.type === 'segment') {
 *       console.log(event.text);
 *     }
 *   }
 * );
 * ```
 */
export async function transcribeAudioStream(
  audioBlob: Blob,
  onSegment: (event: StreamingTranscriptionEvent) => void,
  options: Omit<TranscribeOptions, "detailed"> = {}
): Promise<TranscriptionResult> {
  const formData = new FormData();
  formData.append("audio", audioBlob, "audio.wav");

  if (options.language) {
    formData.append("language", options.language);
  }

  // Use direct connection to Whisper service for streaming
  const whisperUrl =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_WHISPER_SERVICE_URL || "http://localhost:8001"
      : process.env.WHISPER_SERVICE_URL || "http://localhost:8001";

  const response = await fetch(`${whisperUrl}/transcribe/stream`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new TranscriptionError("Streaming transcription failed", response.status);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new TranscriptionError("No response body for streaming", 500);
  }

  const decoder = new TextDecoder();
  let language: string | undefined;
  let languageProbability: number | undefined;
  const textParts: string[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;

        try {
          const data = JSON.parse(line.slice(6));

          if (data.type === "info") {
            language = data.language;
            languageProbability = data.probability;
            onSegment({
              type: "info",
              language: data.language,
              probability: data.probability,
            });
          } else if (data.type === "segment") {
            textParts.push(data.text);
            onSegment({
              type: "segment",
              start: data.start,
              end: data.end,
              text: data.text,
            });
          } else if (data.type === "done") {
            onSegment({ type: "done" });
          }
        } catch {
          // Ignore JSON parse errors for malformed lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return {
    text: textParts.join(" "),
    language,
    languageProbability,
  };
}

/**
 * Check if the transcription service is available.
 *
 * @returns Health status of the Whisper service
 */
export async function checkTranscriptionService(): Promise<{
  available: boolean;
  modelSize?: string;
  device?: string;
  error?: string;
}> {
  try {
    const response = await fetch("/api/transcribe", {
      method: "GET",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return {
        available: false,
        error: error.error || "Service unavailable",
      };
    }

    const health = await response.json();
    return {
      available: health.status === "healthy",
      modelSize: health.model_size,
      device: health.device,
    };
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

/**
 * Custom error class for transcription errors.
 */
export class TranscriptionError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: string
  ) {
    super(message);
    this.name = "TranscriptionError";
  }
}
