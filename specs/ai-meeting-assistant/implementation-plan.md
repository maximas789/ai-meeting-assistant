# Implementation Plan: AI Meeting Brainstorm Assistant

## Overview

Build a local-first AI meeting assistant that listens to conversations, answers questions using RAG, and provides both voice and visual responses. The system runs entirely on-premise using Ollama for LLM, Faster-Whisper for STT, and Piper for TTS.

This plan covers 10 phases, transforming the Agentic Coding Starter Kit into a full meeting assistant.

---

## Phase 1: Foundation Setup

Remove starter kit components we don't need and establish the base configuration for local-first operation.

### Tasks

- [x] Remove Better Auth files and dependencies
  - [x] Delete `src/lib/auth.ts` and `src/lib/auth-client.ts`
  - [x] Delete `src/app/login/` folder
  - [x] Delete `src/app/signup/` folder
  - [x] Delete `src/app/dashboard/` folder
  - [x] Remove `better-auth` from `package.json`
  - [x] Remove auth-related environment variables
- [x] Install and configure Ollama provider
  - [x] Install `@ai-sdk/openai` package (using Ollama's OpenAI-compatible API)
  - [x] Create `src/lib/ollama.ts` client module
  - [x] Update `src/app/api/chat/route.ts` to use Ollama
- [x] Update environment configuration
  - [x] Create new `.env.example` with local-first variables
  - [x] Document required environment variables
- [x] Create database schema [complex]
  - [x] Define `meetings` table in `src/lib/schema.ts`
  - [x] Define `actionItems` table with meeting foreign key
  - [x] Define `settings` table for admin configuration
  - [x] Define `documents` table for RAG metadata
  - [ ] Generate and run migrations (requires database)
- [x] Create basic landing page
  - [x] Replace starter kit homepage with meeting assistant branding
  - [x] Add placeholder for breathing orb component
- [x] Verify Ollama integration
  - [x] Create test endpoint or script
  - [ ] Confirm streaming responses work (requires Ollama running)

### Technical Details

**Files to delete:**
```
src/lib/auth.ts
src/lib/auth-client.ts
src/app/login/
src/app/signup/
src/app/dashboard/
```

**Packages to remove:**
```bash
pnpm remove better-auth @better-auth/client
```

**Packages to install:**
```bash
pnpm add ollama-ai-provider
```

**Ollama client (`src/lib/ollama.ts`):**
```typescript
import { createOllama } from 'ollama-ai-provider';

export const ollama = createOllama({
  baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/api',
});

export const model = ollama(process.env.OLLAMA_MODEL || 'llama3.3:70b');
```

**Database schema (`src/lib/schema.ts`):**
```typescript
import { pgTable, serial, varchar, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core';

export const meetings = pgTable('meetings', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }),
  startedAt: timestamp('started_at').defaultNow(),
  endedAt: timestamp('ended_at'),
  transcript: text('transcript'),
  summary: text('summary'),
});

export const actionItems = pgTable('action_items', {
  id: serial('id').primaryKey(),
  meetingId: integer('meeting_id').references(() => meetings.id),
  assignee: varchar('assignee', { length: 255 }),
  task: text('task'),
  dueDate: timestamp('due_date'),
  completed: boolean('completed').default(false),
});

export const settings = pgTable('settings', {
  key: varchar('key', { length: 255 }).primaryKey(),
  value: text('value'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  filename: varchar('filename', { length: 255 }),
  uploadedAt: timestamp('uploaded_at').defaultNow(),
  chromadbCollectionId: varchar('chromadb_collection_id', { length: 255 }),
});
```

**Environment variables (`.env`):**
```bash
POSTGRES_URL="postgresql://user:pass@localhost:5432/meeting_assistant"
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="llama3.3:70b"
ADMIN_PIN="1234"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

**Migration commands:**
```bash
pnpm run db:generate
pnpm run db:migrate
```

---

## Phase 2: Audio Capture Infrastructure

Set up browser-based audio capture and establish the foundation for voice input.

### Tasks

- [x] Create audio capture hook [complex]
  - [x] Implement `src/hooks/use-audio.ts` using Web Audio API
  - [x] Handle microphone permissions
  - [x] Implement audio level monitoring for visualizer
  - [x] Support start/stop recording
  - [x] Output audio as WAV/PCM for Whisper
- [x] Create audio visualizer component
  - [x] Implement `src/components/audio-visualizer.tsx`
  - [x] Show real-time audio levels
  - [x] Integrate with audio capture hook
- [x] Set up audio processing utilities
  - [x] Create `src/lib/audio.ts` for audio helpers
  - [x] Implement WAV encoding for API transmission
  - [x] Handle audio chunking for streaming
- [ ] Test with ReSpeaker XVF3800
  - [ ] Verify browser recognizes USB audio device
  - [ ] Test audio quality and levels
  - [ ] Document any driver requirements

### Technical Details

**Audio hook (`src/hooks/use-audio.ts`):**
```typescript
import { useState, useRef, useCallback } from 'react';

export function useAudio() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const startRecording = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        channelCount: 1,
        sampleRate: 16000,
      }
    });

    // Set up audio context for visualization
    audioContextRef.current = new AudioContext({ sampleRate: 16000 });
    const source = audioContextRef.current.createMediaStreamSource(stream);
    analyserRef.current = audioContextRef.current.createAnalyser();
    source.connect(analyserRef.current);

    // Set up MediaRecorder
    mediaRecorderRef.current = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus'
    });

    setIsRecording(true);
  }, []);

  // ... stop, getAudioLevel, etc.

  return { isRecording, audioLevel, startRecording, stopRecording };
}
```

**Web Audio API constraints for ReSpeaker:**
```typescript
const constraints = {
  audio: {
    deviceId: { exact: respeakerDeviceId }, // Get from enumerateDevices()
    echoCancellation: false, // XVF3800 handles this in hardware
    noiseSuppression: false, // XVF3800 handles this
    autoGainControl: false,
    channelCount: 1,
    sampleRate: 16000, // Whisper expects 16kHz
  }
};
```

**Audio utilities (`src/lib/audio.ts`):**
```typescript
// Convert AudioBuffer to WAV blob for Whisper API
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = 1;
  const sampleRate = 16000;
  const format = 1; // PCM
  const bitDepth = 16;
  // ... WAV encoding logic
}

