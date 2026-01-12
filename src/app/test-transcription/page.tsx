'use client';

import { useState, useCallback } from 'react';
import {
  AudioLevelMeter,
  AudioVisualizer,
} from '@/components/audio-visualizer';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranscription } from '@/hooks/use-transcription';
import { useWakeWord, BUILTIN_KEYWORDS, BuiltInKeyword } from '@/hooks/use-wake-word';

export default function TestTranscriptionPage() {
  const [selectedKeyword, setSelectedKeyword] = useState<BuiltInKeyword>(BuiltInKeyword.Computer);

  const {
    state,
    audioLevel,
    transcription,
    fullText,
    history,
    error,
    serviceAvailable,
    startRecording,
    stopRecording,
    cancelRecording,
    clearHistory,
    checkService,
  } = useTranscription({
    keepHistory: true,
    maxHistoryEntries: 50,
  });

  // Callback when wake word is detected - start recording
  const handleWakeWord = useCallback(() => {
    if (state === 'idle' || state === 'ready') {
      startRecording();
    }
  }, [state, startRecording]);

  const {
    state: wakeWordState,
    error: wakeWordError,
    isListening: isWakeWordListening,
    isDetected: isWakeWordDetected,
    startListening: startWakeWord,
    stopListening: stopWakeWord,
    reinitialize: reinitializeWakeWord,
  } = useWakeWord({
    keyword: selectedKeyword,
    onWakeWord: handleWakeWord,
    autoStart: false,
  });

  const [isChecking, setIsChecking] = useState(false);

  const handleToggleRecording = async () => {
    if (state === 'recording') {
      await stopRecording();
    } else if (state === 'idle' || state === 'ready' || state === 'error') {
      await startRecording();
    }
  };

  const handleCheckService = async () => {
    setIsChecking(true);
    await checkService();
    setIsChecking(false);
  };

  const getStateColor = () => {
    switch (state) {
      case 'recording':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
      case 'transcribing':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100';
      case 'ready':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100';
    }
  };

  const getButtonText = () => {
    switch (state) {
      case 'recording':
        return 'Stop & Transcribe';
      case 'transcribing':
        return 'Transcribing...';
      default:
        return 'Start Recording';
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">Transcription Test</h1>
      <p className="text-muted-foreground mb-8">
        Test audio recording and speech-to-text transcription
      </p>

      <div className="grid gap-6">
        {/* Service Status */}
        <Card>
          <CardHeader>
            <CardTitle>Whisper Service Status</CardTitle>
            <CardDescription>
              Local Faster-Whisper transcription service
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    serviceAvailable ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
                <span>
                  {serviceAvailable ? 'Connected' : 'Unavailable'}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCheckService}
                disabled={isChecking}
              >
                {isChecking ? 'Checking...' : 'Check Connection'}
              </Button>
            </div>
            {!serviceAvailable && (
              <p className="text-sm text-muted-foreground mt-2">
                Make sure the Whisper service is running on port 8001. Run:{' '}
                <code className="bg-muted px-1 rounded">
                  cd services/whisper && python main.py
                </code>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Wake Word Detection */}
        <Card>
          <CardHeader>
            <CardTitle>Wake Word Detection</CardTitle>
            <CardDescription>
              Say the wake word to start recording automatically
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Wake word state indicator */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      isWakeWordDetected
                        ? 'bg-yellow-500 animate-pulse'
                        : isWakeWordListening
                          ? 'bg-green-500'
                          : wakeWordState === 'error'
                            ? 'bg-red-500'
                            : wakeWordState === 'ready'
                              ? 'bg-blue-500'
                              : 'bg-gray-400'
                    }`}
                  />
                  <span className="text-sm capitalize">
                    {isWakeWordDetected ? 'Detected!' : wakeWordState}
                  </span>
                </div>
              </div>

              {/* Wake word error */}
              {wakeWordError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {wakeWordError}
                  </p>
                  {wakeWordError.includes('access key') && (
                    <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                      Get a free key at{' '}
                      <a
                        href="https://console.picovoice.ai/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        console.picovoice.ai
                      </a>
                    </p>
                  )}
                </div>
              )}

              {/* Keyword selector */}
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium">Wake Word:</label>
                <Select
                  value={selectedKeyword}
                  onValueChange={(value) => {
                    setSelectedKeyword(value as BuiltInKeyword);
                    // Will reinitialize on next start
                  }}
                  disabled={isWakeWordListening}
                >
                  <SelectTrigger className="w-40">
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

              {/* Wake word controls */}
              <div className="flex gap-3">
                {isWakeWordListening ? (
                  <Button
                    variant="outline"
                    onClick={async () => {
                      await stopWakeWord();
                    }}
                  >
                    Stop Wake Word
                  </Button>
                ) : (
                  <Button
                    onClick={async () => {
                      if (wakeWordState === 'ready') {
                        await startWakeWord();
                      } else if (wakeWordState === 'error') {
                        await reinitializeWakeWord();
                      }
                    }}
                    disabled={wakeWordState === 'initializing' || wakeWordState === 'uninitialized'}
                  >
                    {wakeWordState === 'initializing'
                      ? 'Initializing...'
                      : wakeWordState === 'error'
                        ? 'Retry'
                        : 'Start Wake Word'}
                  </Button>
                )}
              </div>

              {isWakeWordListening && (
                <p className="text-sm text-muted-foreground">
                  Say &quot;{selectedKeyword}&quot; to start recording...
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Status & Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Recording Controls</CardTitle>
            <CardDescription>Record and transcribe audio</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* State indicator */}
              <div className="flex items-center gap-4">
                <span className="font-medium">State:</span>
                <span
                  className={`px-3 py-1 rounded-full text-sm ${getStateColor()}`}
                >
                  {state}
                </span>
              </div>

              {/* Error message */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {error}
                  </p>
                </div>
              )}

              {/* Audio level */}
              <div>
                <span className="font-medium text-sm">Audio Level</span>
                <AudioLevelMeter
                  audioLevel={audioLevel}
                  isActive={state === 'recording'}
                />
              </div>

              {/* Visualizer */}
              <div className="flex justify-center py-4">
                <AudioVisualizer
                  audioLevel={audioLevel}
                  isActive={state === 'recording'}
                  style="circle"
                  width={120}
                  height={120}
                  color={state === 'transcribing' ? '#eab308' : '#22c55e'}
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={handleToggleRecording}
                  variant={state === 'recording' ? 'destructive' : 'default'}
                  size="lg"
                  disabled={state === 'transcribing' || !serviceAvailable}
                >
                  {getButtonText()}
                </Button>
                {state === 'recording' && (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={cancelRecording}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Latest Transcription */}
        <Card>
          <CardHeader>
            <CardTitle>Latest Transcription</CardTitle>
            <CardDescription>
              Most recent transcription result
            </CardDescription>
          </CardHeader>
          <CardContent>
            {transcription ? (
              <div className="space-y-3">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-lg">{transcription.text || '(empty)'}</p>
                </div>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  {transcription.language && (
                    <span>Language: {transcription.language}</span>
                  )}
                  {transcription.duration && (
                    <span>Duration: {transcription.duration.toFixed(1)}s</span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">
                No transcription yet. Record some audio to get started.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Transcription History */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Transcription History</CardTitle>
                <CardDescription>
                  {history.length} transcription{history.length !== 1 ? 's' : ''}
                </CardDescription>
              </div>
              {history.length > 0 && (
                <Button variant="outline" size="sm" onClick={clearHistory}>
                  Clear History
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {history.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3 bg-muted rounded-lg border-l-4 border-primary"
                  >
                    <p>{entry.text}</p>
                    <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                      <span>{entry.timestamp.toLocaleTimeString()}</span>
                      {entry.language && <span>Lang: {entry.language}</span>}
                      {entry.duration && (
                        <span>{entry.duration.toFixed(1)}s</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">
                Transcription history will appear here.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Full Text */}
        {fullText && (
          <Card>
            <CardHeader>
              <CardTitle>Full Transcript</CardTitle>
              <CardDescription>
                All transcriptions concatenated
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-muted rounded-lg max-h-48 overflow-y-auto">
                <p className="whitespace-pre-wrap">{fullText}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
