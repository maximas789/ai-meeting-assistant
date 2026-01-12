# Faster-Whisper STT Service

Local speech-to-text service using faster-whisper for transcription.

## Quick Start

### Local Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
.\venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Run the service
python main.py
```

### Docker

```bash
# Build
docker build -t whisper-stt .

# Run (CPU)
docker run -p 8001:8001 whisper-stt

# Run (GPU - requires nvidia-docker)
docker run --gpus all -p 8001:8001 \
  -e WHISPER_DEVICE=cuda \
  -e WHISPER_COMPUTE_TYPE=float16 \
  whisper-stt
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WHISPER_MODEL_SIZE` | `base` | Model size: tiny, base, small, medium, large-v3 |
| `WHISPER_DEVICE` | `cpu` | Device: cpu or cuda |
| `WHISPER_COMPUTE_TYPE` | `int8` | Compute type: int8, float16, float32 |
| `PORT` | `8001` | Service port |

## API Endpoints

### Health Check
```
GET /health
```

### Transcribe Audio
```
POST /transcribe
Content-Type: multipart/form-data

Form fields:
- audio: Audio file (required)
- language: Language code, e.g., "en" (optional)
- task: "transcribe" or "translate" (optional)
```

### Detailed Transcription (with segments)
```
POST /transcribe/detailed
```

### Streaming Transcription (SSE)
```
POST /transcribe/stream
```

## Model Sizes

| Model | Size | VRAM | Speed | Quality |
|-------|------|------|-------|---------|
| tiny | 39M | ~1GB | Fastest | Lower |
| base | 74M | ~1GB | Fast | Good |
| small | 244M | ~2GB | Medium | Better |
| medium | 769M | ~5GB | Slower | High |
| large-v3 | 1550M | ~10GB | Slowest | Best |

## Example Usage

```bash
# Transcribe a WAV file
curl -X POST http://localhost:8001/transcribe \
  -F "audio=@recording.wav"

# Transcribe with language hint
curl -X POST http://localhost:8001/transcribe \
  -F "audio=@recording.wav" \
  -F "language=en"

# Get detailed segments
curl -X POST http://localhost:8001/transcribe/detailed \
  -F "audio=@recording.wav" \
  -F "word_timestamps=true"
```
