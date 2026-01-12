# Environment Variables

This document describes all environment variables used by the AI Meeting Assistant.

## Quick Start

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` with your values

3. For Docker deployments, environment variables can also be set in `docker-compose.yml`

---

## Required Variables

These variables must be set for the application to function.

### Database

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `POSTGRES_URL` | PostgreSQL connection string | *None* | `postgresql://user:pass@localhost:5432/meeting_assistant` |

**Format:** `postgresql://[user]:[password]@[host]:[port]/[database]`

**Docker Compose:** When using Docker Compose, this is automatically configured:
```
postgresql://postgres:postgres@postgres:5432/meeting_assistant
```

---

## Ollama (Local LLM)

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `OLLAMA_BASE_URL` | Ollama API endpoint | `http://localhost:11434` | `http://ollama:11434` |
| `OLLAMA_MODEL` | Primary model for chat/responses | `llama3.2` | `llama3.3:70b` |
| `OLLAMA_FAST_MODEL` | Lightweight model for quick tasks | `llama3.2:1b` | `llama3.2:1b` |

### Recommended Models

| Use Case | Model | VRAM Required |
|----------|-------|---------------|
| Development | `llama3.2` | ~4GB |
| Quality responses | `llama3.3:70b` | ~40GB |
| Fast embeddings | `llama3.2:1b` | ~1GB |
| Coding tasks | `codellama:34b` | ~20GB |

### Installing Models

```bash
# Install primary model
ollama pull llama3.2

# Install fast model
ollama pull llama3.2:1b

# For high-quality responses (requires more VRAM)
ollama pull llama3.3:70b
```

---

## Python Services

These services provide speech-to-text, text-to-speech, and vector search capabilities.

### Whisper STT Service

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `WHISPER_SERVICE_URL` | Whisper API endpoint (server-side) | `http://localhost:8001` | `http://whisper:8001` |
| `NEXT_PUBLIC_WHISPER_SERVICE_URL` | Whisper API endpoint (client-side) | `http://localhost:8001` | `http://localhost:8001` |

**Service-specific variables** (set in `services/whisper/.env` or Docker):

| Variable | Description | Default | Options |
|----------|-------------|---------|---------|
| `WHISPER_MODEL_SIZE` | Model size/quality | `base` | `tiny`, `base`, `small`, `medium`, `large-v3` |
| `WHISPER_DEVICE` | Processing device | `cpu` | `cpu`, `cuda` |
| `WHISPER_COMPUTE_TYPE` | Precision type | `int8` | `int8`, `float16`, `float32` |
| `PORT` | Service port | `8001` | Any available port |

**Model Selection Guide:**

| Model | Speed | Accuracy | VRAM (GPU) | Use Case |
|-------|-------|----------|------------|----------|
| `tiny` | Fastest | Lower | ~1GB | Testing |
| `base` | Fast | Good | ~1GB | Development |
| `small` | Medium | Better | ~2GB | General use |
| `medium` | Slower | High | ~5GB | Production |
| `large-v3` | Slowest | Highest | ~10GB | Maximum quality |

### Piper TTS Service

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `PIPER_SERVICE_URL` | Piper API endpoint | `http://localhost:8002` | `http://piper:8002` |

**Service-specific variables** (set in `services/piper/.env` or Docker):

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `PIPER_VOICE` | Voice model | `en_US-amy-medium` | `en_GB-alba-medium` |
| `PIPER_SPEAKER` | Speaker ID (multi-speaker models) | `0` | `0`, `1`, `2` |
| `PIPER_SPEED` | Speech speed multiplier | `1.0` | `0.8`, `1.2` |
| `PORT` | Service port | `8002` | Any available port |

**Popular Voice Models:**

| Voice | Language | Quality | Description |
|-------|----------|---------|-------------|
| `en_US-amy-medium` | English (US) | Medium | Female, natural |
| `en_US-danny-low` | English (US) | Low | Male, fast |
| `en_GB-alba-medium` | English (UK) | Medium | Female, British |
| `en_US-lessac-high` | English (US) | High | Female, expressive |

### ChromaDB Vector Database

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `CHROMADB_URL` | ChromaDB API endpoint | `http://localhost:8003` | `http://chromadb:8000` |

**Note:** ChromaDB runs on port 8000 internally but is mapped to 8003 externally in Docker to avoid conflicts.

---

## Authentication

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `ADMIN_PIN` | PIN code for admin access | `1234` | `5678` |

**Security Notes:**
- Change the default PIN in production
- PIN should be 4-8 digits
- Session expires after 30 minutes of inactivity

---

## Wake Word Detection (Optional)

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `NEXT_PUBLIC_PORCUPINE_ACCESS_KEY` | Picovoice API key | *None* | `abc123...` |

