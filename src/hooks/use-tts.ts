"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  speak,
  stop,
  onSpeechStart,
  onSpeechEnd,
  checkHealth,
  type SpeechSpeed,
} from "@/lib/piper";

interface UseTTSOptions {
  /**
   * Default speech speed
   */
  speed?: SpeechSpeed;

  /**
   * Whether TTS is enabled
   * Default: true
   */
  enabled?: boolean;

  /**
   * Callback when speech starts
   */
  onStart?: () => void;

  /**
   * Callback when speech ends
   */
  onEnd?: () => void;

  /**
   * Callback on error
   */
  onError?: (error: Error) => void;
}

interface UseTTSReturn {
  /**
   * Whether TTS is currently speaking
   */
  isSpeaking: boolean;

  /**
   * Whether TTS service is available
   */
  serviceAvailable: boolean;

  /**
   * Whether TTS is muted
   */
  isMuted: boolean;

  /**
   * Current speech speed
   */
  speed: SpeechSpeed;

  /**
   * Any error message
   */
  error: string | null;

  /**
   * Speak the given text
   */
  speakText: (text: string) => Promise<void>;

  /**
   * Stop current speech
   */
  stopSpeaking: () => void;

  /**
   * Toggle mute state
   */
  toggleMute: () => void;

  /**
   * Set mute state
   */
  setMuted: (muted: boolean) => void;

  /**
   * Set speech speed
   */
  setSpeed: (speed: SpeechSpeed) => void;
}

/**
 * Hook for text-to-speech functionality
 *
 * Provides easy integration with the Piper TTS service.
 *
 * @example
 * ```tsx
 * const { isSpeaking, speakText, stopSpeaking, toggleMute } = useTTS();
 *
 * // Speak some text
 * await speakText("Hello, this is a test.");
 *
 * // Stop speaking (e.g., on barge-in)
 * stopSpeaking();
 * ```
 */
export function useTTS(options: UseTTSOptions = {}): UseTTSReturn {
  const {
    speed: defaultSpeed = "normal",
    enabled = true,
    onStart,
    onEnd,
    onError,
  } = options;

  // State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [serviceAvailable, setServiceAvailable] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [speed, setSpeed] = useState<SpeechSpeed>(defaultSpeed);
  const [error, setError] = useState<string | null>(null);

  // Refs for callbacks (to avoid stale closures)
  const onStartRef = useRef(onStart);
  const onEndRef = useRef(onEnd);
  const onErrorRef = useRef(onError);

  // Update refs when callbacks change
  useEffect(() => {
    onStartRef.current = onStart;
    onEndRef.current = onEnd;
    onErrorRef.current = onError;
  }, [onStart, onEnd, onError]);

  // Check service health on mount
  useEffect(() => {
    const checkService = async () => {
      try {
        const health = await checkHealth();
        setServiceAvailable(health.status === "healthy" && health.piperAvailable);
      } catch {
        setServiceAvailable(false);
      }
    };

    checkService();

    // Check periodically
    const interval = setInterval(checkService, 30000);
    return () => clearInterval(interval);
  }, []);

  // Listen for global speech events
  useEffect(() => {
    const unsubscribeStart = onSpeechStart(() => {
      setIsSpeaking(true);
    });

    const unsubscribeEnd = onSpeechEnd(() => {
      setIsSpeaking(false);
    });

    return () => {
      unsubscribeStart();
      unsubscribeEnd();
    };
  }, []);

  // Speak text
  const speakText = useCallback(
    async (text: string) => {
      if (!enabled || isMuted || !serviceAvailable) {
        return;
      }

      // Clear any previous error
      setError(null);

      try {
        await speak(text, {
          speed,
          onStart: () => {
            onStartRef.current?.();
          },
          onEnd: () => {
            onEndRef.current?.();
          },
          onError: (err) => {
            setError(err.message);
            onErrorRef.current?.(err);
          },
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error.message);
        onErrorRef.current?.(error);
      }
    },
    [enabled, isMuted, serviceAvailable, speed]
  );

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    stop();
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const newMuted = !prev;
      if (newMuted) {
        // If muting, stop any current speech
        stop();
      }
      return newMuted;
    });
  }, []);

  // Set muted state
  const setMutedState = useCallback((muted: boolean) => {
    setIsMuted(muted);
    if (muted) {
      stop();
    }
  }, []);

  return {
    isSpeaking,
    serviceAvailable,
    isMuted,
    speed,
    error,
    speakText,
    stopSpeaking,
    toggleMute,
    setMuted: setMutedState,
    setSpeed,
  };
}

/**
 * Hook to speak AI responses automatically
 *
 * @example
 * ```tsx
 * const { speakResponse } = useAIResponseTTS();
 *
 * // When AI responds:
 * speakResponse("Here is the answer to your question...");
 * ```
 */
export function useAIResponseTTS(options: UseTTSOptions = {}) {
  const tts = useTTS(options);

  const speakResponse = useCallback(
    async (response: string) => {
      // Clean up the response for better TTS
      const cleanedResponse = response
        // Remove markdown formatting
        .replace(/\*\*/g, "")
        .replace(/\*/g, "")
        .replace(/#{1,6}\s/g, "")
        .replace(/`{1,3}[^`]*`{1,3}/g, "code snippet")
        // Remove URLs
        .replace(/https?:\/\/[^\s]+/g, "link")
        // Normalize whitespace
        .replace(/\s+/g, " ")
        .trim();

      if (cleanedResponse) {
        await tts.speakText(cleanedResponse);
      }
    },
    [tts]
  );

  return {
    ...tts,
    speakResponse,
  };
}
