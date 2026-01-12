'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { PorcupineWorker, BuiltInKeyword } from '@picovoice/porcupine-web';
import { WebVoiceProcessor } from '@picovoice/web-voice-processor';

export type WakeWordState =
  | 'uninitialized'
  | 'initializing'
  | 'ready'
  | 'listening'
  | 'detected'
  | 'error';

export interface UseWakeWordOptions {
  /** Porcupine access key from Picovoice Console */
  accessKey?: string;
  /**
   * Built-in keyword to use for wake word detection
   */
  keyword?: BuiltInKeyword;
  /** Sensitivity for wake word detection (0.0 to 1.0, default: 0.5) */
  sensitivity?: number;
  /** Callback when wake word is detected */
  onWakeWord?: () => void;
  /** Auto-start listening on initialization */
  autoStart?: boolean;
  /** Timeout in ms to return to 'ready' after detection (default: 500) */
  detectionTimeout?: number;
  /** Path to the Porcupine model file (.pv) relative to public directory */
  modelPath?: string;
}

export interface UseWakeWordReturn {
  /** Current state of wake word detection */
  state: WakeWordState;
  /** Error message if state is 'error' */
  error: string | null;
  /** Whether the engine is actively listening */
  isListening: boolean;
  /** Whether a wake word was just detected */
  isDetected: boolean;
  /** Whether the engine is ready to listen */
  isReady: boolean;
  /** Start listening for wake word */
  startListening: () => Promise<void>;
  /** Stop listening for wake word */
  stopListening: () => Promise<void>;
  /** Re-initialize the engine */
  reinitialize: () => Promise<void>;
  /** Release all resources */
  release: () => Promise<void>;
}

/**
 * Hook for wake word detection using Picovoice Porcupine
 *
 * Requires a Porcupine access key from https://console.picovoice.ai/
 * Set NEXT_PUBLIC_PORCUPINE_ACCESS_KEY in your environment.
 *
 * Also requires the Porcupine model file (porcupine_params.pv) to be placed in
 * the public/models directory. Download from:
 * https://github.com/Picovoice/porcupine/blob/master/lib/common/porcupine_params.pv
 *
 * @example
 * ```tsx
 * const { state, isListening, startListening, stopListening } = useWakeWord({
 *   keyword: BuiltInKeyword.Jarvis,
 *   onWakeWord: () => {
 *     // Wake word detected - start recording or activate assistant
 *   },
 * });
 * ```
 */
