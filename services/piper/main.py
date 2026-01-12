"""
Piper Text-to-Speech Service

A FastAPI server that provides TTS endpoints using Piper.
Supports both batch and streaming audio output.
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel
from typing import Optional
import io
import os
import subprocess
import tempfile
import logging
import wave
import struct

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Piper TTS Service",
    description="Text-to-Speech service using Piper for local voice synthesis",
    version="1.0.0"
)

# CORS middleware for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Model configuration
PIPER_PATH = os.getenv("PIPER_PATH", "piper")
MODEL_PATH = os.getenv("PIPER_MODEL_PATH", "/app/models/en_US-amy-medium.onnx")
MODEL_CONFIG_PATH = os.getenv("PIPER_MODEL_CONFIG_PATH", "/app/models/en_US-amy-medium.onnx.json")
SPEAKER_ID = os.getenv("PIPER_SPEAKER_ID", "0")
NOISE_SCALE = float(os.getenv("PIPER_NOISE_SCALE", "0.667"))
LENGTH_SCALE = float(os.getenv("PIPER_LENGTH_SCALE", "1.0"))
NOISE_W = float(os.getenv("PIPER_NOISE_W", "0.8"))
SAMPLE_RATE = int(os.getenv("PIPER_SAMPLE_RATE", "22050"))

# Voice speed presets
SPEED_PRESETS = {
    "slow": 1.3,      # Slower speech
    "normal": 1.0,    # Default speed
    "fast": 0.8,      # Faster speech
    "very_fast": 0.6  # Very fast speech
}


class SpeakRequest(BaseModel):
    """Request model for TTS."""
    text: str
    speaker_id: Optional[int] = None
    speed: Optional[str] = "normal"  # slow, normal, fast, very_fast
    noise_scale: Optional[float] = None
    noise_w: Optional[float] = None


class TTSResponse(BaseModel):
    """Response model for TTS metadata."""
    text: str
    duration_seconds: float
    sample_rate: int
    audio_format: str


def create_wav_header(sample_rate: int, num_channels: int, bits_per_sample: int, data_size: int) -> bytes:
    """Create a WAV file header."""
    byte_rate = sample_rate * num_channels * bits_per_sample // 8
    block_align = num_channels * bits_per_sample // 8

    header = struct.pack(
        '<4sI4s4sIHHIIHH4sI',
        b'RIFF',
        36 + data_size,  # ChunkSize
        b'WAVE',
        b'fmt ',
        16,  # Subchunk1Size (PCM)
        1,   # AudioFormat (PCM)
        num_channels,
        sample_rate,
        byte_rate,
        block_align,
        bits_per_sample,
        b'data',
        data_size
    )
    return header


def synthesize_speech(text: str, length_scale: float = 1.0, noise_scale: float = None, noise_w: float = None) -> bytes:
    """
    Synthesize speech using Piper.

    Returns raw PCM audio data.
    """
    _noise_scale = noise_scale if noise_scale is not None else NOISE_SCALE
    _noise_w = noise_w if noise_w is not None else NOISE_W

    # Build piper command
    cmd = [
        PIPER_PATH,
        "--model", MODEL_PATH,
        "--output-raw",
        "--length-scale", str(length_scale),
        "--noise-scale", str(_noise_scale),
        "--noise-w", str(_noise_w)
    ]

    # Add config path if it exists
    if os.path.exists(MODEL_CONFIG_PATH):
        cmd.extend(["--config", MODEL_CONFIG_PATH])

    logger.info(f"Running Piper with command: {' '.join(cmd)}")

    try:
        process = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )

        # Send text to piper via stdin
        audio_data, stderr = process.communicate(input=text.encode('utf-8'))

        if process.returncode != 0:
            error_msg = stderr.decode('utf-8') if stderr else "Unknown error"
            logger.error(f"Piper error: {error_msg}")
            raise RuntimeError(f"Piper synthesis failed: {error_msg}")

        return audio_data

    except FileNotFoundError:
        logger.error(f"Piper executable not found at: {PIPER_PATH}")
        raise RuntimeError(f"Piper executable not found. Please install Piper and set PIPER_PATH.")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    # Check if piper is available
    piper_available = False
    try:
        result = subprocess.run(
            [PIPER_PATH, "--help"],
            capture_output=True,
            timeout=5
        )
        piper_available = True
    except Exception as e:
        logger.warning(f"Piper health check failed: {e}")

    return {
        "status": "healthy" if piper_available else "degraded",
        "piper_available": piper_available,
        "model_path": MODEL_PATH,
        "sample_rate": SAMPLE_RATE
    }


@app.get("/voices")
async def list_voices():
    """List available voice models."""
    models_dir = os.path.dirname(MODEL_PATH)
    voices = []

    if os.path.exists(models_dir):
        for filename in os.listdir(models_dir):
            if filename.endswith('.onnx'):
                voices.append({
                    "name": filename.replace('.onnx', ''),
                    "path": os.path.join(models_dir, filename)
                })

    return {
        "current_voice": os.path.basename(MODEL_PATH).replace('.onnx', ''),
        "available_voices": voices,
        "sample_rate": SAMPLE_RATE
    }


@app.post("/speak")
async def speak(request: SpeakRequest):
    """
    Synthesize speech from text.

    Returns WAV audio data.
    """
    try:
        # Get length scale from speed preset
        length_scale = SPEED_PRESETS.get(request.speed, LENGTH_SCALE)

        # Synthesize raw PCM audio
        raw_audio = synthesize_speech(
            request.text,
            length_scale=length_scale,
            noise_scale=request.noise_scale,
            noise_w=request.noise_w
        )

        if not raw_audio:
            raise HTTPException(status_code=500, detail="No audio data generated")

        # Create WAV header and combine with audio data
        wav_header = create_wav_header(
            sample_rate=SAMPLE_RATE,
            num_channels=1,
            bits_per_sample=16,
            data_size=len(raw_audio)
        )

        wav_data = wav_header + raw_audio

        # Calculate duration
        duration = len(raw_audio) / (SAMPLE_RATE * 2)  # 16-bit = 2 bytes per sample

        logger.info(f"Generated {duration:.2f}s of audio for text: {request.text[:50]}...")

        return Response(
            content=wav_data,
            media_type="audio/wav",
            headers={
                "Content-Disposition": f'inline; filename="speech.wav"',
                "X-Audio-Duration": str(duration),
                "X-Sample-Rate": str(SAMPLE_RATE)
            }
        )

    except RuntimeError as e:
        logger.error(f"TTS error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected TTS error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/speak")
async def speak_get(
    text: str = Query(..., description="Text to synthesize"),
    speed: str = Query("normal", description="Speech speed: slow, normal, fast, very_fast")
):
    """
    Synthesize speech from text (GET version for simple use).

    Returns WAV audio data.
    """
    request = SpeakRequest(text=text, speed=speed)
    return await speak(request)


@app.post("/speak/stream")
async def speak_stream(request: SpeakRequest):
    """
    Stream synthesized speech audio.

    Returns streaming audio response for real-time playback.
    """
    try:
        length_scale = SPEED_PRESETS.get(request.speed, LENGTH_SCALE)

        # Synthesize audio
        raw_audio = synthesize_speech(
            request.text,
            length_scale=length_scale,
            noise_scale=request.noise_scale,
            noise_w=request.noise_w
        )

        if not raw_audio:
            raise HTTPException(status_code=500, detail="No audio data generated")

        # Create WAV header
        wav_header = create_wav_header(
            sample_rate=SAMPLE_RATE,
            num_channels=1,
            bits_per_sample=16,
            data_size=len(raw_audio)
        )

        async def generate_audio():
            """Stream audio data in chunks."""
            # First yield the WAV header
            yield wav_header

            # Then yield audio data in chunks (4KB chunks)
            chunk_size = 4096
            for i in range(0, len(raw_audio), chunk_size):
                yield raw_audio[i:i + chunk_size]

        return StreamingResponse(
            generate_audio(),
            media_type="audio/wav",
            headers={
                "Content-Disposition": f'inline; filename="speech.wav"',
                "Transfer-Encoding": "chunked"
            }
        )

    except RuntimeError as e:
        logger.error(f"Stream TTS error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected stream TTS error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/speak/chunks")
async def speak_chunks(request: SpeakRequest):
    """
    Synthesize speech and return as PCM chunks with metadata.

    Useful for custom audio processing pipelines.
    """
    try:
        length_scale = SPEED_PRESETS.get(request.speed, LENGTH_SCALE)

        raw_audio = synthesize_speech(
            request.text,
            length_scale=length_scale,
            noise_scale=request.noise_scale,
            noise_w=request.noise_w
        )

        if not raw_audio:
            raise HTTPException(status_code=500, detail="No audio data generated")

        duration = len(raw_audio) / (SAMPLE_RATE * 2)

        # Return raw PCM with metadata header
        async def generate_with_metadata():
            import json
            # Send metadata first as JSON line
            metadata = {
                "type": "metadata",
                "sample_rate": SAMPLE_RATE,
                "channels": 1,
                "bits_per_sample": 16,
                "duration": duration,
                "text": request.text
            }
            yield f"{json.dumps(metadata)}\n".encode('utf-8')

            # Then send raw audio
            yield raw_audio

        return StreamingResponse(
            generate_with_metadata(),
            media_type="application/octet-stream"
        )

    except Exception as e:
        logger.error(f"Chunks TTS error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8002"))
    uvicorn.run(app, host="0.0.0.0", port=port)