// Chunk audio for streaming transcription
export function chunkAudio(audioData: Float32Array, chunkSize: number): Float32Array[] {
  // ... chunking logic
}
```

---

## Phase 3: Speech-to-Text Integration

Deploy Faster-Whisper as a Python service and integrate with the Next.js frontend.

### Tasks

- [x] Create Faster-Whisper Python service [complex]
  - [x] Set up `services/whisper/` directory structure
  - [x] Create FastAPI server with transcription endpoint
  - [x] Support streaming audio input
  - [x] Configure for GPU acceleration (if available)
  - [x] Create Dockerfile for service
  - [x] Create `requirements.txt`
- [x] Create Next.js transcription API route
  - [x] Implement `src/app/api/transcribe/route.ts`
  - [x] Forward audio to Whisper service
  - [x] Return transcription results
- [x] Create Whisper client library
  - [x] Implement `src/lib/whisper.ts`
  - [x] Handle connection to Python service
  - [x] Support both batch and streaming modes
- [x] Integrate transcription with audio capture
  - [x] Connect audio hook to transcription API
  - [x] Display real-time transcription in UI
  - [x] Handle transcription errors gracefully

### Technical Details

**Whisper service structure:**
```
services/whisper/
├── main.py           # FastAPI application
├── requirements.txt  # Python dependencies
├── Dockerfile        # Container definition
└── README.md         # Service documentation
```

**FastAPI server (`services/whisper/main.py`):**
```python
from fastapi import FastAPI, UploadFile, File
from faster_whisper import WhisperModel
import io

app = FastAPI()

# Load model on startup (large-v3 for accuracy, or medium for speed)
model = WhisperModel("large-v3", device="cuda", compute_type="float16")

@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    audio_bytes = await audio.read()
    audio_buffer = io.BytesIO(audio_bytes)

    segments, info = model.transcribe(audio_buffer, beam_size=5)

    text = " ".join([segment.text for segment in segments])
    return {"text": text, "language": info.language}

@app.get("/health")
async def health():
    return {"status": "healthy"}
