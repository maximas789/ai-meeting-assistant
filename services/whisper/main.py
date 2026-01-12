"""
Faster-Whisper Speech-to-Text Service

A FastAPI server that provides transcription endpoints using faster-whisper.
Supports both batch and streaming transcription modes.
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, AsyncGenerator
import io
import os
import tempfile
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Faster-Whisper STT Service",
    description="Speech-to-Text service using faster-whisper for local transcription",
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
MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "base")
DEVICE = os.getenv("WHISPER_DEVICE", "cpu")  # "cuda" for GPU
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")  # "float16" for GPU

# Lazy load model to avoid startup delay if not needed
_model = None


def get_model():
    """Lazy load the whisper model."""
    global _model
    if _model is None:
        try:
            from faster_whisper import WhisperModel
            logger.info(f"Loading Whisper model: {MODEL_SIZE} on {DEVICE} with {COMPUTE_TYPE}")
            _model = WhisperModel(
                MODEL_SIZE,
                device=DEVICE,
                compute_type=COMPUTE_TYPE
            )
            logger.info("Whisper model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
            raise
    return _model


class TranscriptionResponse(BaseModel):
    """Response model for transcription results."""
    text: str
    language: Optional[str] = None
    language_probability: Optional[float] = None
    duration: Optional[float] = None


class TranscriptionSegment(BaseModel):
    """Model for individual transcription segments."""
    id: int
    start: float
    end: float
    text: str
    words: Optional[list] = None


class DetailedTranscriptionResponse(BaseModel):
    """Detailed response including segments and timing."""
    text: str
    language: str
    language_probability: float
    duration: float
    segments: list[TranscriptionSegment]


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "model_size": MODEL_SIZE,
        "device": DEVICE,
        "compute_type": COMPUTE_TYPE
    }


@app.get("/models")
async def list_models():
    """List available model sizes."""
    return {
        "available_models": [
            "tiny",
            "tiny.en",
            "base",
            "base.en",
            "small",
            "small.en",
            "medium",
            "medium.en",
            "large-v1",
            "large-v2",
            "large-v3"
        ],
        "current_model": MODEL_SIZE
    }


@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe(
    audio: UploadFile = File(...),
    language: Optional[str] = None,
    task: Optional[str] = "transcribe"  # or "translate"
):
    """
    Transcribe audio file to text.

    Args:
        audio: Audio file (WAV, MP3, etc.)
        language: Optional language code (e.g., "en", "es"). Auto-detected if not provided.
        task: "transcribe" or "translate" (translate converts to English)

    Returns:
        TranscriptionResponse with transcribed text and metadata
    """
    try:
        model = get_model()

        # Read audio data
        audio_bytes = await audio.read()

        # Write to temp file (faster-whisper requires file path or file-like object)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            # Transcribe
            segments, info = model.transcribe(
                tmp_path,
                beam_size=5,
                language=language,
                task=task,
                vad_filter=True,  # Voice Activity Detection to skip silence
                vad_parameters=dict(
                    min_silence_duration_ms=500,
                    speech_pad_ms=200
                )
            )

            # Collect all text - convert generator to list to handle empty case
            try:
                segments_list = list(segments)
            except Exception as e:
                # Handle "max() iterable argument is empty" when VAD removes all audio
                if "max()" in str(e) or "empty" in str(e):
                    logger.info("No speech detected in audio (VAD filtered all content)")
                    return TranscriptionResponse(
                        text="",
                        language="en",
                        language_probability=0.0,
                        duration=info.duration if hasattr(info, 'duration') and info.duration else 0.0
                    )
                # Log the actual exception type for debugging
                logger.error(f"Unexpected error during transcription: {type(e).__name__}: {e}")
                raise

            # Handle case where VAD removes all audio (no speech detected)
            if not segments_list:
                return TranscriptionResponse(
                    text="",
                    language=info.language if info.language else "en",
                    language_probability=info.language_probability if info.language_probability else 0.0,
                    duration=info.duration if info.duration else 0.0
                )

            text_parts = []
            for segment in segments_list:
                text_parts.append(segment.text.strip())

            full_text = " ".join(text_parts)

            return TranscriptionResponse(
                text=full_text,
                language=info.language,
                language_probability=info.language_probability,
                duration=info.duration
            )

        finally:
            # Clean up temp file
            os.unlink(tmp_path)

    except Exception as e:
        error_str = str(e)
        # Handle "max() iterable argument is empty" when VAD removes all audio
        # This can happen if the audio is silent or contains no speech
        if "max()" in error_str and "empty" in error_str:
            logger.info("No speech detected in audio (caught at outer handler)")
            return TranscriptionResponse(
                text="",
                language="en",
                language_probability=0.0,
                duration=0.0
            )
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/transcribe/detailed", response_model=DetailedTranscriptionResponse)
async def transcribe_detailed(
    audio: UploadFile = File(...),
    language: Optional[str] = None,
    task: Optional[str] = "transcribe",
    word_timestamps: bool = False
):
    """
    Transcribe audio with detailed segment information.

    Returns segments with timing information, useful for subtitles or synchronized display.
    """
    try:
        model = get_model()

        audio_bytes = await audio.read()

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            segments_gen, info = model.transcribe(
                tmp_path,
                beam_size=5,
                language=language,
                task=task,
                word_timestamps=word_timestamps,
                vad_filter=True
            )

            segments = []
            text_parts = []

            try:
                segment_list = list(segments_gen)
            except ValueError as e:
                # Handle "max() iterable argument is empty" when VAD removes all audio
                if "max()" in str(e) or "empty" in str(e):
                    logger.info("No speech detected in audio (VAD filtered all content)")
                    return DetailedTranscriptionResponse(
                        text="",
                        language="en",
                        language_probability=0.0,
                        duration=info.duration if hasattr(info, 'duration') and info.duration else 0.0,
                        segments=[]
                    )
                raise

            for i, segment in enumerate(segment_list):
                text_parts.append(segment.text.strip())

                seg_data = TranscriptionSegment(
                    id=i,
                    start=segment.start,
                    end=segment.end,
                    text=segment.text.strip()
                )

                if word_timestamps and segment.words:
                    seg_data.words = [
                        {"word": w.word, "start": w.start, "end": w.end, "probability": w.probability}
                        for w in segment.words
                    ]

                segments.append(seg_data)

            # Handle case where VAD removes all audio (no speech detected)
            if not segments:
                return DetailedTranscriptionResponse(
                    text="",
                    language=info.language if info.language else "en",
                    language_probability=info.language_probability if info.language_probability else 0.0,
                    duration=info.duration if info.duration else 0.0,
                    segments=[]
                )

            return DetailedTranscriptionResponse(
                text=" ".join(text_parts),
                language=info.language,
                language_probability=info.language_probability,
                duration=info.duration,
                segments=segments
            )

        finally:
            os.unlink(tmp_path)

    except Exception as e:
        error_str = str(e)
        # Handle "max() iterable argument is empty" when VAD removes all audio
        if "max()" in error_str and "empty" in error_str:
            logger.info("No speech detected in audio (caught at outer handler)")
            return DetailedTranscriptionResponse(
                text="",
                language="en",
                language_probability=0.0,
                duration=0.0,
                segments=[]
            )
        logger.error(f"Detailed transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/transcribe/stream")
async def transcribe_stream(
    audio: UploadFile = File(...),
    language: Optional[str] = None
):
    """
    Stream transcription results as Server-Sent Events.

    Each segment is sent as it's transcribed, allowing for real-time display.
    """
    try:
        model = get_model()

        audio_bytes = await audio.read()

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        async def generate_segments() -> AsyncGenerator[str, None]:
            try:
                segments, info = model.transcribe(
                    tmp_path,
                    beam_size=5,
                    language=language,
                    vad_filter=True
                )

                # Send language info first
                yield f"data: {{'type': 'info', 'language': '{info.language}', 'probability': {info.language_probability}}}\n\n"

                for segment in segments:
                    import json
                    data = {
                        "type": "segment",
                        "start": segment.start,
                        "end": segment.end,
                        "text": segment.text.strip()
                    }
                    yield f"data: {json.dumps(data)}\n\n"

                yield "data: {\"type\": \"done\"}\n\n"

            finally:
                os.unlink(tmp_path)

        return StreamingResponse(
            generate_segments(),
            media_type="text/event-stream"
        )

    except Exception as e:
        logger.error(f"Stream transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)
