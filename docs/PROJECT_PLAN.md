# AI Meeting Brainstorm Assistant — Project Plan

## 🎯 Vision

> **"Your meeting room's memory — always listening, never leaking, instantly helpful."**

An ambient AI participant for team meetings (5-10 people) that listens, understands, and helps — all running 100% locally.

---

## 🚀 STARTING POINT: Agentic Coding Starter Kit

### Repository

```
https://github.com/leonvanzyl/agentic-coding-starter-kit
```

### Setup Command

```bash
npx create-agentic-app@latest ai-meeting-assistant
cd ai-meeting-assistant
```

---

## 🔧 STARTER KIT MODIFICATIONS

### ✅ KEEP (Use As-Is)

| Component | File/Folder | Why Keep |
|-----------|-------------|----------|
| **Next.js 15** | `next.config.ts` | App framework |
| **shadcn/ui** | `components/ui/` | UI components |
| **Tailwind CSS** | `tailwind.config.ts` | Styling |
| **Drizzle ORM** | `drizzle.config.ts` | Database ORM |
| **PostgreSQL setup** | `lib/db.ts` | Database connection |
| **Vercel AI SDK** | Already installed | AI integration |
| **TypeScript** | `tsconfig.json` | Type safety |
| **Project structure** | `src/` folder | Clean organization |
| **ESLint** | `eslint.config.mjs` | Code quality |

### 🔄 SWAP (Replace With)

| From (Starter Kit) | To (Our Project) | How To Change |
|--------------------|------------------|---------------|
| **OpenRouter** | **Ollama (local)** | Change AI provider in Vercel AI SDK |
| `OPENROUTER_API_KEY` | `OLLAMA_BASE_URL=http://localhost:11434` | Update `.env` |
| `openrouter/gpt-4` | `ollama('llama3.3:70b')` | Change model reference |

**Code Change Example:**

```typescript
// BEFORE (starter kit)
import { openrouter } from '@openrouter/ai-sdk-provider';
const response = await generateText({
  model: openrouter('openai/gpt-4'),
  prompt: '...',
});

// AFTER (our project)
import { createOllama } from 'ollama-ai-provider';
const ollama = createOllama({ baseURL: 'http://localhost:11434/api' });
const response = await generateText({
  model: ollama('llama3.3:70b'),
  prompt: '...',
});
```

### ❌ REMOVE (Don't Use)

| Component | Files To Delete | Why Remove |
|-----------|-----------------|------------|
| **Better Auth** | `lib/auth.ts`, `lib/auth-client.ts` | No user accounts needed |
| **Google OAuth** | Auth components | No cloud auth |
| **Login/Signup pages** | `app/login/`, `app/signup/` | Not needed |
| **User dashboard** | `app/dashboard/` | Replace with meeting UI |
| **OpenRouter config** | Remove from `.env` | Using local Ollama |
| **Auth middleware** | Any auth checks | Replace with simple PIN |

**Environment Variables To Remove:**

```bash
# DELETE THESE FROM .env
BETTER_AUTH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
OPENROUTER_API_KEY=...
```

### 🆕 ADD (New Components)

| Component | Purpose | Install Command |
|-----------|---------|-----------------|
| **ollama-ai-provider** | Connect Vercel AI SDK to Ollama | `npm install ollama-ai-provider` |
| **Faster-Whisper** | Speech-to-text | Python service (separate) |
| **Piper** | Text-to-speech | Python service (separate) |
| **ChromaDB** | Document search (RAG) | `npm install chromadb` |
| **Porcupine** | Wake word detection | `npm install @picovoice/porcupine-web` |
| **Web Audio API** | Mic input handling | Built into browser |

---

## 🏗️ Hardware Foundation

| Component | Model | Purpose |
|-----------|-------|---------|
| **Server** | ASUS Ascent GX10 | 128GB RAM, runs local LLM |
| **Microphone** | ReSpeaker XVF3800 | 4-mic array, 360° capture, 5m range |
| **Display** | Any HDMI/USB-C monitor | Shows insight cards |
| **Speaker** | Via 3.5mm or JST connector | TTS voice output |

