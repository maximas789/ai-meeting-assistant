# AI Meeting Assistant - Startup Script (PowerShell)
# This script starts all required services for the meeting assistant

param(
    [switch]$SkipOllama,
    [switch]$SkipWhisper,
    [switch]$SkipPiper,
    [switch]$SkipChromaDB,
    [switch]$SkipDatabase
)

$ErrorActionPreference = "Continue"

# Configuration
$OLLAMA_URL = if ($env:OLLAMA_BASE_URL) { $env:OLLAMA_BASE_URL } else { "http://localhost:11434" }
$OLLAMA_MODEL = if ($env:OLLAMA_MODEL) { $env:OLLAMA_MODEL } else { "llama3.2" }
$WHISPER_PORT = if ($env:WHISPER_PORT) { $env:WHISPER_PORT } else { "8001" }
$PIPER_PORT = if ($env:PIPER_PORT) { $env:PIPER_PORT } else { "8002" }
$CHROMADB_PORT = if ($env:CHROMADB_PORT) { $env:CHROMADB_PORT } else { "8003" }
$NEXT_PORT = if ($env:NEXT_PORT) { $env:NEXT_PORT } else { "3000" }

# Script and project directories
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir

# Store background jobs
$script:BackgroundJobs = @()

function Write-Status {
    param(
        [string]$Status,
        [string]$Message
    )

    switch ($Status) {
        "OK" { Write-Host "[OK] " -ForegroundColor Green -NoNewline; Write-Host $Message }
        "WARN" { Write-Host "[--] " -ForegroundColor Yellow -NoNewline; Write-Host $Message }
        "ERROR" { Write-Host "[!!] " -ForegroundColor Red -NoNewline; Write-Host $Message }
        "INFO" { Write-Host "[..] " -ForegroundColor Blue -NoNewline; Write-Host $Message }
    }
}

function Test-ServiceRunning {
    param(
        [string]$Url,
        [string]$Name
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        Write-Status "OK" "$Name is running"
        return $true
    }
    catch {
        Write-Status "WARN" "$Name is not running"
        return $false
    }
}

function Wait-ForService {
    param(
        [string]$Url,
        [string]$Name,
        [int]$MaxAttempts = 30
    )

    Write-Host "Waiting for $Name..." -NoNewline

    for ($i = 1; $i -le $MaxAttempts; $i++) {
        try {
            $null = Invoke-WebRequest -Uri $Url -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
            Write-Host " Ready!" -ForegroundColor Green
            return $true
        }
        catch {
            Write-Host "." -NoNewline
            Start-Sleep -Seconds 1
        }
    }

    Write-Host " Timeout!" -ForegroundColor Red
    return $false
}

# Header
Write-Host ""
Write-Host "========================================" -ForegroundColor Blue
Write-Host "  AI Meeting Assistant - Startup" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""

# Step 1: Check Ollama
if (-not $SkipOllama) {
    Write-Host "Step 1: Checking Ollama..." -ForegroundColor Blue

    if (-not (Test-ServiceRunning "$OLLAMA_URL/api/tags" "Ollama")) {
        Write-Host "Starting Ollama..." -ForegroundColor Yellow

        $ollamaPath = Get-Command ollama -ErrorAction SilentlyContinue
        if ($ollamaPath) {
            Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden
            Start-Sleep -Seconds 3

            if (-not (Test-ServiceRunning "$OLLAMA_URL/api/tags" "Ollama")) {
                Write-Status "ERROR" "Failed to start Ollama"
                Write-Host "Please start Ollama manually: ollama serve"
            }
        }
        else {
            Write-Status "ERROR" "Ollama not installed"
            Write-Host "Please install Ollama from https://ollama.ai"
        }
    }

    # Check model
    Write-Host "Checking for model: $OLLAMA_MODEL" -ForegroundColor Blue
    $models = & ollama list 2>$null
    if ($models -notmatch $OLLAMA_MODEL) {
        Write-Host "Downloading model: $OLLAMA_MODEL" -ForegroundColor Yellow
        & ollama pull $OLLAMA_MODEL
    }
    Write-Status "OK" "Model $OLLAMA_MODEL is available"
    Write-Host ""
}

# Step 2: Start Whisper Service
if (-not $SkipWhisper) {
    Write-Host "Step 2: Checking Whisper STT Service..." -ForegroundColor Blue

    if (-not (Test-ServiceRunning "http://localhost:$WHISPER_PORT/health" "Whisper")) {
        Write-Host "Starting Whisper service..." -ForegroundColor Yellow

        $WhisperDir = Join-Path $ProjectDir "services\whisper"
        if (Test-Path $WhisperDir) {
            Push-Location $WhisperDir

            # Create venv if needed
            if (-not (Test-Path "venv")) {
                Write-Host "Creating Python virtual environment..."
                python -m venv venv
            }

            # Activate and install
            $activateScript = Join-Path $WhisperDir "venv\Scripts\Activate.ps1"
            if (Test-Path $activateScript) {
                & $activateScript
                pip install -q -r requirements.txt

                # Start in background
                Write-Host "Starting Whisper on port $WHISPER_PORT..."
                $job = Start-Job -ScriptBlock {
                    param($dir)
                    Set-Location $dir
                    & ".\venv\Scripts\python.exe" main.py
                } -ArgumentList $WhisperDir
                $script:BackgroundJobs += $job
            }

            Pop-Location
            Wait-ForService "http://localhost:$WHISPER_PORT/health" "Whisper" 60
        }
        else {
            Write-Status "WARN" "Whisper service directory not found"
        }
    }
    Write-Host ""
}

