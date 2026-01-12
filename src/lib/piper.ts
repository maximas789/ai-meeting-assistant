/**
 * Piper TTS Client Library
 *
 * Handles text-to-speech synthesis and audio playback in the browser.
 * Supports playback interruption for barge-in functionality.
 */

export type SpeechSpeed = "slow" | "normal" | "fast" | "very_fast";

interface SpeakOptions {
  speed?: SpeechSpeed;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
}

// Audio state management
let currentAudio: HTMLAudioElement | null = null;
let currentAudioUrl: string | null = null;
let isSpeakingState = false;

// Event callbacks
type SpeechEventCallback = () => void;
const onStartCallbacks: SpeechEventCallback[] = [];
const onEndCallbacks: SpeechEventCallback[] = [];

/**
 * Register a callback for when speech starts
 */
export function onSpeechStart(callback: SpeechEventCallback): () => void {
  onStartCallbacks.push(callback);
  return () => {
    const index = onStartCallbacks.indexOf(callback);
    if (index > -1) {
      onStartCallbacks.splice(index, 1);
    }
  };
}

/**
 * Register a callback for when speech ends
 */
export function onSpeechEnd(callback: SpeechEventCallback): () => void {
  onEndCallbacks.push(callback);
  return () => {
    const index = onEndCallbacks.indexOf(callback);
    if (index > -1) {
      onEndCallbacks.splice(index, 1);
    }
  };
}

/**
 * Notify all registered callbacks that speech has started
 */
function notifySpeechStart(): void {
  isSpeakingState = true;
  onStartCallbacks.forEach((callback) => callback());
}

/**
 * Notify all registered callbacks that speech has ended
 */
function notifySpeechEnd(): void {
  isSpeakingState = false;
  onEndCallbacks.forEach((callback) => callback());
}

/**
 * Clean up the current audio element and URL
 */
function cleanup(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.removeAttribute("src");
    currentAudio = null;
  }
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = null;
  }
}

/**
 * Synthesize and play speech from text
 *
 * @param text - The text to speak
 * @param options - Optional configuration for speech
 * @returns Promise that resolves when speech is complete
 */
export async function speak(
  text: string,
  options: SpeakOptions = {}
): Promise<void> {
  const { speed = "normal", onStart, onEnd, onError } = options;

  // Stop any current playback
  stop();

  try {
    // Request audio from the TTS API
    const response = await fetch("/api/speak", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, speed }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Speech synthesis failed: ${response.status}`
      );
    }

    // Get audio blob
    const audioBlob = await response.blob();

    // Create audio URL
    currentAudioUrl = URL.createObjectURL(audioBlob);

    // Create and configure audio element
    currentAudio = new Audio(currentAudioUrl);

    // Set up event handlers
    return new Promise((resolve, reject) => {
      if (!currentAudio) {
        reject(new Error("Audio element not created"));
        return;
      }

      currentAudio.onplay = () => {
        notifySpeechStart();
        onStart?.();
      };

      currentAudio.onended = () => {
        cleanup();
        notifySpeechEnd();
        onEnd?.();
        resolve();
      };

      currentAudio.onerror = (event) => {
        const error = new Error(
          `Audio playback error: ${(event as ErrorEvent).message || "Unknown error"}`
        );
        cleanup();
        notifySpeechEnd();
        onError?.(error);
        reject(error);
      };

      // Start playback
      currentAudio.play().catch((error) => {
        cleanup();
        notifySpeechEnd();
        onError?.(error);
        reject(error);
      });
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    cleanup();
    notifySpeechEnd();
    onError?.(err);
    throw err;
  }
}

/**
 * Stop current speech playback immediately
 *
 * Used for barge-in interruption
 */
export function stop(): void {
  if (currentAudio) {
    const wasPlaying = !currentAudio.paused;
    cleanup();
    if (wasPlaying) {
      notifySpeechEnd();
    }
  }
}

/**
 * Check if speech is currently playing
 */
export function isSpeaking(): boolean {
  return isSpeakingState && currentAudio !== null && !currentAudio.paused;
}

/**
 * Get the current playback position in seconds
 */
export function getCurrentTime(): number {
  return currentAudio?.currentTime ?? 0;
}

/**
 * Get the total duration of the current audio in seconds
 */
export function getDuration(): number {
  return currentAudio?.duration ?? 0;
}

/**
 * Set the playback volume (0.0 to 1.0)
 */
export function setVolume(volume: number): void {
  if (currentAudio) {
    currentAudio.volume = Math.max(0, Math.min(1, volume));
  }
}

/**
 * Get available voices from the TTS service
 */
export async function getVoices(): Promise<{
  currentVoice: string;
  availableVoices: Array<{ name: string; path: string }>;
  sampleRate: number;
}> {
  const response = await fetch("/api/speak?action=voices");

  if (!response.ok) {
    throw new Error("Failed to fetch voices");
  }

  const data = await response.json();
  return {
    currentVoice: data.current_voice,
    availableVoices: data.available_voices,
    sampleRate: data.sample_rate,
  };
}

/**
 * Check if the TTS service is healthy
 */
export async function checkHealth(): Promise<{
  status: string;
  piperAvailable: boolean;
}> {
  try {
    const response = await fetch("/api/speak");
    const data = await response.json();
    return {
      status: data.status,
      piperAvailable: data.piper_available ?? false,
    };
  } catch {
    return {
      status: "unhealthy",
      piperAvailable: false,
    };
  }
}

/**
 * Preload an audio for faster playback
 * Useful for predictable phrases like greetings
 */
export async function preload(text: string, speed: SpeechSpeed = "normal"): Promise<string> {
  const response = await fetch("/api/speak", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, speed }),
  });

  if (!response.ok) {
    throw new Error("Failed to preload audio");
  }

  const audioBlob = await response.blob();
  return URL.createObjectURL(audioBlob);
}

/**
 * Play a preloaded audio URL
 */
export function playPreloaded(
  audioUrl: string,
  options: Omit<SpeakOptions, "speed"> = {}
): Promise<void> {
  const { onStart, onEnd, onError } = options;

  // Stop any current playback
  stop();

  currentAudioUrl = audioUrl;
  currentAudio = new Audio(audioUrl);

  return new Promise((resolve, reject) => {
    if (!currentAudio) {
      reject(new Error("Audio element not created"));
      return;
    }

    currentAudio.onplay = () => {
      notifySpeechStart();
      onStart?.();
    };

    currentAudio.onended = () => {
      currentAudio = null;
      // Don't revoke URL for preloaded audio (might be reused)
      currentAudioUrl = null;
      notifySpeechEnd();
      onEnd?.();
      resolve();
    };

    currentAudio.onerror = (event) => {
      const error = new Error(
        `Audio playback error: ${(event as ErrorEvent).message || "Unknown error"}`
      );
      cleanup();
      notifySpeechEnd();
      onError?.(error);
      reject(error);
    };

    currentAudio.play().catch((error) => {
      cleanup();
      notifySpeechEnd();
      onError?.(error);
      reject(error);
    });
  });
}
