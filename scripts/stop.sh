#!/bin/bash
# AI Meeting Assistant - Stop Script
# This script stops all running services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

KEEP_DATABASE=false
KEEP_CHROMADB=false

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --keep-database) KEEP_DATABASE=true ;;
        --keep-chromadb) KEEP_CHROMADB=true ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}  AI Meeting Assistant - Shutdown${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

# Function to stop service on port
stop_service_on_port() {
    local port=$1
    local name=$2

    echo -n "Stopping $name on port $port..."

    local pid=$(lsof -ti:$port 2>/dev/null || true)
    if [ -n "$pid" ]; then
        kill $pid 2>/dev/null || true
        echo -e " ${GREEN}Stopped${NC}"
    else
        echo -e " ${YELLOW}Not running${NC}"
    fi
}

# Stop Whisper
stop_service_on_port 8001 "Whisper"

# Stop Piper
stop_service_on_port 8002 "Piper"

# Stop Next.js
stop_service_on_port 3000 "Next.js"

# Stop ChromaDB
if [ "$KEEP_CHROMADB" = false ]; then
    echo -n "Stopping ChromaDB container..."
    if command -v docker &> /dev/null; then
        docker stop chromadb 2>/dev/null && echo -e " ${GREEN}Stopped${NC}" || echo -e " ${YELLOW}Not running${NC}"
    else
        echo -e " ${YELLOW}Docker not available${NC}"
    fi
fi

# Stop PostgreSQL
if [ "$KEEP_DATABASE" = false ]; then
    echo -n "Stopping PostgreSQL..."
    if command -v docker &> /dev/null; then
        cd "$PROJECT_DIR"
        docker compose down 2>/dev/null && echo -e " ${GREEN}Stopped${NC}" || echo -e " ${YELLOW}Not running${NC}"
    else
        echo -e " ${YELLOW}Docker not available${NC}"
    fi
fi

echo ""
echo -e "${GREEN}All services stopped.${NC}"
echo ""