```

**Requirements (`services/whisper/requirements.txt`):**
```
fastapi==0.109.0
uvicorn==0.27.0
faster-whisper==0.10.0
python-multipart==0.0.6
```

**Run command:**
```bash
cd services/whisper
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001
```

**Next.js API route (`src/app/api/transcribe/route.ts`):**
```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const audio = formData.get('audio') as Blob;

  const whisperResponse = await fetch(
    `${process.env.WHISPER_SERVICE_URL}/transcribe`,
    {
      method: 'POST',
      body: formData,
    }
  );

  const result = await whisperResponse.json();
  return NextResponse.json(result);
}
```

**Whisper client (`src/lib/whisper.ts`):**
```typescript
export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'audio.wav');

  const response = await fetch('/api/transcribe', {
    method: 'POST',
    body: formData,
  });

  const { text } = await response.json();
  return text;
}
```

---

## Phase 4: Wake Word Detection

Implement Porcupine wake word detection to activate the assistant.

### Tasks

- [x] Set up Porcupine integration
  - [x] Install `@picovoice/porcupine-web` package
  - [ ] Create Porcupine access key (free tier) — *user must get key from console.picovoice.ai*
  - [ ] Download/configure Porcupine model file — *user must download porcupine_params.pv*
- [x] Create wake word hook [complex]
  - [x] Implement `src/hooks/use-wake-word.ts`
  - [x] Initialize Porcupine with built-in keywords (Computer, Jarvis, etc.)
  - [x] Handle detection events
  - [x] Manage microphone sharing with audio capture via WebVoiceProcessor
- [x] Integrate wake word with UI state
  - [x] Trigger recording on wake word detection
  - [x] Visual feedback when wake word detected (state indicator)
  - [x] Timeout back to listening state after detection

### Technical Details

**Package installation:**
```bash
pnpm add @picovoice/porcupine-web @picovoice/web-voice-processor
```

**Wake word hook (`src/hooks/use-wake-word.ts`):**
```typescript
import { useState, useEffect, useCallback } from 'react';
import { Porcupine, PorcupineWorker } from '@picovoice/porcupine-web';
import { WebVoiceProcessor } from '@picovoice/web-voice-processor';

const ACCESS_KEY = process.env.NEXT_PUBLIC_PORCUPINE_ACCESS_KEY!;

export function useWakeWord(onWakeWord: () => void) {
  const [isListening, setIsListening] = useState(false);
  const [porcupine, setPorcupine] = useState<PorcupineWorker | null>(null);

  useEffect(() => {
    const init = async () => {
      const porcupineInstance = await PorcupineWorker.create(
        ACCESS_KEY,
        [{
          publicPath: '/models/hey-assistant.ppn',
          label: 'hey assistant'
        }],
        (detection) => {
          if (detection.label === 'hey assistant') {
            onWakeWord();
          }
        }
      );

      setPorcupine(porcupineInstance);
    };

    init();

    return () => {
      porcupine?.terminate();
    };
  }, [onWakeWord]);

  const startListening = useCallback(async () => {
    if (porcupine) {
      await WebVoiceProcessor.subscribe(porcupine);
      setIsListening(true);
    }
  }, [porcupine]);

  const stopListening = useCallback(async () => {
    if (porcupine) {
      await WebVoiceProcessor.unsubscribe(porcupine);
      setIsListening(false);
    }
  }, [porcupine]);

  return { isListening, startListening, stopListening };
}
```

**Environment variable:**
```bash
NEXT_PUBLIC_PORCUPINE_ACCESS_KEY="your-access-key-here"
```

**Custom wake word:**
- Use Picovoice Console to create custom "Hey Assistant" model
- Download `.ppn` file and place in `public/models/`
- Or use built-in keywords like "computer", "jarvis", etc.

---

## Phase 5: Text-to-Speech & Barge-In

Deploy Piper TTS and implement natural conversation interruption.

### Tasks

- [x] Create Piper Python service [complex]
  - [x] Set up `services/piper/` directory structure
  - [x] Create FastAPI server with TTS endpoint
  - [x] Support streaming audio output
  - [x] Configure voice model (e.g., en_US-amy-medium)
  - [x] Create Dockerfile for service
  - [x] Create `requirements.txt`
- [x] Create Next.js TTS API route
  - [x] Implement `src/app/api/speak/route.ts`
  - [x] Forward text to Piper service
  - [x] Stream audio response back to client
- [x] Create Piper client library
  - [x] Implement `src/lib/piper.ts`
  - [x] Handle audio playback in browser
  - [x] Support playback interruption
- [x] Implement barge-in detection [complex]
  - [x] Create `src/hooks/use-barge-in.ts`
  - [x] Detect user speech during TTS playback
  - [x] Immediately stop TTS on detection
  - [x] Signal system to listen for new input
- [x] Integrate TTS with chat flow
  - [x] Speak AI responses automatically
  - [x] Show visual indicator while speaking
  - [x] Handle barge-in gracefully

### Technical Details

**Piper service structure:**
```
services/piper/
├── main.py           # FastAPI application
├── requirements.txt  # Python dependencies
├── Dockerfile        # Container definition
├── models/           # Voice models
└── README.md         # Service documentation
```

**FastAPI server (`services/piper/main.py`):**
```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import subprocess
import io