export function useWakeWord(options: UseWakeWordOptions = {}): UseWakeWordReturn {
  const {
    accessKey = process.env.NEXT_PUBLIC_PORCUPINE_ACCESS_KEY,
    keyword = BuiltInKeyword.Computer,
    sensitivity = 0.5,
    onWakeWord,
    autoStart = false,
    detectionTimeout = 500,
    modelPath = '/models/porcupine_params.pv',
  } = options;

  const [state, setState] = useState<WakeWordState>('uninitialized');
  const [error, setError] = useState<string | null>(null);

  // Refs for engine and callbacks
  const porcupineRef = useRef<PorcupineWorker | null>(null);
  const onWakeWordRef = useRef(onWakeWord);
  const isProcessorSubscribedRef = useRef(false);
  const detectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStartRef = useRef(autoStart);

  // Keep callback ref updated
  useEffect(() => {
    onWakeWordRef.current = onWakeWord;
  }, [onWakeWord]);

  useEffect(() => {
    autoStartRef.current = autoStart;
  }, [autoStart]);

  /**
   * Subscribe to voice processor and start listening
   */
  const subscribeToProcessor = useCallback(async () => {
    if (!porcupineRef.current) return false;

    try {
      await WebVoiceProcessor.subscribe(porcupineRef.current);
      isProcessorSubscribedRef.current = true;
      setState('listening');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start wake word detection';
      console.error('Start listening error:', err);
      setError(message);
      setState('error');
      return false;
    }
  }, []);

  /**
   * Initialize Porcupine wake word engine
   */
  const initialize = useCallback(async () => {
    if (!accessKey) {
      setError('Porcupine access key is required. Get one at https://console.picovoice.ai/');
      setState('error');
      return;
    }

    setState('initializing');
    setError(null);

    try {
      // Create detection callback
      const detectionCallback = (detection: { label: string; index: number }) => {
        // Detection occurred
        void detection; // Use the parameter to avoid unused warning

        setState('detected');

        // Call the callback
        onWakeWordRef.current?.();

        // Reset to listening after timeout
        if (detectionTimeoutRef.current) {
          clearTimeout(detectionTimeoutRef.current);
        }
        detectionTimeoutRef.current = setTimeout(() => {
          if (porcupineRef.current && isProcessorSubscribedRef.current) {
            setState('listening');
          }
        }, detectionTimeout);
      };

      // Build the keyword with sensitivity
      const keywordConfig = {
        builtin: keyword,
        sensitivity,
      };

      // Model configuration - pointing to the public directory
      const modelConfig = {
        publicPath: modelPath,
      };

      // Initialize Porcupine worker
      const porcupine = await PorcupineWorker.create(
        accessKey,
        keywordConfig,
        detectionCallback,
        modelConfig,
      );

      porcupineRef.current = porcupine;
      setState('ready');

      // Auto-start if requested
      if (autoStartRef.current) {
        await subscribeToProcessor();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize Porcupine';
      console.error('Porcupine initialization error:', err);
      setError(message);
      setState('error');
    }
  }, [accessKey, keyword, sensitivity, detectionTimeout, modelPath, subscribeToProcessor]);

  /**
   * Start listening for wake word
   */
  const startListening = useCallback(async () => {
    if (!porcupineRef.current) {
      setError('Porcupine not initialized');
      return;
    }

    if (state === 'listening') {
      return; // Already listening
    }

    await subscribeToProcessor();
  }, [state, subscribeToProcessor]);

  /**
   * Stop listening for wake word
   */
  const stopListening = useCallback(async () => {
    if (!porcupineRef.current || !isProcessorSubscribedRef.current) {
      return;
    }

    try {
      await WebVoiceProcessor.unsubscribe(porcupineRef.current);
      isProcessorSubscribedRef.current = false;
      setState('ready');
    } catch (err) {
      console.error('Stop listening error:', err);
    }
  }, []);

  /**
   * Re-initialize the engine
   */
  const reinitialize = useCallback(async () => {
    // Release existing resources
    if (porcupineRef.current) {
      if (isProcessorSubscribedRef.current) {
        try {
          await WebVoiceProcessor.unsubscribe(porcupineRef.current);
        } catch {
          // Ignore unsubscribe errors
        }
        isProcessorSubscribedRef.current = false;
      }
      porcupineRef.current.terminate();
      porcupineRef.current = null;
    }

    // Re-initialize
    await initialize();
  }, [initialize]);

  /**
   * Release all resources
   */
  const release = useCallback(async () => {
    if (detectionTimeoutRef.current) {
      clearTimeout(detectionTimeoutRef.current);
      detectionTimeoutRef.current = null;
    }

    if (porcupineRef.current) {
      if (isProcessorSubscribedRef.current) {
        try {
          await WebVoiceProcessor.unsubscribe(porcupineRef.current);
        } catch {
          // Ignore unsubscribe errors
        }
        isProcessorSubscribedRef.current = false;
      }
      porcupineRef.current.terminate();
      porcupineRef.current = null;
    }

    setState('uninitialized');
    setError(null);
  }, []);

  // Initialize on mount (using microtask to avoid synchronous setState warning)
  useEffect(() => {
    let mounted = true;

    // Use queueMicrotask to defer initialization
    queueMicrotask(() => {
      if (mounted) {
        initialize();
      }
    });

    return () => {
      mounted = false;

      // Cleanup on unmount
      if (detectionTimeoutRef.current) {
        clearTimeout(detectionTimeoutRef.current);
      }

      if (porcupineRef.current) {
        if (isProcessorSubscribedRef.current) {
          WebVoiceProcessor.unsubscribe(porcupineRef.current).catch(() => {
            // Ignore cleanup errors
          });
        }
        porcupineRef.current.terminate();
      }
    };
  }, [initialize]);

  return {
    state,
    error,
    isListening: state === 'listening',
    isDetected: state === 'detected',
    isReady: state === 'ready' || state === 'listening' || state === 'detected',
    startListening,
    stopListening,
    reinitialize,
    release,
  };
}

/**
 * Available built-in keywords for Porcupine
 * Re-export the enum for convenience
 */
export { BuiltInKeyword } from '@picovoice/porcupine-web';

/**
 * Array of all built-in keywords for UI display
 */
export const BUILTIN_KEYWORDS: BuiltInKeyword[] = [
  BuiltInKeyword.Alexa,
  BuiltInKeyword.Americano,
  BuiltInKeyword.Blueberry,
  BuiltInKeyword.Bumblebee,
  BuiltInKeyword.Computer,
  BuiltInKeyword.Grapefruit,
  BuiltInKeyword.Grasshopper,
  BuiltInKeyword.HeyGoogle,
  BuiltInKeyword.HeySiri,
  BuiltInKeyword.Jarvis,
  BuiltInKeyword.OkayGoogle,
  BuiltInKeyword.Picovoice,
  BuiltInKeyword.Porcupine,
  BuiltInKeyword.Terminator,
];

/**
 * Get a display-friendly name for a built-in keyword
 */
export function getKeywordDisplayName(keyword: BuiltInKeyword): string {
  return keyword; // The enum values are already display-friendly
}
