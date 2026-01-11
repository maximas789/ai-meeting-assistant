# AI Meeting Brainstorm Assistant

> Your meeting room's memory — always listening, never leaking, instantly helpful.

## Overview

A local AI voice assistant for team meetings (5-10 people) that acts as an ambient participant, providing intelligent insights without requiring constant interaction.

## 🚀 Starting Point

This project is built on top of the **Agentic Coding Starter Kit**:

```bash
npx create-agentic-app@latest ai-meeting-assistant
```

See [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md) for what to **keep**, **swap**, **remove**, and **add**.

## Key Features

- 🎤 **Ambient Listening** — Always on, captures everything
- 🗣️ **Natural Conversation** — Interrupt anytime, back-and-forth dialogue
- 📚 **Document Q&A** — Answer questions from uploaded docs
- 🔒 **100% Local** — No cloud, no data leaves the room
- 🔊 **Voice + Text** — Dual output for every response

## Hardware

| Component | Model |
|-----------|-------|
| Server | ASUS Ascent GX10 (128GB RAM) |
| Microphone | ReSpeaker XVF3800 (4-mic array) |

## Tech Stack

### ✅ From Starter Kit (Keep)

- **Next.js 15** — App framework
- **shadcn/ui** — UI components
- **Vercel AI SDK** — AI integration
- **PostgreSQL + Drizzle** — Database

### 🔄 Swapped

- ~~OpenRouter~~ → **Ollama** (local AI)
- ~~Better Auth~~ → **Simple PIN** (admin only)

### 🆕 Added (New)

- **Faster-Whisper** — Speech-to-text
- **Piper** — Text-to-speech
- **ChromaDB** — Document search (RAG)
- **Porcupine** — Wake word detection

## Quick Reference

| Action | Details |
|--------|---------|
| **Keep** | Next.js, shadcn, Vercel AI SDK, PostgreSQL, Drizzle |
| **Swap** | OpenRouter → Ollama, Better Auth → PIN |
| **Remove** | Google OAuth, login/signup pages, user dashboard |
| **Add** | Whisper, Piper, ChromaDB, Porcupine, audio handling |

## Documentation

See [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md) for:

- Full modification instructions
- Database schema
- Project structure
- Development phases
- Feature checklist

## Getting Started

```bash
# 1. Create from starter kit
npx create-agentic-app@latest ai-meeting-assistant
cd ai-meeting-assistant

# 2. Follow PROJECT_PLAN.md to modify the starter kit

# 3. Start development
npm run dev
```

## License

Private project