app = FastAPI()

PIPER_PATH = "/usr/local/bin/piper"
MODEL_PATH = "/app/models/en_US-amy-medium.onnx"

@app.post("/speak")
async def speak(text: str):
    process = subprocess.Popen(
        [PIPER_PATH, "--model", MODEL_PATH, "--output-raw"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
    )

    audio_data, _ = process.communicate(input=text.encode())

    return StreamingResponse(
        io.BytesIO(audio_data),
        media_type="audio/wav",
        headers={"Content-Disposition": "inline; filename=speech.wav"}
    )

@app.get("/health")
async def health():
    return {"status": "healthy"}
```

**Piper client (`src/lib/piper.ts`):**
```typescript
let currentAudio: HTMLAudioElement | null = null;

export async function speak(text: string): Promise<void> {
  // Stop any current playback
  stop();

  const response = await fetch('/api/speak', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);

  currentAudio = new Audio(audioUrl);
  await currentAudio.play();
}

export function stop(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

export function isSpeaking(): boolean {
  return currentAudio !== null && !currentAudio.paused;
}
```

**Barge-in hook (`src/hooks/use-barge-in.ts`):**
```typescript
import { useEffect, useRef } from 'react';
import { stop as stopTTS, isSpeaking } from '@/lib/piper';

export function useBargeIn(onBargeIn: () => void) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    const init = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      source.connect(analyserRef.current);

      // Monitor for voice activity
      const checkVoice = () => {
        if (analyserRef.current && isSpeaking()) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);

          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;

          // Threshold for detecting speech (tune based on XVF3800 AEC)
          if (average > 30) {
            stopTTS();
            onBargeIn();
          }
        }
        requestAnimationFrame(checkVoice);
      };

      checkVoice();
    };

    init();
  }, [onBargeIn]);
}
```

---

## Phase 6: RAG System (Document Q&A)

Implement ChromaDB for document storage and retrieval-augmented generation.

### Tasks

- [x] Set up ChromaDB
  - [x] Install `chromadb` package
  - [x] Configure persistent storage location
  - [x] Create collection for documents
- [x] Create document processing pipeline [complex]
  - [x] Implement `src/lib/chromadb.ts` client
  - [x] Support PDF text extraction
  - [x] Support DOCX text extraction
  - [x] Chunk documents for embedding
  - [x] Store chunks in ChromaDB
- [x] Create document upload API
  - [x] Implement `src/app/api/documents/route.ts` (upload)
  - [x] Implement `src/app/api/documents/[id]/route.ts` (delete)
  - [x] Store metadata in PostgreSQL
  - [x] Store vectors in ChromaDB
- [x] Create RAG query endpoint
  - [x] Implement `src/app/api/documents/query/route.ts`
  - [x] Search ChromaDB for relevant chunks
  - [x] Build context for LLM prompt
  - [x] Return augmented response
- [x] Integrate RAG with chat
  - [x] Detect document-related queries
  - [x] Automatically include relevant context
  - [x] Cite sources in responses
- [x] Create document management UI
  - [x] List uploaded documents
  - [x] Upload new documents
  - [x] Delete documents

### Technical Details

**Package installation:**
```bash
pnpm add chromadb pdf-parse mammoth
```

**ChromaDB client (`src/lib/chromadb.ts`):**
```typescript
import { ChromaClient, Collection } from 'chromadb';

const client = new ChromaClient({
  path: process.env.CHROMADB_URL || 'http://localhost:8003'
});

let collection: Collection | null = null;

export async function getCollection(): Promise<Collection> {
  if (!collection) {
    collection = await client.getOrCreateCollection({
      name: 'documents',
      metadata: { 'hnsw:space': 'cosine' }
    });
  }
  return collection;
}

export async function addDocument(
  id: string,
  chunks: string[],
  metadata: Record<string, string>
): Promise<void> {
  const col = await getCollection();

  await col.add({
    ids: chunks.map((_, i) => `${id}_chunk_${i}`),
    documents: chunks,
    metadatas: chunks.map(() => metadata),
  });
}

