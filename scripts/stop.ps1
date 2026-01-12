# AI Meeting Assistant - Stop Script (PowerShell)
# This script stops all running services

param(
    [switch]$KeepDatabase,
    [switch]$KeepChromaDB
)

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  AI Meeting Assistant - Shutdown" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

# Stop Python services by finding processes on specific ports
function Stop-ServiceOnPort {
    param(
        [int]$Port,
        [string]$Name
    )

    Write-Host "Stopping $Name on port $Port..." -NoNewline

    try {
        $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        if ($connections) {
            foreach ($conn in $connections) {
                $process = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
                if ($process) {
                    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
                }
            }
            Write-Host " Stopped" -ForegroundColor Green
        }
        else {
            Write-Host " Not running" -ForegroundColor Gray
        }
    }
    catch {
        Write-Host " Not running" -ForegroundColor Gray
    }
}

# Stop Whisper
Stop-ServiceOnPort -Port 8001 -Name "Whisper"

# Stop Piper
Stop-ServiceOnPort -Port 8002 -Name "Piper"

# Stop Next.js dev server
Stop-ServiceOnPort -Port 3000 -Name "Next.js"

# Stop ChromaDB container
if (-not $KeepChromaDB) {
    Write-Host "Stopping ChromaDB container..." -NoNewline
    $docker = Get-Command docker -ErrorAction SilentlyContinue
    if ($docker) {
        docker stop chromadb 2>$null
        Write-Host " Stopped" -ForegroundColor Green
    }
    else {
        Write-Host " Docker not available" -ForegroundColor Gray
    }
}

# Stop PostgreSQL container
if (-not $KeepDatabase) {
    Write-Host "Stopping PostgreSQL container..." -NoNewline
    $docker = Get-Command docker -ErrorAction SilentlyContinue
    if ($docker) {
        # Get project directory
        $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
        $ProjectDir = Split-Path -Parent $ScriptDir

        Push-Location $ProjectDir
        docker compose down 2>$null
        Pop-Location
        Write-Host " Stopped" -ForegroundColor Green
    }
    else {
        Write-Host " Docker not available" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "All services stopped." -ForegroundColor Green
Write-Host ""
