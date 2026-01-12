#!/bin/bash
# AI Meeting Assistant - Startup Script
# This script starts all required services for the meeting assistant

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
OLLAMA_URL="${OLLAMA_BASE_URL:-http://localhost:11434}"
OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.2}"
WHISPER_PORT="${WHISPER_PORT:-8001}"
PIPER_PORT="${PIPER_PORT:-8002}"
CHROMADB_PORT="${CHROMADB_PORT:-8003}"
NEXT_PORT="${NEXT_PORT:-3000}"

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  AI Meeting Assistant - Startup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to check if a service is running
check_service() {
    local url=$1
    local name=$2
    if curl -s --connect-timeout 2 "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}[OK]${NC} $name is running"
        return 0
    else
        echo -e "${YELLOW}[--]${NC} $name is not running"
        return 1
    fi
}

# Function to wait for a service to be ready
wait_for_service() {
    local url=$1
    local name=$2
    local max_attempts=${3:-30}
    local attempt=1

    echo -n "Waiting for $name..."
    while [ $attempt -le $max_attempts ]; do
        if curl -s --connect-timeout 2 "$url" > /dev/null 2>&1; then
            echo -e " ${GREEN}Ready!${NC}"
            return 0
        fi
        echo -n "."
        sleep 1
        ((attempt++))
    done
    echo -e " ${RED}Timeout!${NC}"
    return 1
}

# Step 1: Check Ollama
echo -e "${BLUE}Step 1: Checking Ollama...${NC}"
if ! check_service "$OLLAMA_URL/api/tags" "Ollama"; then
    echo -e "${YELLOW}Starting Ollama...${NC}"
    if command -v ollama &> /dev/null; then
        ollama serve &
        sleep 3
        if ! check_service "$OLLAMA_URL/api/tags" "Ollama"; then
            echo -e "${RED}Error: Failed to start Ollama${NC}"
            echo "Please start Ollama manually: ollama serve"
            exit 1
        fi
    else
        echo -e "${RED}Error: Ollama not installed${NC}"
        echo "Please install Ollama from https://ollama.ai"
        exit 1
    fi
fi

# Check if required model is available
echo -e "${BLUE}Checking for model: $OLLAMA_MODEL${NC}"
if ! ollama list 2>/dev/null | grep -q "$OLLAMA_MODEL"; then
    echo -e "${YELLOW}Downloading model: $OLLAMA_MODEL${NC}"
    ollama pull "$OLLAMA_MODEL"
fi
echo -e "${GREEN}[OK]${NC} Model $OLLAMA_MODEL is available"
echo ""

# Step 2: Start/Check Whisper Service
echo -e "${BLUE}Step 2: Checking Whisper STT Service...${NC}"
if ! check_service "http://localhost:$WHISPER_PORT/health" "Whisper"; then
    echo -e "${YELLOW}Starting Whisper service...${NC}"

    WHISPER_DIR="$PROJECT_DIR/services/whisper"
    if [ -d "$WHISPER_DIR" ]; then
        cd "$WHISPER_DIR"

        # Create venv if it doesn't exist
        if [ ! -d "venv" ]; then
            echo "Creating Python virtual environment..."
            python3 -m venv venv
        fi

        # Activate venv and install dependencies
        source venv/bin/activate
        pip install -q -r requirements.txt

        # Start the service in background
        echo "Starting Whisper on port $WHISPER_PORT..."
        python main.py &
        WHISPER_PID=$!
        echo "Whisper PID: $WHISPER_PID"

        cd "$PROJECT_DIR"

        # Wait for service to be ready
        wait_for_service "http://localhost:$WHISPER_PORT/health" "Whisper" 60
    else
        echo -e "${YELLOW}Warning: Whisper service directory not found${NC}"
        echo "Whisper transcription will not be available"
    fi
fi
echo ""