---

## 🧠 Software Stack (All Local)

### Overview Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   FRONTEND (What you see)                                   │
│   ────────────────────────                                  │
│   Next.js + shadcn (from starter kit)                       │
│                                                             │
│                      ↕                                      │
│                                                             │
│   AI BRAIN (Thinking)                                       │
│   ───────────────────                                       │
│   Vercel AI SDK → Ollama (SWAPPED from OpenRouter)          │
│                                                             │
│                      ↕                                      │
│                                                             │
│   VOICE (Hearing & Speaking)                                │
│   ─────────────────────────                                 │
│   Faster-Whisper (ears) + Piper (mouth) (NEW)               │
│                                                             │
│                      ↕                                      │
│                                                             │
│   STORAGE (Memory)                                          │
│   ────────────────                                          │
│   PostgreSQL (from starter kit) + ChromaDB (NEW)            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Stack Details

| Layer | Technology | Source | Status |
|-------|------------|--------|--------|
| **Framework** | Next.js 15 | Starter Kit | ✅ Keep |
| **UI Components** | shadcn/ui | Starter Kit | ✅ Keep |
| **AI Integration** | Vercel AI SDK | Starter Kit | ✅ Keep |
| **AI Provider** | Ollama | Swap | 🔄 Change |
| **Database** | PostgreSQL + Drizzle | Starter Kit | ✅ Keep |
| **Auth** | Simple PIN | Swap | 🔄 Change |
| **Speech-to-Text** | Faster-Whisper | New | 🆕 Add |
| **Text-to-Speech** | Piper | New | 🆕 Add |
| **Document Search** | ChromaDB | New | 🆕 Add |
| **Wake Word** | Porcupine | New | 🆕 Add |

---

## 📁 NEW PROJECT STRUCTURE

```
ai-meeting-assistant/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/              # ✅ Keep (modify for Ollama)
│   │   │   ├── transcribe/        # 🆕 New - Whisper endpoint
│   │   │   ├── speak/             # 🆕 New - Piper endpoint
│   │   │   └── documents/         # 🆕 New - RAG endpoints
│   │   ├── meeting/               # 🆕 New - Main meeting UI
│   │   ├── admin/                 # 🆕 New - Admin settings (PIN protected)
│   │   └── page.tsx               # Modify - Landing/meeting screen
│   ├── components/
│   │   ├── ui/                    # ✅ Keep - shadcn components
│   │   ├── breathing-orb.tsx      # 🆕 New
│   │   ├── insight-card.tsx       # 🆕 New
│   │   ├── audio-visualizer.tsx   # 🆕 New
│   │   └── admin-panel.tsx        # 🆕 New
│   ├── lib/
│   │   ├── db.ts                  # ✅ Keep
│   │   ├── schema.ts              # Modify - Add meeting tables
│   │   ├── ollama.ts              # 🆕 New - Ollama client
│   │   ├── whisper.ts             # 🆕 New - STT client
│   │   ├── piper.ts               # 🆕 New - TTS client
│   │   ├── chromadb.ts            # 🆕 New - RAG client
│   │   └── audio.ts               # 🆕 New - Audio utilities
│   └── hooks/
│       ├── use-audio.ts           # 🆕 New - Mic input hook
│       ├── use-wake-word.ts       # 🆕 New - Porcupine hook
│       └── use-barge-in.ts        # 🆕 New - Interrupt detection
├── services/                       # 🆕 New - Python services
│   ├── whisper/                   # Faster-Whisper service
│   └── piper/                     # Piper TTS service
├── docs/
│   └── PROJECT_PLAN.md            # This file
└── drizzle/                       # ✅ Keep - Migrations
```

---

## 🗄️ Database Schema (PostgreSQL)

### Modify `src/lib/schema.ts`