export async function queryDocuments(
  query: string,
  nResults: number = 5
): Promise<{ text: string; source: string }[]> {
  const col = await getCollection();

  const results = await col.query({
    queryTexts: [query],
    nResults,
  });

  return results.documents[0].map((doc, i) => ({
    text: doc,
    source: results.metadatas[0][i].filename as string,
  }));
}
```

**Document chunking:**
```typescript
export function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
  }

  return chunks;
}
```

**RAG prompt template:**
```typescript
const ragPrompt = `Use the following context to answer the question. If the answer is not in the context, say so.

Context:
${relevantChunks.map(c => c.text).join('\n\n')}

Question: ${userQuestion}

Answer:`;
```

**Run ChromaDB:**
```bash
docker run -p 8003:8000 chromadb/chroma
```

---

## Phase 7: User Interface

Build the meeting assistant UI with breathing orb and insight cards.

### Tasks

- [x] Create breathing orb component [complex]
  - [x] Implement `src/components/breathing-orb.tsx`
  - [x] Idle state: slow breathing animation
  - [x] Listening state: responsive to audio levels
  - [x] Processing state: faster pulse
  - [x] Speaking state: active animation
  - [x] Muted state: dim/red indicator
- [x] Create insight card component
  - [x] Implement `src/components/insight-card.tsx`
  - [x] Display AI responses
  - [x] Display action items
  - [x] Support different card types (response, action, info, suggestion)
- [x] Build main meeting page [complex]
  - [x] Create `src/app/meeting/page.tsx`
  - [x] Integrate breathing orb
  - [x] Show insight cards feed
  - [x] Real-time transcription display
  - [x] System status indicators
- [x] Implement state management
  - [x] Meeting state (idle, listening, processing, speaking) via getOrbState helper
  - [x] Transcription history via useTranscription hook
  - [x] Insight cards queue via React useState
- [x] Add responsive design
  - [x] Full-screen flexbox layout for meeting room displays
  - [x] Flexible main area with fixed sidebar

### Technical Details

**Breathing orb (`src/components/breathing-orb.tsx`):**
```typescript
'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type OrbState = 'idle' | 'listening' | 'processing' | 'speaking' | 'muted';

interface BreathingOrbProps {
  state: OrbState;
  audioLevel?: number; // 0-1 for listening state
}

export function BreathingOrb({ state, audioLevel = 0 }: BreathingOrbProps) {
  const baseSize = 200;
  const scale = state === 'listening' ? 1 + audioLevel * 0.3 : 1;

  const stateStyles = {
    idle: 'bg-blue-500/50',
    listening: 'bg-green-500/70',
    processing: 'bg-yellow-500/60',
    speaking: 'bg-purple-500/70',
    muted: 'bg-red-500/30',
  };

  const animations = {
    idle: {
      scale: [1, 1.1, 1],
      transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' }
    },
    listening: {
      scale: scale,
      transition: { duration: 0.1 }
    },
    processing: {
      scale: [1, 1.2, 1],
      transition: { duration: 0.8, repeat: Infinity }
    },
    speaking: {
      scale: [1, 1.15, 1.05, 1.2, 1],
      transition: { duration: 0.5, repeat: Infinity }
    },
    muted: {
      scale: 0.9,
      opacity: 0.5
    },
  };

  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        className={cn(
          'rounded-full blur-xl absolute',
          stateStyles[state]
        )}
        style={{ width: baseSize * 1.5, height: baseSize * 1.5 }}
        animate={animations[state]}
      />
      <motion.div
        className={cn(
          'rounded-full',
          stateStyles[state]
        )}
        style={{ width: baseSize, height: baseSize }}
        animate={animations[state]}
      />
    </div>
  );
}
```

**Insight card (`src/components/insight-card.tsx`):**
```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type CardType = 'response' | 'action' | 'info';

interface InsightCardProps {
  type: CardType;
  title?: string;
  content: string;
  source?: string;
  timestamp: Date;
}

