'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  checkTranscriptionService,
  transcribeAudio,
  TranscriptionError,
  type TranscriptionResult,
} from '@/lib/whisper';
import { useAudio, type AudioState, type UseAudioOptions } from './use-audio';

export type TranscriptionState =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'ready'
  | 'error';

export interface TranscriptionEntry {
  id: string;
  text: string;
  timestamp: Date;
  language?: string | undefined;
  duration?: number | undefined;
}

export interface UseTranscriptionOptions extends UseAudioOptions {
  /** Automatically transcribe when recording stops */
  autoTranscribe?: boolean;
  /** Language hint for transcription (optional) */
  language?: string;
  /** Keep history of transcriptions */
  keepHistory?: boolean;
  /** Maximum history entries to keep */
  maxHistoryEntries?: number;
}

export interface UseTranscriptionReturn {
  /** Combined transcription state */
  state: TranscriptionState;
  /** Audio recording state */
  audioState: AudioState;
  /** Current audio level (0-1) */
  audioLevel: number;
  /** Most recent transcription result */
  transcription: TranscriptionResult | null;
  /** Full transcription text (concatenated history) */
  fullText: string;
  /** Transcription history */
  history: TranscriptionEntry[];
  /** Error message if any */
  error: string | null;
  /** Whether transcription service is available */
  serviceAvailable: boolean;
  /** Start recording */
  startRecording: () => Promise<void>;
  /** Stop recording and transcribe */
  stopRecording: () => Promise<TranscriptionResult | null>;
  /** Stop recording without transcribing */
  cancelRecording: () => Promise<void>;
  /** Manually transcribe audio blob */
  transcribe: (audioBlob: Blob) => Promise<TranscriptionResult | null>;
  /** Clear transcription history */
  clearHistory: () => void;
  /** Check service availability */
  checkService: () => Promise<boolean>;
}

/**
 * Hook that combines audio recording with transcription.
 *
 * @example
 * ```tsx
 * const {
 *   state,
 *   audioLevel,
 *   transcription,
 *   startRecording,
 *   stopRecording,
 * } = useTranscription();
 *
 * const handleToggle = async () => {
 *   if (state === 'idle' || state === 'ready') {
 *     await startRecording();
 *   } else if (state === 'recording') {
 *     const result = await stopRecording();
 *     console.log('Transcription:', result?.text);
 *   }
 * };
 * ```
 */
export function useTranscription(
  options: UseTranscriptionOptions = {}
): UseTranscriptionReturn {
  const {
    autoTranscribe = true,
    language,
    keepHistory = true,
    maxHistoryEntries = 100,
    ...audioOptions
  } = options;

  // Audio recording hook
  const audio = useAudio(audioOptions);

  // Transcription state
  const [transcriptionState, setTranscriptionState] =
    useState<TranscriptionState>('idle');
  const [transcription, setTranscription] =
    useState<TranscriptionResult | null>(null);
  const [history, setHistory] = useState<TranscriptionEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [serviceAvailable, setServiceAvailable] = useState(true);

  // Ref to track if we're currently transcribing
  const isTranscribingRef = useRef(false);

  /**
   * Check if the transcription service is available
   */
  const checkService = useCallback(async (): Promise<boolean> => {
    const status = await checkTranscriptionService();
    setServiceAvailable(status.available);
    if (!status.available && status.error) {
      setError(status.error);
    }
    return status.available;
  }, []);

  /**
   * Transcribe an audio blob
   */
  const transcribe = useCallback(
    async (audioBlob: Blob): Promise<TranscriptionResult | null> => {
      if (isTranscribingRef.current) {
        return null;
      }

      isTranscribingRef.current = true;
      setTranscriptionState('transcribing');
      setError(null);

      try {
        const result = await transcribeAudio(audioBlob, {
          language,
          task: 'transcribe',
        });

        setTranscription(result);

        // Add to history
        if (keepHistory && result.text.trim()) {
          const entry: TranscriptionEntry = {
            id: crypto.randomUUID(),
            text: result.text,
            timestamp: new Date(),
            language: result.language,
            duration: result.duration,
          };

          setHistory((prev) => {
            const updated = [entry, ...prev];
            return updated.slice(0, maxHistoryEntries);
          });
        }

        setTranscriptionState('ready');
        return result;
      } catch (err) {
        const message =
          err instanceof TranscriptionError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Transcription failed';

        setError(message);
        setTranscriptionState('error');

        // Check if service went down
        if (
          err instanceof TranscriptionError &&
          (err.statusCode === 503 || err.statusCode === 0)
        ) {
          setServiceAvailable(false);
        }

        return null;
      } finally {
        isTranscribingRef.current = false;
      }
    },
    [language, keepHistory, maxHistoryEntries]
  );

  /**
   * Start recording audio
   */
  const startRecording = useCallback(async () => {
    setError(null);
    setTranscriptionState('recording');
    await audio.startRecording();
  }, [audio]);

  /**
   * Stop recording and transcribe
   */
  const stopRecording = useCallback(async (): Promise<TranscriptionResult | null> => {
    const audioBlob = await audio.stopRecording();

    if (!audioBlob) {
      setTranscriptionState('idle');
      return null;
    }

    if (autoTranscribe) {
      return transcribe(audioBlob);
    } else {
      setTranscriptionState('ready');
      return null;
    }
  }, [audio, autoTranscribe, transcribe]);

  /**
   * Cancel recording without transcribing
   */
  const cancelRecording = useCallback(async () => {
    await audio.stopRecording();
    setTranscriptionState('idle');
  }, [audio]);

  /**
   * Clear transcription history
   */
  const clearHistory = useCallback(() => {
    setHistory([]);
    setTranscription(null);
  }, []);

  // Compute full text from history
  const fullText = history
    .map((entry) => entry.text)
    .reverse()
    .join(' ');

  // Sync transcription state with audio state
  useEffect(() => {
    if (audio.state === 'error') {
      setError(audio.error);
      setTranscriptionState('error');
    } else if (audio.state === 'recording') {
      setTranscriptionState('recording');
    }
  }, [audio.state, audio.error]);

  // Check service availability on mount
  useEffect(() => {
    checkService();
  }, [checkService]);

  // Compute combined state
  const combinedState: TranscriptionState =
    transcriptionState === 'transcribing'
      ? 'transcribing'
      : audio.state === 'recording'
        ? 'recording'
        : transcriptionState;

  return {
    state: combinedState,
    audioState: audio.state,
    audioLevel: audio.audioLevel,
    transcription,
    fullText,
    history,
    error: error || audio.error,
    serviceAvailable,
    startRecording,
    stopRecording,
    cancelRecording,
    transcribe,
    clearHistory,
    checkService,
  };
}