**Getting an Access Key:**
1. Go to [Picovoice Console](https://console.picovoice.ai/)
2. Sign up for a free account
3. Copy your Access Key
4. Free tier includes 3 months of usage

**Without Access Key:**
Wake word detection will be disabled. Users can still manually trigger recording.

---

## Application Settings

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `NEXT_PUBLIC_APP_URL` | Public URL of the application | `http://localhost:3000` | `https://meeting.example.com` |
| `NODE_ENV` | Environment mode | `development` | `production` |
| `PORT` | Next.js server port | `3000` | `8080` |

---

## Legacy/Unused Variables

These variables are from the original starter kit and are **not used** in this project:

| Variable | Status | Notes |
|----------|--------|-------|
| `BETTER_AUTH_SECRET` | Removed | Better Auth was removed; using PIN auth |
| `GOOGLE_CLIENT_ID` | Removed | OAuth not implemented |
| `GOOGLE_CLIENT_SECRET` | Removed | OAuth not implemented |
| `OPENROUTER_API_KEY` | Removed | Using local Ollama instead |
| `BLOB_READ_WRITE_TOKEN` | Optional | Vercel Blob storage (not required for local) |

---

## Docker Environment

When running with Docker Compose, use these internal hostnames:

| Service | Internal URL | External URL |
|---------|--------------|--------------|
| PostgreSQL | `postgres:5432` | `localhost:5432` |
| Ollama | `ollama:11434` | `localhost:11434` |
| Whisper | `whisper:8001` | `localhost:8001` |
| Piper | `piper:8002` | `localhost:8002` |
| ChromaDB | `chromadb:8000` | `localhost:8003` |

**Example `.env` for Docker:**

```bash
POSTGRES_URL="postgresql://postgres:postgres@postgres:5432/meeting_assistant"
OLLAMA_BASE_URL="http://ollama:11434"
WHISPER_SERVICE_URL="http://whisper:8001"
PIPER_SERVICE_URL="http://piper:8002"
CHROMADB_URL="http://chromadb:8000"
ADMIN_PIN="your-secure-pin"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## Environment-Specific Configurations

### Development

```bash
# .env.local
POSTGRES_URL="postgresql://dev_user:dev_password@localhost:5432/postgres_dev"
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="llama3.2"
WHISPER_SERVICE_URL="http://localhost:8001"
PIPER_SERVICE_URL="http://localhost:8002"
CHROMADB_URL="http://localhost:8003"
ADMIN_PIN="1234"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Production

```bash
# .env.production
POSTGRES_URL="postgresql://prod_user:SECURE_PASSWORD@db.example.com:5432/meeting_assistant"
OLLAMA_BASE_URL="http://ollama-server:11434"
OLLAMA_MODEL="llama3.3:70b"
OLLAMA_FAST_MODEL="llama3.2"
WHISPER_SERVICE_URL="http://whisper-server:8001"
WHISPER_MODEL_SIZE="large-v3"
PIPER_SERVICE_URL="http://piper-server:8002"
CHROMADB_URL="http://chromadb-server:8003"
ADMIN_PIN="YOUR_SECURE_PIN"
NEXT_PUBLIC_APP_URL="https://meeting.example.com"
NODE_ENV="production"
```

### Docker Compose Override

Create a `docker-compose.override.yml` for local customization:

```yaml
services:
  whisper:
    environment:
      - WHISPER_MODEL_SIZE=large-v3
      - WHISPER_DEVICE=cuda

  piper:
    environment:
      - PIPER_VOICE=en_US-lessac-high
```

---

## Troubleshooting

### Common Issues

**"POSTGRES_URL is not set"**
- Ensure `.env.local` exists and contains `POSTGRES_URL`
- Restart the development server after adding variables

**"Cannot connect to Ollama"**
- Verify Ollama is running: `ollama serve`
- Check URL matches `OLLAMA_BASE_URL`
- Ensure model is installed: `ollama list`

**"Whisper/Piper service unavailable"**
- Start Python services: `./scripts/start.ps1` (Windows) or `./scripts/start.sh` (Linux)
- Check health: `./scripts/health-check.ps1`

**"Wake word not working"**
- Ensure `NEXT_PUBLIC_PORCUPINE_ACCESS_KEY` is set
- Key must be valid and not expired
- Check browser microphone permissions

### Verifying Configuration

Run the health check to verify all services:

```powershell
# Windows
.\scripts\health-check.ps1

# Linux/macOS
./scripts/health-check.sh
```

Or check via the diagnostics API:

```bash
curl http://localhost:3000/api/diagnostics
```