# Step 3: Start/Check Piper Service
echo -e "${BLUE}Step 3: Checking Piper TTS Service...${NC}"
if ! check_service "http://localhost:$PIPER_PORT/health" "Piper"; then
    echo -e "${YELLOW}Starting Piper service...${NC}"

    PIPER_DIR="$PROJECT_DIR/services/piper"
    if [ -d "$PIPER_DIR" ]; then
        cd "$PIPER_DIR"

        # Create venv if it doesn't exist
        if [ ! -d "venv" ]; then
            echo "Creating Python virtual environment..."
            python3 -m venv venv
        fi

        # Activate venv and install dependencies
        source venv/bin/activate
        pip install -q -r requirements.txt

        # Start the service in background
        echo "Starting Piper on port $PIPER_PORT..."
        python main.py &
        PIPER_PID=$!
        echo "Piper PID: $PIPER_PID"

        cd "$PROJECT_DIR"

        # Wait for service to be ready
        wait_for_service "http://localhost:$PIPER_PORT/health" "Piper" 60
    else
        echo -e "${YELLOW}Warning: Piper service directory not found${NC}"
        echo "Text-to-speech will not be available"
    fi
fi
echo ""

# Step 4: Start/Check ChromaDB
echo -e "${BLUE}Step 4: Checking ChromaDB...${NC}"
if ! check_service "http://localhost:$CHROMADB_PORT/api/v1/heartbeat" "ChromaDB"; then
    echo -e "${YELLOW}Starting ChromaDB via Docker...${NC}"

    if command -v docker &> /dev/null; then
        # Check if container already exists
        if docker ps -a --format '{{.Names}}' | grep -q "chromadb"; then
            docker start chromadb
        else
            docker run -d \
                --name chromadb \
                -p $CHROMADB_PORT:8000 \
                -v chromadb_data:/chroma/chroma \
                chromadb/chroma
        fi

        wait_for_service "http://localhost:$CHROMADB_PORT/api/v1/heartbeat" "ChromaDB" 30
    else
        echo -e "${YELLOW}Warning: Docker not available${NC}"
        echo "ChromaDB (document search) will not be available"
    fi
fi
echo ""

# Step 5: Check PostgreSQL
echo -e "${BLUE}Step 5: Checking PostgreSQL...${NC}"
if command -v pg_isready &> /dev/null; then
    if pg_isready -q; then
        echo -e "${GREEN}[OK]${NC} PostgreSQL is running"
    else
        echo -e "${YELLOW}Warning: PostgreSQL is not running${NC}"
        echo "Starting PostgreSQL via Docker Compose..."
        cd "$PROJECT_DIR"
        docker compose up -d postgres
        sleep 3
    fi
else
    echo "Checking via Docker..."
    if docker ps --format '{{.Names}}' | grep -q "postgres"; then
        echo -e "${GREEN}[OK]${NC} PostgreSQL container is running"
    else
        echo -e "${YELLOW}Starting PostgreSQL via Docker Compose...${NC}"
        cd "$PROJECT_DIR"
        docker compose up -d postgres
        sleep 3
    fi
fi
echo ""

# Step 6: Run database migrations
echo -e "${BLUE}Step 6: Running database migrations...${NC}"
cd "$PROJECT_DIR"
if [ -f "package.json" ]; then
    pnpm run db:migrate 2>/dev/null || echo -e "${YELLOW}Migration skipped or already applied${NC}"
fi
echo ""

# Step 7: Start Next.js
echo -e "${BLUE}Step 7: Starting Next.js application...${NC}"
cd "$PROJECT_DIR"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  All services started!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Services running:"
echo -e "  - Ollama:   ${BLUE}$OLLAMA_URL${NC}"
echo -e "  - Whisper:  ${BLUE}http://localhost:$WHISPER_PORT${NC}"
echo -e "  - Piper:    ${BLUE}http://localhost:$PIPER_PORT${NC}"
echo -e "  - ChromaDB: ${BLUE}http://localhost:$CHROMADB_PORT${NC}"
echo -e "  - App:      ${BLUE}http://localhost:$NEXT_PORT${NC}"
echo ""
echo -e "${YELLOW}Starting Next.js dev server...${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Trap to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down services...${NC}"

    # Kill background processes
    if [ -n "$WHISPER_PID" ]; then
        kill $WHISPER_PID 2>/dev/null || true
    fi
    if [ -n "$PIPER_PID" ]; then
        kill $PIPER_PID 2>/dev/null || true
    fi

    echo -e "${GREEN}Goodbye!${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start Next.js in foreground
pnpm run dev
