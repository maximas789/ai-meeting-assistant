"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { stop as stopTTS, isSpeaking, onSpeechStart, onSpeechEnd } from "@/lib/piper";

interface UseBargeInOptions {
  /**
   * Threshold for voice activity detection (0-255)
   * Higher values require louder speech to trigger
   * Default: 30
   */
  threshold?: number;

  /**
   * Number of consecutive frames above threshold to trigger barge-in
   * Helps prevent false positives from brief noises
   * Default: 3
   */
  consecutiveFrames?: number;

  /**
   * Whether barge-in detection is enabled
   * Default: true
   */
  enabled?: boolean;

  /**
   * Callback when barge-in is detected
   */
  onBargeIn?: () => void;

  /**
   * Callback when voice activity starts (even without barge-in)
   */
  onVoiceStart?: () => void;

  /**
   * Callback when voice activity stops
   */
  onVoiceStop?: () => void;
}

interface UseBargeInReturn {
  /**
   * Whether barge-in detection is currently active (TTS playing + listening)
   */
  isActive: boolean;

  /**
   * Whether voice activity is currently detected
   */
  isVoiceDetected: boolean;

  /**
   * Current audio level (0-255)
   */
  audioLevel: number;

  /**
   * Whether TTS is currently speaking
   */
  isTTSSpeaking: boolean;

  /**
   * Start listening for barge-in
   */
  startListening: () => Promise<void>;

  /**
   * Stop listening for barge-in
   */
  stopListening: () => void;
}

/**
 * Hook for detecting barge-in (user speech during TTS playback)
 *
 * This hook monitors the microphone for voice activity while TTS is playing.
 * When the user speaks (voice activity exceeds threshold), it immediately
 * stops TTS playback and triggers the onBargeIn callback.
 *
 * The ReSpeaker XVF3800 hardware provides acoustic echo cancellation (AEC),
 * so the TTS audio played through speakers won't trigger false positives.
 *
 * @example
 * ```tsx
 * const { isActive, startListening } = useBargeIn({
 *   onBargeIn: () => {
 *     console.log('User interrupted!');
 *     startNewRecording();
 *   }
 * });
 * ```
 */
export function useBargeIn(options: UseBargeInOptions = {}): UseBargeInReturn {
  const {
    threshold = 30,
    consecutiveFrames = 3,
    enabled = true,
    onBargeIn,
    onVoiceStart,
    onVoiceStop,
  } = options;

  // State
  const [isActive, setIsActive] = useState(false);
  const [isVoiceDetected, setIsVoiceDetected] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isTTSSpeaking, setIsTTSSpeaking] = useState(false);

  // Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const consecutiveCountRef = useRef(0);
  const wasVoiceDetectedRef = useRef(false);
  const isMonitoringRef = useRef(false);

  // Refs for callbacks to avoid stale closures
  const onBargeInRef = useRef(onBargeIn);
  const onVoiceStartRef = useRef(onVoiceStart);
  const onVoiceStopRef = useRef(onVoiceStop);
  const thresholdRef = useRef(threshold);
  const consecutiveFramesRef = useRef(consecutiveFrames);
  const enabledRef = useRef(enabled);

  // Update refs when props change
  useEffect(() => {
    onBargeInRef.current = onBargeIn;
    onVoiceStartRef.current = onVoiceStart;
    onVoiceStopRef.current = onVoiceStop;
    thresholdRef.current = threshold;
    consecutiveFramesRef.current = consecutiveFrames;
    enabledRef.current = enabled;
  }, [onBargeIn, onVoiceStart, onVoiceStop, threshold, consecutiveFrames, enabled]);

  // Cleanup function
  const cleanup = useCallback(() => {
    isMonitoringRef.current = false;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    analyserRef.current = null;
    consecutiveCountRef.current = 0;
    setIsActive(false);
  }, []);

  // Start listening for barge-in
  const startListening = useCallback(async () => {
    if (!enabledRef.current) return;

    // Clean up any existing resources
    cleanup();

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false, // ReSpeaker XVF3800 handles AEC in hardware
          noiseSuppression: false, // Hardware handles this too
          autoGainControl: false,
          channelCount: 1,
          sampleRate: 16000,
        },
      });

      streamRef.current = stream;

      // Create audio context
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);

      // Create analyser
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.3;

      source.connect(analyserRef.current);

      setIsActive(true);
      isMonitoringRef.current = true;

      // Start the monitoring loop
      const checkVoiceActivity = () => {
        if (!isMonitoringRef.current || !analyserRef.current || !enabledRef.current) {
          return;
        }

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average level
        const sum = dataArray.reduce((a, b) => a + b, 0);
        const average = sum / dataArray.length;
        setAudioLevel(average);

        // Check if above threshold
        const isAboveThreshold = average > thresholdRef.current;

        if (isAboveThreshold) {
          consecutiveCountRef.current++;

          if (consecutiveCountRef.current >= consecutiveFramesRef.current) {
            // Voice activity confirmed
            if (!wasVoiceDetectedRef.current) {
              wasVoiceDetectedRef.current = true;
              setIsVoiceDetected(true);
              onVoiceStartRef.current?.();

              // If TTS is speaking, this is a barge-in
              if (isSpeaking()) {
                stopTTS();
                onBargeInRef.current?.();
              }
            }
          }
        } else {
          consecutiveCountRef.current = 0;

          if (wasVoiceDetectedRef.current) {
            wasVoiceDetectedRef.current = false;
            setIsVoiceDetected(false);
            onVoiceStopRef.current?.();
          }
        }

        // Continue loop
        if (isMonitoringRef.current) {
          animationFrameRef.current = requestAnimationFrame(checkVoiceActivity);
        }
      };

      // Start the loop
      checkVoiceActivity();
    } catch (error) {
      console.error("Failed to start barge-in detection:", error);
      cleanup();
      throw error;
    }
  }, [cleanup]);

  // Stop listening
  const stopListening = useCallback(() => {
    cleanup();
    setIsVoiceDetected(false);
    setAudioLevel(0);
  }, [cleanup]);

  // Listen for TTS state changes
  useEffect(() => {
    const unsubscribeStart = onSpeechStart(() => {
      setIsTTSSpeaking(true);
    });

    const unsubscribeEnd = onSpeechEnd(() => {
      setIsTTSSpeaking(false);
    });

    return () => {
      unsubscribeStart();
      unsubscribeEnd();
    };
  }, []);

  // Auto-start listening when TTS starts (if enabled)
  // Using a ref to track TTS state changes to avoid calling setState in effect
  const prevTTSSpeakingRef = useRef(false);
  useEffect(() => {
    const wasSpeaking = prevTTSSpeakingRef.current;
    prevTTSSpeakingRef.current = isTTSSpeaking;

    // Only start listening when TTS transitions from not speaking to speaking
    if (enabled && isTTSSpeaking && !wasSpeaking && !isActive) {
      // Use queueMicrotask to defer the state update
      queueMicrotask(() => {
        startListening().catch(console.error);
      });
    }
  }, [enabled, isTTSSpeaking, isActive, startListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isActive,
    isVoiceDetected,
    audioLevel,
    isTTSSpeaking,
    startListening,
    stopListening,
  };
}

/**
 * Simpler hook that just provides barge-in with default settings
 */
export function useSimpleBargeIn(onBargeIn: () => void): {
  isActive: boolean;
  isTTSSpeaking: boolean;
} {
  const { isActive, isTTSSpeaking } = useBargeIn({ onBargeIn });
  return { isActive, isTTSSpeaking };
}