```typescript
// REMOVE: User/Auth tables from starter kit
// ADD: These new tables

// Meetings table
export const meetings = pgTable('meetings', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }),
  startedAt: timestamp('started_at').defaultNow(),
  endedAt: timestamp('ended_at'),
  transcript: text('transcript'),
  summary: text('summary'),
});

// Action items detected
export const actionItems = pgTable('action_items', {
  id: serial('id').primaryKey(),
  meetingId: integer('meeting_id').references(() => meetings.id),
  assignee: varchar('assignee', { length: 255 }),
  task: text('task'),
  dueDate: timestamp('due_date'),
  completed: boolean('completed').default(false),
});

// Admin settings
export const settings = pgTable('settings', {
  key: varchar('key', { length: 255 }).primaryKey(),
  value: text('value'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Uploaded documents (metadata)
export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  filename: varchar('filename', { length: 255 }),
  uploadedAt: timestamp('uploaded_at').defaultNow(),
  chromadbCollectionId: varchar('chromadb_collection_id', { length: 255 }),
});
```

---

## ⚙️ Environment Variables

### New `.env` File

```bash
# Database (KEEP from starter kit)
POSTGRES_URL="postgresql://username:password@localhost:5432/meeting_assistant"

# Ollama (NEW - replaces OpenRouter)
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="llama3.3:70b"

# Services (NEW)
WHISPER_SERVICE_URL="http://localhost:8001"
PIPER_SERVICE_URL="http://localhost:8002"
CHROMADB_URL="http://localhost:8003"

# Admin (NEW - replaces Better Auth)
ADMIN_PIN="1234"

# App URL (KEEP)
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## ✨ Core Features

| # | Feature | Description | Output |
|---|---------|-------------|--------|
| 1 | **Ambient Listening** | Always on, no wake word needed to listen | — |
| 2 | **Wake Word Activation** | "Hey Assistant" triggers response mode | 🔊 |
| 3 | **Document Q&A (RAG)** | Answer questions from uploaded docs | 🔊 + 🖥️ |
| 4 | **Meeting Memory** | Reference past meetings & decisions | 🔊 + 🖥️ |
| 5 | **Action Item Detection** | Auto-captures "John will do X by Friday" | 🖥️ |
| 6 | **Calendar Integration** | Creates follow-up reminders | 🖥️ |
| 7 | **Mind Map Generation** | Visual summary of discussion flow | 🖥️ |
| 8 | **Speaker Attribution** | Know WHO said what (using DoA) | 🖥️ |

---

## 🗣️ Voice Interaction Model

### Conversation Flow

```
👤 "What's our Q2 budget?"

🔊 "The Q2 budget is 450,000 riyals. Marketing
    receives 150,000, Engineering receives..."

👤 "Wait — just marketing."  ← BARGE-IN

🔊 "Marketing's budget is 150,000 riyals,
    allocated for digital ads and events."

👤 "Who approved that?"

