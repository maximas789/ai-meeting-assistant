# Piper TTS Service

Text-to-Speech service using [Piper](https://github.com/rhasspy/piper) for fast, local voice synthesis.

## Features

- High-quality neural TTS with multiple voice models
- Adjustable speech speed (slow, normal, fast, very_fast)
- WAV audio output
- Streaming audio response
- Low latency for real-time applications

## Setup

### Option 1: Docker (Recommended)

```bash
docker build -t piper-service .
docker run -p 8002:8002 piper-service
```

### Option 2: Local Installation

1. Install Piper:
   ```bash
   # Download Piper binary
   wget https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_amd64.tar.gz
   tar -xzf piper_amd64.tar.gz
   sudo mv piper /usr/local/bin/
   ```

2. Download a voice model:
   ```bash
   mkdir -p models
   wget -O models/en_US-amy-medium.onnx \
     "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx"
   wget -O models/en_US-amy-medium.onnx.json \
     "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json"
   ```

3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Run the service:
   ```bash
   PIPER_PATH=/usr/local/bin/piper/piper \
   PIPER_MODEL_PATH=./models/en_US-amy-medium.onnx \
   python main.py
   ```

## API Endpoints

### Health Check
```
GET /health
```

### List Available Voices
```
GET /voices
```

### Synthesize Speech
```
POST /speak
Content-Type: application/json

{
  "text": "Hello, this is a test.",
  "speed": "normal"  // slow, normal, fast, very_fast
}
```

Returns: WAV audio file

### Synthesize Speech (GET)
```
GET /speak?text=Hello&speed=normal
```

### Stream Speech
```
POST /speak/stream
Content-Type: application/json

{
  "text": "Hello, this is a streaming test."
}
```

Returns: Streaming WAV audio

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PIPER_PATH` | `piper` | Path to Piper executable |
| `PIPER_MODEL_PATH` | `/app/models/en_US-amy-medium.onnx` | Path to voice model |
| `PIPER_MODEL_CONFIG_PATH` | `/app/models/en_US-amy-medium.onnx.json` | Path to model config |
| `PIPER_SAMPLE_RATE` | `22050` | Audio sample rate |
| `PIPER_NOISE_SCALE` | `0.667` | Noise scale for synthesis |
| `PIPER_LENGTH_SCALE` | `1.0` | Length scale (speed) |
| `PIPER_NOISE_W` | `0.8` | Noise width |
| `PORT` | `8002` | Server port |

## Voice Models

Available voices can be found at:
https://huggingface.co/rhasspy/piper-voices

Popular options:
- `en_US-amy-medium` - American English female (default)
- `en_US-ryan-medium` - American English male
- `en_GB-alan-medium` - British English male
- `en_GB-jenny-medium` - British English female

To use a different voice, download the `.onnx` and `.onnx.json` files and update the environment variables.

## Integration with Meeting Assistant

This service is called by the Next.js API route at `/api/speak`, which forwards text from the LLM to Piper for voice synthesis. The audio is then streamed back to the browser for playback.

The service supports barge-in (interruption) by immediately stopping when the client closes the connection.
