# Piper TTS Service Dockerfile

# Use Python 3.11 for compatibility
FROM python:3.14-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Download and install Piper
RUN wget -q https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_amd64.tar.gz \
    && tar -xzf piper_amd64.tar.gz \
    && mv piper /usr/local/bin/ \
    && rm piper_amd64.tar.gz

# Create models directory
RUN mkdir -p /app/models

# Download default voice model (Amy - medium quality)
RUN wget -q -O /app/models/en_US-amy-medium.onnx \
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx" \
    && wget -q -O /app/models/en_US-amy-medium.onnx.json \
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json"

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY main.py .

# Environment variables (can be overridden at runtime)
ENV PIPER_PATH=/usr/local/bin/piper/piper
ENV PIPER_MODEL_PATH=/app/models/en_US-amy-medium.onnx
ENV PIPER_MODEL_CONFIG_PATH=/app/models/en_US-amy-medium.onnx.json
ENV PIPER_SAMPLE_RATE=22050
ENV PORT=8002

# Expose the service port
EXPOSE 8002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8002/health')" || exit 1

# Run the service
CMD ["python", "main.py"]
