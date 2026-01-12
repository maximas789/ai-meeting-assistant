#!/bin/bash
# AI Meeting Assistant - Health Check Script
# Checks the status of all services

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
GRAY='\033[0;90m'
NC='\033[0m'

# Configuration
OLLAMA_URL="${OLLAMA_BASE_URL:-http://localhost:11434}"
WHISPER_PORT="${WHISPER_PORT:-8001}"
PIPER_PORT="${PIPER_PORT:-8002}"
CHROMADB_PORT="${CHROMADB_PORT:-8003}"
NEXT_PORT="${NEXT_PORT:-3000}"

# Options
JSON_OUTPUT=false
WATCH_MODE=false
INTERVAL=5

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --json) JSON_OUTPUT=true ;;
        --watch) WATCH_MODE=true ;;
        --interval) INTERVAL="$2"; shift ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

# Check a single service
check_service() {
    local name=$1
    local url=$2

    local start_time=$(date +%s%N)
    local status="unhealthy"
    local response_time=""
    local error=""

    if curl -s --connect-timeout 2 -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|204"; then
        local end_time=$(date +%s%N)
        response_time=$(( (end_time - start_time) / 1000000 ))
        status="healthy"
    else
        error="Connection failed or non-200 response"
    fi

    if [ "$JSON_OUTPUT" = true ]; then
        echo "{\"name\":\"$name\",\"url\":\"$url\",\"status\":\"$status\",\"responseTime\":$response_time,\"error\":\"$error\"}"
    else
        if [ "$status" = "healthy" ]; then
            echo -e "${GREEN}[OK]${NC} $name ${GRAY}(${response_time}ms)${NC}"
        else
            echo -e "${RED}[!!]${NC} $name"
            [ -n "$error" ] && echo -e "    ${RED}Error: $error${NC}"
        fi
    fi

    [ "$status" = "healthy" ] && return 0 || return 1
}

# Run all health checks
run_checks() {
    local healthy_count=0
    local total_count=5

    if [ "$JSON_OUTPUT" = false ]; then
        echo ""
        echo -e "${BLUE}========================================${NC}"
        echo -e "${BLUE}  AI Meeting Assistant - Health Check${NC}"
        echo -e "${BLUE}========================================${NC}"
        echo ""
        echo "Timestamp: $(date -Iseconds)"
        echo ""
    fi

    # Check each service
    check_service "Ollama" "$OLLAMA_URL/api/tags" && ((healthy_count++)) || true
    check_service "Whisper" "http://localhost:$WHISPER_PORT/health" && ((healthy_count++)) || true
    check_service "Piper" "http://localhost:$PIPER_PORT/health" && ((healthy_count++)) || true
    check_service "ChromaDB" "http://localhost:$CHROMADB_PORT/api/v1/heartbeat" && ((healthy_count++)) || true
    check_service "Next.js" "http://localhost:$NEXT_PORT/api/diagnostics" && ((healthy_count++)) || true

    # Overall status
    local overall="unhealthy"
    local exit_code=2

    if [ $healthy_count -eq $total_count ]; then
        overall="healthy"
        exit_code=0
    elif [ $healthy_count -gt 0 ]; then
        overall="degraded"
        exit_code=1
    fi

    if [ "$JSON_OUTPUT" = false ]; then
        echo ""
        echo "----------------------------------------"
        echo ""
        echo -n "Overall Status: "
        case $overall in
            healthy) echo -e "${GREEN}HEALTHY${NC}" ;;
            degraded) echo -e "${YELLOW}DEGRADED${NC}" ;;
            *) echo -e "${RED}UNHEALTHY${NC}" ;;
        esac
        echo "Services: $healthy_count/$total_count healthy"
        echo ""
    else
        echo "{\"overall\":\"$overall\",\"healthyCount\":$healthy_count,\"totalCount\":$total_count}"
    fi

    return $exit_code
}

# Main execution
if [ "$WATCH_MODE" = true ]; then
    echo -e "${YELLOW}Watching health status every ${INTERVAL}s... (Ctrl+C to stop)${NC}"
    while true; do
        clear
        run_checks
        echo -e "${GRAY}Refreshing in ${INTERVAL}s...${NC}"
        sleep $INTERVAL
    done
else
    run_checks
    exit $?
fi