# Step 3: Start Piper Service
if (-not $SkipPiper) {
    Write-Host "Step 3: Checking Piper TTS Service..." -ForegroundColor Blue

    if (-not (Test-ServiceRunning "http://localhost:$PIPER_PORT/health" "Piper")) {
        Write-Host "Starting Piper service..." -ForegroundColor Yellow

        $PiperDir = Join-Path $ProjectDir "services\piper"
        if (Test-Path $PiperDir) {
            Push-Location $PiperDir

            # Create venv if needed
            if (-not (Test-Path "venv")) {
                Write-Host "Creating Python virtual environment..."
                python -m venv venv
            }

            # Activate and install
            $activateScript = Join-Path $PiperDir "venv\Scripts\Activate.ps1"
            if (Test-Path $activateScript) {
                & $activateScript
                pip install -q -r requirements.txt

                # Start in background
                Write-Host "Starting Piper on port $PIPER_PORT..."
                $job = Start-Job -ScriptBlock {
                    param($dir)
                    Set-Location $dir
                    & ".\venv\Scripts\python.exe" main.py
                } -ArgumentList $PiperDir
                $script:BackgroundJobs += $job
            }

            Pop-Location
            Wait-ForService "http://localhost:$PIPER_PORT/health" "Piper" 60
        }
        else {
            Write-Status "WARN" "Piper service directory not found"
        }
    }
    Write-Host ""
}

# Step 4: Start ChromaDB
if (-not $SkipChromaDB) {
    Write-Host "Step 4: Checking ChromaDB..." -ForegroundColor Blue

    if (-not (Test-ServiceRunning "http://localhost:$CHROMADB_PORT/api/v1/heartbeat" "ChromaDB")) {
        Write-Host "Starting ChromaDB via Docker..." -ForegroundColor Yellow

        $docker = Get-Command docker -ErrorAction SilentlyContinue
        if ($docker) {
            # Check if container exists
            $existing = docker ps -a --format "{{.Names}}" | Where-Object { $_ -eq "chromadb" }
            if ($existing) {
                docker start chromadb
            }
            else {
                docker run -d `
                    --name chromadb `
                    -p "${CHROMADB_PORT}:8000" `
                    -v chromadb_data:/chroma/chroma `
                    chromadb/chroma
            }

            Wait-ForService "http://localhost:$CHROMADB_PORT/api/v1/heartbeat" "ChromaDB" 30
        }
        else {
            Write-Status "WARN" "Docker not available - ChromaDB will not be available"
        }
    }
    Write-Host ""
}

# Step 5: Check PostgreSQL
if (-not $SkipDatabase) {
    Write-Host "Step 5: Checking PostgreSQL..." -ForegroundColor Blue

    $docker = Get-Command docker -ErrorAction SilentlyContinue
    if ($docker) {
        $pgContainer = docker ps --format "{{.Names}}" | Where-Object { $_ -match "postgres" }
        if ($pgContainer) {
            Write-Status "OK" "PostgreSQL container is running"
        }
        else {
            Write-Host "Starting PostgreSQL via Docker Compose..." -ForegroundColor Yellow
            Push-Location $ProjectDir
            docker compose up -d postgres
            Start-Sleep -Seconds 3
            Pop-Location
        }
    }
    Write-Host ""
}

# Step 6: Run migrations
Write-Host "Step 6: Running database migrations..." -ForegroundColor Blue
Push-Location $ProjectDir
try {
    pnpm run db:migrate 2>$null
    Write-Status "OK" "Migrations applied"
}
catch {
    Write-Status "WARN" "Migration skipped or already applied"
}
Pop-Location
Write-Host ""

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  All services started!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Services running:"
Write-Host "  - Ollama:   " -NoNewline; Write-Host $OLLAMA_URL -ForegroundColor Blue
Write-Host "  - Whisper:  " -NoNewline; Write-Host "http://localhost:$WHISPER_PORT" -ForegroundColor Blue
Write-Host "  - Piper:    " -NoNewline; Write-Host "http://localhost:$PIPER_PORT" -ForegroundColor Blue
Write-Host "  - ChromaDB: " -NoNewline; Write-Host "http://localhost:$CHROMADB_PORT" -ForegroundColor Blue
Write-Host "  - App:      " -NoNewline; Write-Host "http://localhost:$NEXT_PORT" -ForegroundColor Blue
Write-Host ""
Write-Host "Starting Next.js dev server..." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

# Cleanup function
$cleanup = {
    Write-Host ""
    Write-Host "Shutting down services..." -ForegroundColor Yellow

    # Stop background jobs
    foreach ($job in $script:BackgroundJobs) {
        Stop-Job -Job $job -ErrorAction SilentlyContinue
        Remove-Job -Job $job -ErrorAction SilentlyContinue
    }

    Write-Host "Goodbye!" -ForegroundColor Green
}

# Register cleanup
Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action $cleanup

# Start Next.js
Push-Location $ProjectDir
try {
    pnpm run dev
}
finally {
    & $cleanup
    Pop-Location
}