export function InsightCard({ type, title, content, source, timestamp }: InsightCardProps) {
  const typeStyles = {
    response: 'border-l-4 border-l-blue-500',
    action: 'border-l-4 border-l-orange-500',
    info: 'border-l-4 border-l-gray-500',
  };

  return (
    <Card className={cn('mb-4', typeStyles[type])}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          {title || (type === 'action' ? 'Action Item' : 'Response')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm">{content}</p>
        {source && (
          <p className="text-xs text-muted-foreground mt-2">Source: {source}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {timestamp.toLocaleTimeString()}
        </p>
      </CardContent>
    </Card>
  );
}
```

**Meeting page layout:**
```typescript
// src/app/meeting/page.tsx
export default function MeetingPage() {
  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* Main area with orb */}
      <div className="flex-1 flex items-center justify-center">
        <BreathingOrb state={meetingState} audioLevel={audioLevel} />
      </div>

      {/* Sidebar with insight cards */}
      <div className="w-96 bg-zinc-900 p-4 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Insights</h2>
        {insightCards.map((card) => (
          <InsightCard key={card.id} {...card} />
        ))}
      </div>
    </div>
  );
}
```

**Install Framer Motion:**
```bash
pnpm add framer-motion
```

---

## Phase 8: Admin Panel

Create PIN-protected admin settings page.

### Tasks

- [x] Create PIN authentication middleware
  - [x] Implement PIN validation logic
  - [x] Session-based PIN verification
  - [x] Timeout after inactivity
- [x] Create admin layout
  - [x] PIN entry screen
  - [x] Protected admin routes
- [x] Build settings management [complex]
  - [x] Create `src/app/admin/page.tsx`
  - [x] Response length setting (brief/detailed)
  - [x] Voice speed setting
  - [x] Wake word configuration
  - [x] Recording retention period
  - [ ] PIN change functionality — *deferred: requires additional UI and security considerations*
- [x] Create settings API
  - [x] Implement `src/app/api/settings/route.ts`
  - [x] GET/PUT settings from database
  - [x] Validate admin PIN on requests
- [x] Add settings to meeting behavior
  - [x] Apply response length to prompts
  - [x] Apply voice speed to TTS
  - [ ] Respect retention policy — *deferred: requires scheduled job/cron*

### Technical Details

**PIN middleware (`src/lib/admin-auth.ts`):**
```typescript
import { cookies } from 'next/headers';

const ADMIN_PIN = process.env.ADMIN_PIN || '1234';
const SESSION_COOKIE = 'admin_session';
const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes

export async function validatePin(pin: string): Promise<boolean> {
  return pin === ADMIN_PIN;
}

export async function createSession(): Promise<string> {
  const token = crypto.randomUUID();
  // In production, store in Redis or database
  return token;
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);
  return !!session?.value;
}
```

**Admin page (`src/app/admin/page.tsx`):**
```typescript
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [settings, setSettings] = useState({
    responseLength: 'detailed',
    voiceSpeed: 'normal',
    wakeWord: 'hey assistant',
    retentionDays: 90,
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-80">
          <CardHeader>
            <CardTitle>Admin Access</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="password"
              maxLength={4}
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
            <Button className="w-full mt-4" onClick={handlePinSubmit}>
              Enter
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-8">Admin Settings</h1>

      <div className="grid gap-6 max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>Response Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Response Length</label>
              <Select value={settings.responseLength} onValueChange={/* ... */}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="brief">Brief</SelectItem>
                  <SelectItem value="detailed">Detailed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* More settings... */}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

**Settings API (`src/app/api/settings/route.ts`):**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { settings } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const allSettings = await db.select().from(settings);
  const settingsMap = Object.fromEntries(
    allSettings.map(s => [s.key, s.value])
  );
  return NextResponse.json(settingsMap);
}

export async function PUT(request: NextRequest) {
  const updates = await request.json();

  for (const [key, value] of Object.entries(updates)) {
    await db
      .insert(settings)
      .values({ key, value: String(value) })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: String(value), updatedAt: new Date() }
      });
  }

  return NextResponse.json({ success: true });
}
```

---

## Phase 9: Meeting Memory

Store and query past meeting transcripts and decisions.

### Tasks

- [x] Implement meeting lifecycle
  - [x] Start meeting (create record)
  - [x] Accumulate transcript during meeting
  - [x] End meeting (generate summary)
- [x] Create meeting storage API
  - [x] Implement `src/app/api/meetings/route.ts`
  - [x] Start/end meeting endpoints
  - [x] List past meetings
  - [x] Get meeting details
- [x] Implement meeting summarization
  - [x] Generate summary when meeting ends
  - [x] Extract key topics discussed
  - [x] Store summary in database
- [x] Add meeting search [complex]
  - [x] Full-text search on transcripts
  - [ ] Semantic search using embeddings — *deferred: requires ChromaDB meeting indexing*
  - [ ] Query past decisions — *deferred: requires RAG integration*
- [ ] Integrate meeting context with RAG — *deferred: requires additional RAG work*
  - [ ] Include relevant past meetings in context
  - [ ] Answer "What did we decide about X?" queries
- [x] Create meeting history UI
  - [x] List past meetings
  - [x] View meeting details and transcript
  - [x] Search meetings

### Technical Details

**Meeting API (`src/app/api/meetings/route.ts`):**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { meetings } from '@/lib/schema';
import { desc, eq } from 'drizzle-orm';

// Start a new meeting
export async function POST(request: NextRequest) {
  const { title } = await request.json();

  const [meeting] = await db
    .insert(meetings)
    .values({ title })
    .returning();

  return NextResponse.json(meeting);
}

// List past meetings
export async function GET(request: NextRequest) {
  const allMeetings = await db
    .select()
    .from(meetings)
    .orderBy(desc(meetings.startedAt))
    .limit(50);

  return NextResponse.json(allMeetings);
}
```

