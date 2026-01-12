'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Volume2, VolumeX, Settings, Loader2 } from 'lucide-react';
import { BreathingOrb, getOrbState, type OrbState } from '@/components/breathing-orb';
import {
  InsightFeed,
  createInsight,
  type InsightCardData,
} from '@/components/insight-card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBargeIn } from '@/hooks/use-barge-in';
import { useTranscription } from '@/hooks/use-transcription';
import { useAIResponseTTS } from '@/hooks/use-tts';
import { useWakeWord, BUILTIN_KEYWORDS, BuiltInKeyword } from '@/hooks/use-wake-word';

export default function MeetingPage() {
  // UI State
  const [isMuted, setIsMuted] = useState(false);
  const [insights, setInsights] = useState<InsightCardData[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedKeyword, setSelectedKeyword] = useState<BuiltInKeyword>(
    BuiltInKeyword.Computer
  );
  const [isProcessingAI, setIsProcessingAI] = useState(false);

  // Track last processed transcription to avoid duplicates
  const lastTranscriptionRef = useRef<string | null>(null);

  // TTS hook for speaking AI responses
  const {
    isSpeaking,
    serviceAvailable: ttsServiceAvailable,
    isMuted: ttsMuted,
    speakResponse,
    stopSpeaking,
    toggleMute: toggleTTSMute,
  } = useAIResponseTTS({
    speed: 'normal',
    onError: (error) => {
      console.error('TTS error:', error);
      setInsights((prev) => [
        createInsight('info', `TTS Error: ${error.message}`),
        ...prev,
      ]);
    },
  });

  // Barge-in hook - stops TTS when user starts speaking
  useBargeIn({
    threshold: 35,
    consecutiveFrames: 3,
    onBargeIn: () => {
      // User interrupted the assistant
      setInsights((prev) => [
        createInsight('info', 'Barge-in detected - listening...'),
        ...prev,
      ]);
    },
  });

  // Transcription hook
  const {
    state: transcriptionState,
    audioLevel,
    transcription,
    fullText,
    error: transcriptionError,
    serviceAvailable,
    startRecording,
    stopRecording,
  } = useTranscription({
    keepHistory: true,
    maxHistoryEntries: 100,
  });

  // Wake word callback - start recording when detected
  const handleWakeWord = useCallback(() => {
    if (transcriptionState === 'idle' || transcriptionState === 'ready') {
      startRecording();

      // Add an insight that we detected the wake word
      setInsights((prev) => [
        createInsight('info', `Wake word "${selectedKeyword}" detected. Listening...`),
        ...prev,
      ]);
    }
  }, [transcriptionState, startRecording, selectedKeyword]);

  // Wake word hook
  const {
    state: wakeWordState,
    error: wakeWordError,
    isListening: isWakeWordListening,
    startListening: startWakeWord,
    stopListening: stopWakeWord,
  } = useWakeWord({
    keyword: selectedKeyword,
    onWakeWord: handleWakeWord,
    autoStart: false,
  });

  // Calculate orb state - memoized to prevent unnecessary recalculations
  const orbState: OrbState = useMemo(
    () =>
      getOrbState({
        isMuted,
        isRecording: transcriptionState === 'recording',
        isTranscribing: transcriptionState === 'transcribing',
        isSpeaking,
      }),
    [isMuted, transcriptionState, isSpeaking]
  );

  // Send transcription to AI and speak response
  const processWithAI = useCallback(
    async (userText: string) => {
      if (!userText.trim()) return;

      setIsProcessingAI(true);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: userText,
              },
            ],
          }),
        });

        if (!response.ok) {
          throw new Error(`Chat API error: ${response.status}`);
        }

        // Read streaming response
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let fullResponse = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          // Parse SSE data - the AI SDK sends data in a specific format
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('0:')) {
              // Text delta from AI SDK
              try {
                const text = JSON.parse(line.slice(2));
                fullResponse += text;
              } catch {
                // Ignore parse errors
              }
            }
          }
        }

        if (fullResponse) {
          // Add AI response as insight
          setInsights((prev) => [
            createInsight('response', fullResponse, {
              title: 'Assistant',
            }),
            ...prev,
          ]);

          // Speak the response
          await speakResponse(fullResponse);
        }
      } catch (error) {
        console.error('AI processing error:', error);
        setInsights((prev) => [
          createInsight(
            'info',
            `Error: ${error instanceof Error ? error.message : 'Failed to process'}`
          ),
          ...prev,
        ]);
      } finally {
        setIsProcessingAI(false);
      }
    },
    [speakResponse]
  );

  // When transcription completes, add it as an insight and optionally process with AI
  useEffect(() => {
    const text = transcription?.text?.trim();
    if (text && text !== lastTranscriptionRef.current) {
      lastTranscriptionRef.current = text;
      queueMicrotask(() => {
        setInsights((prev) => [
          createInsight('response', text, {
            title: 'You',
          }),
          ...prev,
        ]);

        // Process transcription with AI
        processWithAI(text);
      });
    }
  }, [transcription, processWithAI]);

  // Handle mute toggle
  const toggleMute = useCallback(async () => {
    if (isMuted) {
      setIsMuted(false);
      if (wakeWordState === 'ready') {
        await startWakeWord();
      }
    } else {
      setIsMuted(true);
      if (isWakeWordListening) {
        await stopWakeWord();
      }
      if (transcriptionState === 'recording') {
        await stopRecording();
      }
    }
  }, [
    isMuted,
    wakeWordState,
    isWakeWordListening,
    transcriptionState,
    startWakeWord,
    stopWakeWord,
    stopRecording,
  ]);

  // Handle manual recording toggle
  const toggleRecording = useCallback(async () => {
    if (transcriptionState === 'recording') {
      await stopRecording();
    } else if (transcriptionState === 'idle' || transcriptionState === 'ready') {
      await startRecording();
    }
  }, [transcriptionState, startRecording, stopRecording]);

  // Start wake word on mount if service is available
  useEffect(() => {
    if (wakeWordState === 'ready' && !isMuted) {
      startWakeWord();
    }
  }, [wakeWordState, isMuted, startWakeWord]);

  return (
    <div
      className="fixed inset-0 flex bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950"
      role="application"
      aria-label="AI Meeting Assistant"
    >
      {/* Skip to main content link for keyboard navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        Skip to main content
      </a>

      {/* Main area with orb */}
      <main
        id="main-content"
        className="flex-1 flex flex-col items-center justify-center relative"
        aria-label="Voice assistant interface"
      >
        {/* Status bar */}
        <header
          className="absolute top-4 left-4 right-4 flex items-center justify-between"
          role="banner"
        >
          <div
            className="flex items-center gap-3"
            role="status"
            aria-label="Service status indicators"
          >
            {/* Whisper service status */}
            <div className="flex items-center gap-2 text-sm">
              <div
                className={`w-2 h-2 rounded-full ${
                  serviceAvailable ? 'bg-green-500' : 'bg-red-500'
                }`}
                role="img"
                aria-label={serviceAvailable ? 'Whisper service online' : 'Whisper service offline'}
              />
              <span className="text-muted-foreground">
                {serviceAvailable ? 'Whisper Ready' : 'Whisper Offline'}
              </span>
            </div>

            {/* Wake word status */}
            <div className="flex items-center gap-2 text-sm">
              <div
                className={`w-2 h-2 rounded-full ${
                  isWakeWordListening
                    ? 'bg-green-500 animate-pulse'
                    : wakeWordState === 'error'
                      ? 'bg-red-500'
                      : 'bg-slate-500'
                }`}
                role="img"
                aria-label={
                  isWakeWordListening
                    ? 'Wake word detection active'
                    : wakeWordState === 'error'
                      ? 'Wake word detection error'
                      : 'Wake word detection inactive'
                }
              />
              <span className="text-muted-foreground">
                {isWakeWordListening
                  ? `Listening for "${selectedKeyword}"`
                  : wakeWordState === 'error'
                    ? 'Wake word error'
                    : 'Wake word inactive'}
              </span>
            </div>

            {/* TTS service status */}
            <div className="flex items-center gap-2 text-sm">
              <div
                className={`w-2 h-2 rounded-full ${
                  ttsServiceAvailable
                    ? isSpeaking
                      ? 'bg-purple-500 animate-pulse'
                      : 'bg-green-500'
                    : 'bg-red-500'
                }`}
                role="img"
                aria-label={
                  ttsServiceAvailable
                    ? isSpeaking
                      ? 'Assistant speaking'
                      : 'Text-to-speech ready'
                    : 'Text-to-speech offline'
                }
              />
              <span className="text-muted-foreground">
                {ttsServiceAvailable
                  ? isSpeaking
                    ? 'Speaking...'
                    : ttsMuted
                      ? 'TTS Muted'
                      : 'Piper Ready'
                  : 'Piper Offline'}
              </span>
            </div>
          </div>

          {/* Settings toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSettings(!showSettings)}
            className="text-muted-foreground hover:text-foreground"
            aria-label={showSettings ? 'Close settings' : 'Open settings'}
            aria-expanded={showSettings}
            aria-controls="settings-panel"
          >
            <Settings className="h-5 w-5" aria-hidden="true" />
          </Button>
        </header>

        {/* Settings panel */}
        {showSettings && (
          <motion.div
            id="settings-panel"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-16 right-4 bg-slate-800 rounded-lg p-4 shadow-xl border border-slate-700"
            role="dialog"
            aria-label="Settings"
            aria-modal="false"
          >
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="wake-word-select"
                  className="text-sm text-muted-foreground mb-2 block"
                >
                  Wake Word
                </label>
                <Select
                  value={selectedKeyword}
                  onValueChange={(v) => setSelectedKeyword(v as BuiltInKeyword)}
                  disabled={isWakeWordListening}
                >
                  <SelectTrigger
                    id="wake-word-select"
                    className="w-40"
                    aria-label="Select wake word"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUILTIN_KEYWORDS.map((kw) => (
                      <SelectItem key={kw} value={kw}>
                        {kw}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </motion.div>
        )}

        {/* Breathing orb */}
        <BreathingOrb
          state={orbState}
          audioLevel={audioLevel}
          size={180}
        />

        {/* Current transcription */}
        {transcriptionState === 'recording' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8 max-w-md text-center"
          >
            <p className="text-lg text-slate-300 animate-pulse">
              Listening...
            </p>
          </motion.div>
        )}

        {transcriptionState === 'transcribing' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8 max-w-md text-center"
          >
            <p className="text-lg text-yellow-400 animate-pulse">
              Transcribing...
            </p>
          </motion.div>
        )}

        {isProcessingAI && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8 max-w-md text-center flex items-center gap-2 justify-center"
          >
            <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
            <p className="text-lg text-blue-400">
              Thinking...
            </p>
          </motion.div>
        )}

        {isSpeaking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8 max-w-md text-center"
          >
            <p className="text-lg text-purple-400 animate-pulse">
              Speaking...
            </p>
          </motion.div>
        )}

        {/* Full transcript display */}
        {fullText && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 max-w-lg px-4"
          >
            <p className="text-sm text-slate-400 text-center line-clamp-3">
              {fullText}
            </p>
          </motion.div>
        )}

        {/* Error display */}
        {(transcriptionError || wakeWordError) && (
          <div className="mt-4 px-4 py-2 bg-red-900/50 rounded-lg">
            <p className="text-sm text-red-300">
              {transcriptionError || wakeWordError}
            </p>
          </div>
        )}

        {/* Control buttons */}
        <nav
          className="absolute bottom-8 flex items-center gap-4"
          role="toolbar"
          aria-label="Meeting controls"
        >
          {/* Mute button */}
          <Button
            variant={isMuted ? 'destructive' : 'outline'}
            size="lg"
            onClick={toggleMute}
            className="rounded-full w-14 h-14"
            aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            aria-pressed={isMuted}
          >
            {isMuted ? (
              <MicOff className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Mic className="h-6 w-6" aria-hidden="true" />
            )}
          </Button>

          {/* Manual record button */}
          <Button
            variant={transcriptionState === 'recording' ? 'destructive' : 'default'}
            size="lg"
            onClick={toggleRecording}
            disabled={isMuted || transcriptionState === 'transcribing' || !serviceAvailable}
            className="rounded-full px-6"
            aria-label={
              transcriptionState === 'recording'
                ? 'Stop recording'
                : transcriptionState === 'transcribing'
                  ? 'Processing transcription'
                  : 'Start recording'
            }
            aria-busy={transcriptionState === 'transcribing'}
          >
            {transcriptionState === 'recording'
              ? 'Stop'
              : transcriptionState === 'transcribing'
                ? 'Processing...'
                : 'Record'}
          </Button>

          {/* Speaker mute / stop TTS */}
          <Button
            variant={ttsMuted ? 'destructive' : 'outline'}
            size="lg"
            onClick={() => {
              if (isSpeaking) {
                stopSpeaking();
              } else {
                toggleTTSMute();
              }
            }}
            className="rounded-full w-14 h-14"
            aria-label={
              isSpeaking
                ? 'Stop speaking'
                : ttsMuted
                  ? 'Unmute speaker'
                  : 'Mute speaker'
            }
            aria-pressed={ttsMuted}
          >
            {ttsMuted ? (
              <VolumeX className="h-6 w-6" aria-hidden="true" />
            ) : isSpeaking ? (
              <VolumeX className="h-6 w-6 animate-pulse" aria-hidden="true" />
            ) : (
              <Volume2 className="h-6 w-6" aria-hidden="true" />
            )}
          </Button>
        </nav>
      </main>

      {/* Insights sidebar */}
      <motion.aside
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="w-96 bg-slate-900/80 border-l border-slate-800 p-4 flex flex-col"
        aria-label="Insights and conversation history"
      >
        <h2
          id="insights-heading"
          className="text-lg font-semibold text-slate-200 mb-4"
        >
          Insights
        </h2>
        <InsightFeed
          cards={insights}
          className="flex-1"
          emptyMessage="Speak to the assistant or trigger the wake word to get started..."
          ariaLabel="Conversation history and AI responses"
        />
      </motion.aside>
    </div>
  );
}
