# Requirements: AI Meeting Brainstorm Assistant

## Vision

> "Your meeting room's memory — always listening, never leaking, instantly helpful."

An ambient AI participant for team meetings (5-10 people) that listens, understands, and helps — all running 100% locally on-premise hardware.

## Problem Statement

Team meetings generate valuable discussions, decisions, and action items that are often lost or poorly documented. Existing solutions either:
- Require cloud services (privacy concerns for sensitive business discussions)
- Need manual note-taking (distracting, incomplete)
- Lack real-time interaction (can't answer questions during meetings)

## Solution

A local-first AI assistant that:
1. Continuously listens to meeting conversations
2. Responds to voice queries about documents and past meetings
3. Auto-detects and tracks action items
4. Provides both voice and visual output
5. Keeps all data on-premise (zero cloud dependency)

## Target Users

- Small to medium teams (5-10 people)
- Organizations with privacy/compliance requirements
- Meeting rooms with dedicated hardware

## Core Features

### F1: Ambient Listening
- Always-on microphone capture using ReSpeaker XVF3800 (4-mic array)
- 360-degree audio capture with 5-meter range
- Real-time speech-to-text transcription via Faster-Whisper
- No wake word required for listening (only for interaction)

### F2: Wake Word Activation
- "Hey Assistant" triggers response mode
- Customizable wake word via admin settings
- Powered by Porcupine wake word engine

### F3: Document Q&A (RAG)
- Upload documents (PDF, DOCX, TXT) for context
- Vector search via ChromaDB
- AI answers questions using document knowledge
- Dual output: voice response + insight card on screen

### F4: Meeting Memory
- Store full transcripts of past meetings
- Query historical meetings ("What did we decide about X?")
- Reference past decisions and discussions

### F5: Action Item Detection
- Auto-capture tasks from natural speech
- Pattern recognition: "John will do X by Friday"
- Track assignee, task description, due date
- Display on insight cards

### F6: Barge-In Interruption
- Users can interrupt AI responses naturally
- No wake word needed to interrupt
- AI stops speaking and listens immediately
- Enabled by XVF3800's acoustic echo cancellation

### F7: Visual Interface
- Breathing orb animation showing system state
- Insight cards for AI responses and action items
- Clean, minimal UI using shadcn/ui components

### F8: Admin Settings (PIN Protected)
- Response length (brief/detailed)
- Voice speed control
- Wake word customization
- Recording retention period
- Simple 4-digit PIN protection (no user accounts)

## Non-Functional Requirements

### NFR1: Privacy
- 100% local processing (no cloud APIs)
- All data stored on-premise
- No internet connection required for operation

### NFR2: Performance
- Speech-to-text latency < 500ms
- LLM response time < 3 seconds
- TTS playback starts within 1 second of response

### NFR3: Hardware
- Server: ASUS Ascent GX10 (128GB RAM)
- Microphone: ReSpeaker XVF3800
- Standard HDMI display for visual output
- 3.5mm audio output for TTS

### NFR4: Reliability
- System should handle 8+ hour meeting days
- Graceful degradation if components fail
- Meeting recordings preserved even if processing fails

## Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Framework | Next.js 16 | App Router, from starter kit |
| UI | shadcn/ui + Tailwind | From starter kit |
| Database | PostgreSQL + Drizzle ORM | From starter kit |
| AI SDK | Vercel AI SDK | From starter kit |
| AI Provider | Ollama (local) | Replaces OpenRouter |
| STT | Faster-Whisper | Python service |
| TTS | Piper | Python service |
| Vector DB | ChromaDB | Document search |
| Wake Word | Porcupine | Browser-based |

## Acceptance Criteria

### MVP (Phases 1-5)
- [ ] System boots and displays breathing orb UI
- [ ] Wake word "Hey Assistant" activates response mode
- [ ] User can ask questions and receive voice + text responses
- [ ] Responses come from local Ollama (no cloud)
- [ ] User can interrupt (barge-in) AI responses

### Full Product (Phases 6-10)
- [ ] Upload documents and query them via RAG
- [ ] View and search past meeting transcripts
- [ ] Action items auto-detected and displayed
- [ ] Admin can configure settings via PIN-protected panel
- [ ] System runs reliably for full workdays

## Out of Scope

- Multi-room support (single room only for v1)
- Calendar integration (future enhancement)
- Mind map generation (future enhancement)
- Speaker attribution/diarization (future enhancement)
- Mobile app (desktop/display only)
- User accounts/authentication (PIN-only admin access)

## Dependencies

- Ollama installed and running with llama3.3:70b model
- PostgreSQL database server
- Python 3.10+ for Whisper/Piper services
- ReSpeaker XVF3800 hardware with drivers
- Porcupine access key (free tier available)

## Related Documentation

- `docs/PROJECT_PLAN.md` - Original project plan
- `CLAUDE.md` - Development guidelines
