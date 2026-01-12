# AI Meeting Brainstorm Assistant

[![CI](https://github.com/maximas789/ai-meeting-assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/maximas789/ai-meeting-assistant/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Your meeting room's memory — always listening, never leaking, instantly helpful.

A local-first AI voice assistant for team meetings that acts as an ambient participant. Runs entirely on-premise with no cloud dependencies.

## Features

- **Voice-Activated** — Wake word detection ("Computer", "Jarvis", etc.) or manual trigger
- **Real-Time Transcription** — Faster-Whisper converts speech to text locally
- **AI-Powered Responses** — Ollama LLM answers questions and provides insights
- **Natural Speech** — Piper TTS speaks responses aloud
- **Barge-In Support** — Interrupt the assistant mid-sentence naturally
- **Document Q&A (RAG)** — Upload documents and ask questions about them
- **Meeting Memory** — Stores transcripts, summaries, and action items
- **100% Local** — No data leaves your network

---

## Quick Start

### Prerequisites

- **Node.js 18+** and **pnpm**
- **Python 3.10+** (for Whisper and Piper services)
- **Docker** (for PostgreSQL and ChromaDB)
- **Ollama** — [Install from ollama.ai](https://ollama.ai)

### 1. Clone and Install

```bash
git clone <repository-url>
cd ai-meeting-assistant
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your settings. See [Environment Variables](docs/ENVIRONMENT_VARIABLES.md) for details.

### 3. Start All Services

**Windows (PowerShell):**
```powershell
.\scripts\start.ps1
```

**Linux/macOS:**
```bash
chmod +x scripts/*.sh
./scripts/start.sh
```

### 4. Open the App

Navigate to [http://localhost:3000](http://localhost:3000)

---

## Manual Installation

### Step 1: Install Ollama

Download and install from [ollama.ai](https://ollama.ai), then pull a model:

```bash
ollama pull llama3.2
ollama serve
```

### Step 2: Start Database Services

```bash
docker compose up -d postgres chromadb
```

### Step 3: Run Database Migrations

```bash
pnpm run db:migrate
```

### Step 4: Start Python Services

**Whisper (Speech-to-Text):**
```bash
cd services/whisper
python -m venv venv
# Windows: venv\Scripts\activate
# Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
python main.py
```

**Piper (Text-to-Speech):**
```bash
cd services/piper
python -m venv venv
# Windows: venv\Scripts\activate
# Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
python main.py
```

### Step 5: Start Next.js

```bash
pnpm run dev
```

---

## Usage

### Meeting Page (`/meeting`)

The main assistant interface:

- **Breathing Orb** — Visual indicator of system state (idle/listening/processing/speaking)
- **Wake Word** — Say "Computer" (or configured word) to activate
- **Manual Recording** — Click the Record button to speak
- **Insights Sidebar** — Shows transcriptions and AI responses

### Admin Settings (`/admin`)

Enter your PIN (default: `1234`) to configure:

- Response length (brief/detailed)
- Voice speed
- Wake word selection
- Recording retention

### Document Upload (`/documents`)

- Upload PDF, DOCX, or TXT files
- Documents are indexed for RAG queries
- Ask questions like "What does the project plan say about..."

### Meeting History (`/meetings`)

- View past meeting transcripts
- Search across all meetings
- View AI-generated summaries

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Next.js)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Breathing    │  │ Transcription│  │ Insight      │      │
│  │ Orb          │  │ Display      │  │ Cards        │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                           │                                 │
│  ┌────────────────────────┴────────────────────────┐       │
│  │              Audio Capture (Web Audio API)       │       │
│  │    Wake Word (Porcupine) │ Barge-In Detection   │       │
│  └─────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
         ┌──────────────────┐  ┌──────────────────┐
         │   Whisper STT    │  │   Piper TTS      │
         │   (Port 8001)    │  │   (Port 8002)    │
         └──────────────────┘  └──────────────────┘
                    │                   │
                    └─────────┬─────────┘
                              ▼
         ┌──────────────────────────────────────────┐
         │            Next.js API Routes            │
         │   /api/chat  /api/transcribe  /api/speak │
         └──────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│     Ollama       │ │   PostgreSQL     │ │    ChromaDB      │
│   (Port 11434)   │ │   (Port 5432)    │ │   (Port 8003)    │
│   Local LLM      │ │   Meetings/Data  │ │   Vector Search  │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

### Services

| Service | Port | Purpose |
|---------|------|---------|
| Next.js | 3000 | Web application |
| Ollama | 11434 | Local LLM inference |
| Whisper | 8001 | Speech-to-text |
| Piper | 8002 | Text-to-speech |
| ChromaDB | 8003 | Vector database (RAG) |
| PostgreSQL | 5432 | Application database |

---

## Configuration

### Environment Variables

See [docs/ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md) for complete documentation.

**Essential variables:**

```bash
# Required
POSTGRES_URL="postgresql://user:pass@localhost:5432/meeting_assistant"
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="llama3.2"

# Services
WHISPER_SERVICE_URL="http://localhost:8001"
PIPER_SERVICE_URL="http://localhost:8002"
CHROMADB_URL="http://localhost:8003"

# Authentication
ADMIN_PIN="1234"

# Optional - Wake Word
NEXT_PUBLIC_PORCUPINE_ACCESS_KEY="your-key"
```

### Wake Word Setup

1. Get a free API key from [Picovoice Console](https://console.picovoice.ai/)
2. Add to `.env.local`:
   ```bash
   NEXT_PUBLIC_PORCUPINE_ACCESS_KEY="your-key"
   ```
3. Available keywords: Computer, Jarvis, Alexa, Hey Google, etc.

---

## Scripts

### Development Commands

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Start development server |
| `pnpm run build` | Production build |
| `pnpm run lint` | Run ESLint |
| `pnpm run typecheck` | TypeScript check |
| `pnpm run check` | Run lint + typecheck |
| `pnpm run db:migrate` | Apply migrations |
| `pnpm run db:studio` | Open Drizzle Studio |

### Startup Scripts

| Script | Platform | Description |
|--------|----------|-------------|
| `scripts/start.ps1` | Windows | Start all services |
| `scripts/start.sh` | Linux/macOS | Start all services |
| `scripts/stop.ps1` | Windows | Stop all services |
| `scripts/stop.sh` | Linux/macOS | Stop all services |
| `scripts/health-check.ps1` | Windows | Check service health |
| `scripts/health-check.sh` | Linux/macOS | Check service health |

---

## Docker Deployment

### Start All Services

```bash
docker compose up -d
```

### Start Specific Services

```bash
# Database only
docker compose up -d postgres

# All backend services
docker compose up -d postgres ollama whisper piper chromadb
```

### View Logs

```bash
docker compose logs -f whisper
docker compose logs -f piper
```

### Stop Services

```bash
docker compose down
```

---

## Project Structure

```
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/            # API routes
│   │   ├── meeting/        # Main meeting UI
│   │   ├── admin/          # Admin settings
│   │   ├── documents/      # Document management
│   │   └── meetings/       # Meeting history
│   ├── components/         # React components
│   │   ├── ui/            # shadcn/ui components
│   │   ├── breathing-orb.tsx
│   │   └── insight-card.tsx
│   ├── hooks/              # Custom React hooks
│   │   ├── use-audio.ts
│   │   ├── use-transcription.ts
│   │   ├── use-wake-word.ts
│   │   ├── use-tts.ts
│   │   └── use-barge-in.ts
│   └── lib/                # Utilities
│       ├── ollama.ts
│       ├── whisper.ts
│       ├── piper.ts
│       ├── chromadb.ts
│       └── schema.ts       # Database schema
├── services/
│   ├── whisper/            # Faster-Whisper service
│   └── piper/              # Piper TTS service
├── scripts/                # Startup/utility scripts
└── docs/                   # Documentation
```

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui |
| Backend | Next.js API Routes, Drizzle ORM |
| AI | Ollama (local), Vercel AI SDK |
| Speech | Faster-Whisper (STT), Piper (TTS) |
| Database | PostgreSQL with pgvector, ChromaDB |
| Wake Word | Picovoice Porcupine |

---

## Troubleshooting

### Health Check

```powershell
# Windows
.\scripts\health-check.ps1

# Linux/macOS
./scripts/health-check.sh
```

Or visit: [http://localhost:3000/api/diagnostics](http://localhost:3000/api/diagnostics)

### Common Issues

**"Cannot connect to Ollama"**
```bash
ollama serve
ollama list
ollama pull llama3.2
```

**"Whisper service unavailable"**
```bash
cd services/whisper
source venv/bin/activate  # or venv\Scripts\activate on Windows
python main.py
```

**"Database connection failed"**
```bash
docker compose up -d postgres
pnpm run db:migrate
```

**"Wake word not detecting"**
- Check microphone permissions in browser
- Ensure `NEXT_PUBLIC_PORCUPINE_ACCESS_KEY` is set
- Try a quieter environment

**"No audio output"**
- Check browser audio permissions
- Verify Piper service is running on port 8002
- Check speaker/headphone connection

---

## Hardware

### Minimum (Development)

- 16GB RAM
- 4-core CPU
- Integrated GPU

### Recommended (Production)

- 64GB+ RAM
- NVIDIA GPU with 8GB+ VRAM
- Quality microphone (e.g., ReSpeaker XVF3800)

### Tested Configuration

| Component | Model |
|-----------|-------|
| Server | ASUS Ascent GX10 (128GB RAM) |
| Microphone | ReSpeaker XVF3800 (4-mic array) |

---

## Documentation

- [Environment Variables](docs/ENVIRONMENT_VARIABLES.md) — All configuration options
- [Implementation Plan](specs/ai-meeting-assistant/implementation-plan.md) — Development phases

---

## License

MIT License

---

## Acknowledgments

Built with:
- [Ollama](https://ollama.ai) — Local LLM inference
- [Faster-Whisper](https://github.com/guillaumekln/faster-whisper) — Speech recognition
- [Piper](https://github.com/rhasspy/piper) — Text-to-speech
- [Picovoice Porcupine](https://picovoice.ai/platform/porcupine/) — Wake word detection
- [Next.js](https://nextjs.org) — React framework
- [shadcn/ui](https://ui.shadcn.com) — UI components
- [Vercel AI SDK](https://sdk.vercel.ai) — AI integration
