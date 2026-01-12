# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Meeting Brainstorm Assistant — a local AI voice assistant for team meetings (5-10 people) that acts as an ambient participant. Built on the Agentic Coding Starter Kit with significant modifications for local-first, privacy-focused voice AI.

**Vision:** "Your meeting room's memory — always listening, never leaking, instantly helpful."

## Key Architecture Decisions

### Local-First Stack (Modifications from Starter Kit)

| Component | Starter Kit | This Project |
|-----------|-------------|--------------|
| AI Provider | OpenRouter (cloud) | **Ollama (local)** |
| Auth | Better Auth | **Simple PIN** |
| Speech-to-Text | None | **Faster-Whisper** (Python service) |
| Text-to-Speech | None | **Piper** (Python service) |
| Document Search | None | **ChromaDB** (RAG) |
| Wake Word | None | **Porcupine** |

### What's Kept from Starter Kit

- Next.js 16 with App Router
- shadcn/ui components
- PostgreSQL + Drizzle ORM
- Vercel AI SDK (with Ollama provider instead of OpenRouter)
- Tailwind CSS 4

### What's Been Removed

- Better Auth (`lib/auth.ts`, `lib/auth-client.ts`)
- Login/signup/dashboard pages
- OpenRouter configuration
- User account system

## Commands

```bash
pnpm run dev          # Start dev server (DON'T run - ask user)
pnpm run build        # Production build (runs db:migrate first)
pnpm run lint         # ESLint - ALWAYS run after changes
pnpm run typecheck    # TypeScript check - ALWAYS run after changes
pnpm run check        # Runs both lint and typecheck

# Database
pnpm run db:generate  # Generate migrations after schema changes
pnpm run db:migrate   # Apply migrations
pnpm run db:push      # Push schema directly (dev only)
pnpm run db:studio    # Drizzle Studio GUI
```

**Critical:** Always run `pnpm run lint && pnpm run typecheck` after completing changes.

## AI Provider: Ollama via OpenAI-Compatible API

This project uses local Ollama via its OpenAI-compatible endpoint with @ai-sdk/openai.

```typescript
// CORRECT - Use Ollama via OpenAI-compatible API
import { chatModel } from '@/lib/ollama';
import { generateText, streamText } from 'ai';

const response = await generateText({
  model: chatModel,
  prompt: '...',
});

// The ollama.ts module configures the OpenAI provider for Ollama:
// import { createOpenAI } from '@ai-sdk/openai';
// const ollama = createOpenAI({
//   baseURL: 'http://localhost:11434/v1',
//   apiKey: 'ollama',
// });

// WRONG - Don't use OpenRouter
import { openrouter } from '@openrouter/ai-sdk-provider'; // ❌
```

## Environment Variables

```bash
# Database
POSTGRES_URL="postgresql://user:password@localhost:5432/meeting_assistant"

# Ollama (local LLM)
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="llama3.2"
OLLAMA_FAST_MODEL="llama3.2:1b"

# Python Services (future phases)
WHISPER_SERVICE_URL="http://localhost:8001"
PIPER_SERVICE_URL="http://localhost:8002"
CHROMADB_URL="http://localhost:8003"

# Admin (replaces Better Auth)
ADMIN_PIN="1234"

NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Project Structure (Target)

```
src/
├── app/
│   ├── api/
│   │   ├── chat/           # Modify for Ollama
│   │   ├── transcribe/     # NEW - Whisper endpoint
│   │   ├── speak/          # NEW - Piper endpoint
│   │   └── documents/      # NEW - RAG endpoints
│   ├── meeting/            # NEW - Main meeting UI
│   └── admin/              # NEW - PIN-protected settings
├── components/
│   ├── ui/                 # Keep - shadcn components
│   ├── breathing-orb.tsx   # NEW
│   ├── insight-card.tsx    # NEW
│   └── audio-visualizer.tsx # NEW
├── lib/
│   ├── db.ts               # Keep
│   ├── schema.ts           # Modify - meeting tables
│   ├── ollama.ts           # NEW
│   ├── whisper.ts          # NEW
│   ├── piper.ts            # NEW
│   └── chromadb.ts         # NEW
└── hooks/
    ├── use-audio.ts        # NEW
    └── use-wake-word.ts    # NEW
services/                   # Python services (Whisper, Piper)
```

## Database Schema (New Tables)

The schema in `src/lib/schema.ts` should include:

- `meetings` - Meeting sessions with transcripts and summaries
- `actionItems` - Auto-detected tasks from meetings
- `settings` - Admin configuration (key-value)
- `documents` - Uploaded document metadata for RAG

See `docs/PROJECT_PLAN.md` for full schema definitions.

## Hardware Context

- **Server:** ASUS Ascent GX10 (128GB RAM) - runs all local AI
- **Microphone:** ReSpeaker XVF3800 (4-mic array, 360° capture)
- **100% Local:** No cloud services, no data leaves the room

## Documentation

- `docs/PROJECT_PLAN.md` - Full project plan, phases, and checklists
- `docs/technical/ai/streaming.md` - AI streaming patterns (from starter kit)

## Guidelines

1. **Use Ollama, not OpenRouter** - All AI calls go through local Ollama
2. **No user auth** - Only simple PIN for admin access
3. **Privacy first** - No external API calls, everything runs locally
4. **Voice-first UX** - Support for barge-in interruption and natural conversation
5. **Dual output** - Both voice (TTS) and visual (insight cards) responses