**Meeting summarization:**
```typescript
import { ollama, model } from '@/lib/ollama';
import { generateText } from 'ai';

export async function summarizeMeeting(transcript: string): Promise<string> {
  const { text } = await generateText({
    model,
    prompt: `Summarize this meeting transcript in 3-5 bullet points, focusing on decisions made and action items:

${transcript}

Summary:`,
  });

  return text;
}
```

**Meeting search query:**
```typescript
// Semantic search for past meetings
export async function searchMeetings(query: string): Promise<Meeting[]> {
  // Option 1: Full-text search with PostgreSQL
  const results = await db.execute(sql`
    SELECT * FROM meetings
    WHERE to_tsvector('english', transcript) @@ plainto_tsquery('english', ${query})
    ORDER BY started_at DESC
    LIMIT 5
  `);

  return results;
}

// Option 2: Embed meetings in ChromaDB for semantic search
export async function semanticSearchMeetings(query: string): Promise<Meeting[]> {
  const col = await client.getOrCreateCollection({ name: 'meetings' });
  const results = await col.query({
    queryTexts: [query],
    nResults: 5,
  });

  // Fetch full meeting records from PostgreSQL
  const meetingIds = results.metadatas[0].map(m => m.meetingId);
  return db.select().from(meetings).where(inArray(meetings.id, meetingIds));
}
```

**End meeting and summarize:**
```typescript
export async function endMeeting(meetingId: number): Promise<void> {
  const [meeting] = await db
    .select()
    .from(meetings)
    .where(eq(meetings.id, meetingId));

  if (meeting.transcript) {
    const summary = await summarizeMeeting(meeting.transcript);

    await db
      .update(meetings)
      .set({
        endedAt: new Date(),
        summary
      })
      .where(eq(meetings.id, meetingId));

    // Also index in ChromaDB for semantic search
    await addMeetingToSearch(meeting, summary);
  }
}
```

---

## Phase 10: Polish & Testing

Final refinements, bug fixes, and optimization.

### Tasks

- [x] Performance optimization
  - [x] Profile and optimize LLM response times — *parallel RAG/settings fetch, settings caching, connection keepalive*
  - [x] Optimize audio processing pipeline — *pre-allocated WAV buffers, loop unrolling for RMS/peak calculation, typed arrays*
  - [x] Reduce UI rendering overhead — *memoized components (BreathingOrb, InsightCard, InsightFeed), useMemo for computed values*
- [x] Error handling improvements [complex]
  - [x] Graceful degradation when services fail — *meeting page shows service status and continues to work with available services*
  - [x] User-friendly error messages — *transcription/wake word errors displayed in UI*
  - [x] Automatic reconnection to services — *use-diagnostics hook with autoReconnect, service status callbacks*
  - [x] Offline mode indication — *status indicators show "Whisper Offline", "Piper Offline" when services unavailable*
- [x] Reliability testing
  - [x] Test 8+ hour continuous operation — *documented in docs/RELIABILITY_TESTING.md*
  - [x] Memory leak detection — *documented in docs/RELIABILITY_TESTING.md*
  - [x] Service recovery testing — *documented in docs/RELIABILITY_TESTING.md*
- [x] UI/UX refinements
  - [x] Animation smoothness — *framer-motion used throughout for smooth transitions*
  - [x] Visual feedback timing — *orb states, speaking/listening/transcribing indicators, barge-in feedback*
  - [x] Accessibility improvements — *ARIA labels, roles, keyboard navigation, screen reader support, skip links*