🔊 "Ahmed approved it in the March 15th meeting."
```

### Key Behaviors

- ✅ Full detailed responses (default)
- ✅ Natural barge-in interruption (no wake word needed to interrupt)
- ✅ Back-and-forth conversation
- ✅ Dual output: Voice + Text card
- ✅ Admin-configurable response length

### Technical Requirements for Barge-In

| Component | Role |
|-----------|------|
| XVF3800 AEC | Filters out speaker audio so mic hears user |
| XVF3800 VAD | Detects when human voice starts |
| Piper TTS | Can be stopped instantly (local, no lag) |
| Ollama LLM | Fast enough for real-time back-and-forth |

---

## 🖥️ User Interface

### Built With shadcn (From Starter Kit)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   Next.js App                                               │
│   ├── shadcn components (cards, buttons, settings)          │
│   ├── Breathing orb animation (CSS/Framer Motion)           │
│   ├── Insight cards (shadcn Card component)                 │
│   └── Admin panel (shadcn forms + dialogs)                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### UI States

| State | Orb Behavior |
|-------|--------------|
| Idle / Listening | Slow breathing glow |
| Processing | Faster pulse |
| Speaking | Active animation |
| Muted | Dim / Red |

---

## ⚙️ Admin Settings (PIN Protected)

| Setting | Default | Options |
|---------|---------|---------|
| Response Length | Detailed | Brief / Detailed |
| Voice Speed | Normal | Slow / Normal / Fast |
| Include Source Reference | Yes | Yes / No |
| Wake Word | "Hey Assistant" | Customizable |
| Recording Retention | 90 days | Configurable |
| Admin PIN | 1234 | 4-digit PIN |

---

## 🔒 Privacy Architecture

### Everything Stays Local

- ✅ Audio processing → GX10 server
- ✅ Speech-to-text → GX10 server (Faster-Whisper)
- ✅ LLM inference → GX10 server (Ollama)
- ✅ Document storage → GX10 server (ChromaDB)
- ✅ Meeting recordings → GX10 server (PostgreSQL)

### No External Communication

- ❌ No cloud AI
- ❌ No internet required
- ❌ No data leaves the room

---

## 📅 Development Phases

| Phase | Focus | What To Do | Duration |
|-------|-------|------------|----------|
| **1** | Setup starter kit | Clone repo, remove auth, swap to Ollama | 1 week |
| **2** | Audio capture | Integrate ReSpeaker XVF3800 | 1-2 weeks |
| **3** | STT + Wake word | Add Faster-Whisper + Porcupine | 1-2 weeks |
| **4** | LLM integration | Connect Vercel AI SDK to Ollama | 1 week |
| **5** | TTS + Barge-in | Add Piper + interrupt detection | 2 weeks |
| **6** | RAG system | Add ChromaDB for document Q&A | 2-3 weeks |
| **7** | UI | Build breathing orb + insight cards | 2 weeks |
| **8** | Admin panel | Settings with PIN protection | 1 week |
| **9** | Meeting memory | Store/retrieve past meetings | 2 weeks |
| **10** | Polish + testing | Bug fixes, optimization | 2 weeks |

**Estimated Total:** 15-18 weeks

---

## 📝 Phase 1 Checklist (First Week)

### Setup Tasks

- [ ] Run `npx create-agentic-app@latest ai-meeting-assistant`
- [ ] Delete `src/lib/auth.ts` and `src/lib/auth-client.ts`
- [ ] Delete `src/app/login/` and `src/app/signup/` folders
- [ ] Delete `src/app/dashboard/` folder
- [ ] Remove Better Auth from `package.json`
- [ ] Remove auth-related environment variables from `.env`
- [ ] Install `ollama-ai-provider` package
- [ ] Update AI chat endpoint to use Ollama
- [ ] Test basic Ollama connection
- [ ] Create new database schema (meetings, action_items, settings, documents)
- [ ] Run migrations

---

## 🆕 New Tech You'll Learn

| Technology | What It Does | Difficulty |
|------------|--------------|------------|
| **Ollama** | Runs AI models locally | Easy (like OpenRouter but local) |
| **Faster-Whisper** | Converts speech → text | Medium |
| **Piper** | Converts text → speech | Medium |
| **ChromaDB** | Searches documents | Easy (simple API) |
| **Porcupine** | Listens for "Hey Assistant" | Easy |

---

## 📚 Reference Documents

- Starter Kit: https://github.com/leonvanzyl/agentic-coding-starter-kit
- ReSpeaker XVF3800 Wiki: https://wiki.seeedstudio.com/respeaker_xvf3800_introduction/
- ASUS Ascent GX10 User Guide: Included in project files
- Vercel AI SDK Docs: https://sdk.vercel.ai/docs
- Ollama Docs: https://ollama.ai
- Ollama AI Provider: https://www.npmjs.com/package/ollama-ai-provider
- shadcn Docs: https://ui.shadcn.com
- Porcupine: https://picovoice.ai/platform/porcupine/
- Faster-Whisper: https://github.com/SYSTRAN/faster-whisper
- Piper TTS: https://github.com/rhasspy/piper
- ChromaDB: https://www.trychroma.com/