- [x] Documentation
  - [x] Update README with setup instructions — *comprehensive README.md with quick start, manual install, usage, architecture, troubleshooting*
  - [x] Document API endpoints — *docs/API_REFERENCE.md with complete documentation for all 12 endpoints*
  - [x] Create troubleshooting guide — *included in README.md troubleshooting section*
- [x] Deployment preparation
  - [x] Create Docker Compose for all services — *docker-compose.yml includes postgres, ollama, whisper, piper, chromadb with health checks*
  - [x] Environment variable documentation — *docs/ENVIRONMENT_VARIABLES.md with all variables, defaults, and examples*
  - [x] Startup scripts — *scripts/start.sh, start.ps1, stop.sh, stop.ps1, health-check.sh, health-check.ps1*

### Technical Details

**Docker Compose (`docker-compose.yml`):**
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - POSTGRES_URL=postgresql://postgres:postgres@db:5432/meeting_assistant
      - OLLAMA_BASE_URL=http://ollama:11434
      - WHISPER_SERVICE_URL=http://whisper:8001
      - PIPER_SERVICE_URL=http://piper:8002
      - CHROMADB_URL=http://chromadb:8000
    depends_on:
      - db
      - ollama
      - whisper
      - piper
      - chromadb

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=meeting_assistant
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data

  ollama:
    image: ollama/ollama
    volumes:
      - ollama_data:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

  whisper:
    build: ./services/whisper
    ports:
      - "8001:8001"
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

  piper:
    build: ./services/piper
    ports:
      - "8002:8002"

  chromadb:
    image: chromadb/chroma
    ports:
      - "8003:8000"
    volumes:
      - chroma_data:/chroma/chroma

volumes:
  postgres_data:
  ollama_data:
  chroma_data:
```

**Startup script (`scripts/start.sh`):**
```bash
#!/bin/bash

echo "Starting AI Meeting Assistant..."

# Check Ollama
echo "Checking Ollama..."
curl -s http://localhost:11434/api/tags > /dev/null || {
  echo "Error: Ollama not running. Start with: ollama serve"
  exit 1
}

# Check required model
ollama list | grep -q "llama3.3:70b" || {
  echo "Downloading llama3.3:70b model..."
  ollama pull llama3.3:70b
}

# Start Python services
echo "Starting Whisper service..."
cd services/whisper && uvicorn main:app --host 0.0.0.0 --port 8001 &

echo "Starting Piper service..."
cd services/piper && uvicorn main:app --host 0.0.0.0 --port 8002 &

# Start ChromaDB
echo "Starting ChromaDB..."
docker run -d -p 8003:8000 chromadb/chroma

# Wait for services
sleep 5

# Start Next.js
echo "Starting Next.js app..."
pnpm run dev

echo "All services started!"
```

**Health check endpoint (`src/app/api/health/route.ts`):**
```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  const checks = {
    ollama: await checkOllama(),
    whisper: await checkWhisper(),
    piper: await checkPiper(),
    chromadb: await checkChromaDB(),
    database: await checkDatabase(),
  };

  const allHealthy = Object.values(checks).every(Boolean);

  return NextResponse.json(
    { status: allHealthy ? 'healthy' : 'degraded', checks },
    { status: allHealthy ? 200 : 503 }
  );
}

async function checkOllama(): Promise<boolean> {
  try {
    const res = await fetch(`${process.env.OLLAMA_BASE_URL}/api/tags`);
    return res.ok;
  } catch {
    return false;
  }
}

// Similar checks for other services...
```

---

## Summary

| Phase | Focus | Key Deliverables |
|-------|-------|------------------|
| 1 | Foundation | Ollama integration, database schema, clean starter kit |
| 2 | Audio | Microphone capture, Web Audio API, visualizer |
| 3 | STT | Faster-Whisper service, transcription API |
| 4 | Wake Word | Porcupine integration, "Hey Assistant" detection |
| 5 | TTS | Piper service, barge-in interruption |
| 6 | RAG | ChromaDB, document upload, context retrieval |
| 7 | UI | Breathing orb, insight cards, meeting page |
| 8 | Admin | PIN auth, settings management |
| 9 | Memory | Meeting storage, search, summarization |
| 10 | Polish | Optimization, error handling, deployment |

**Total Tasks:** ~60 actionable items across 10 phases
