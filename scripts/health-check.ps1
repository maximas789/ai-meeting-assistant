# AI Meeting Assistant - Health Check Script (PowerShell)
# Checks the status of all services

param(
    [switch]$Json,
    [switch]$Watch,
    [int]$Interval = 5
)

# Configuration
$OLLAMA_URL = if ($env:OLLAMA_BASE_URL) { $env:OLLAMA_BASE_URL } else { "http://localhost:11434" }
$WHISPER_PORT = if ($env:WHISPER_PORT) { $env:WHISPER_PORT } else { "8001" }
$PIPER_PORT = if ($env:PIPER_PORT) { $env:PIPER_PORT } else { "8002" }
$CHROMADB_PORT = if ($env:CHROMADB_PORT) { $env:CHROMADB_PORT } else { "8003" }
$NEXT_PORT = if ($env:NEXT_PORT) { $env:NEXT_PORT } else { "3000" }

function Test-Service {
    param(
        [string]$Name,
        [string]$Url,
        [int]$TimeoutSec = 2
    )

    $result = @{
        name = $Name
        url = $Url
        status = "unknown"
        responseTime = $null
        error = $null
    }

    try {
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        $response = Invoke-WebRequest -Uri $Url -TimeoutSec $TimeoutSec -UseBasicParsing -ErrorAction Stop
        $stopwatch.Stop()

        $result.status = "healthy"
        $result.responseTime = $stopwatch.ElapsedMilliseconds
    }
    catch {
        $result.status = "unhealthy"
        $result.error = $_.Exception.Message
    }

    return $result
}

function Get-AllServicesHealth {
    $services = @(
        @{ Name = "Ollama"; Url = "$OLLAMA_URL/api/tags" }
        @{ Name = "Whisper"; Url = "http://localhost:$WHISPER_PORT/health" }
        @{ Name = "Piper"; Url = "http://localhost:$PIPER_PORT/health" }
        @{ Name = "ChromaDB"; Url = "http://localhost:$CHROMADB_PORT/api/v1/heartbeat" }
        @{ Name = "Next.js"; Url = "http://localhost:$NEXT_PORT/api/diagnostics" }
    )

    $results = @()
    foreach ($service in $services) {
        $results += Test-Service -Name $service.Name -Url $service.Url
    }

    $healthyCount = ($results | Where-Object { $_.status -eq "healthy" }).Count
    $totalCount = $results.Count

    return @{
        timestamp = (Get-Date).ToString("o")
        overall = if ($healthyCount -eq $totalCount) { "healthy" } elseif ($healthyCount -gt 0) { "degraded" } else { "unhealthy" }
        healthyCount = $healthyCount
        totalCount = $totalCount
        services = $results
    }
}

function Show-HealthReport {
    param($Health)

    Clear-Host
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Blue
    Write-Host "  AI Meeting Assistant - Health Check" -ForegroundColor Blue
    Write-Host "========================================" -ForegroundColor Blue
    Write-Host ""
    Write-Host "Timestamp: $($Health.timestamp)"
    Write-Host ""

    # Overall status
    $overallColor = switch ($Health.overall) {
        "healthy" { "Green" }
        "degraded" { "Yellow" }
        default { "Red" }
    }
    Write-Host "Overall Status: " -NoNewline
    Write-Host $Health.overall.ToUpper() -ForegroundColor $overallColor
    Write-Host "Services: $($Health.healthyCount)/$($Health.totalCount) healthy"
    Write-Host ""
    Write-Host "----------------------------------------"
    Write-Host ""

    # Individual services
    foreach ($service in $Health.services) {
        $statusColor = if ($service.status -eq "healthy") { "Green" } else { "Red" }
        $statusIcon = if ($service.status -eq "healthy") { "[OK]" } else { "[!!]" }

        Write-Host "$statusIcon " -ForegroundColor $statusColor -NoNewline
        Write-Host "$($service.name)" -NoNewline

        if ($service.status -eq "healthy") {
            Write-Host " ($($service.responseTime)ms)" -ForegroundColor Gray
        }
        else {
            Write-Host ""
            if ($service.error) {
                Write-Host "    Error: $($service.error)" -ForegroundColor Red
            }
        }
    }

    Write-Host ""
    Write-Host "----------------------------------------"
    Write-Host ""
}

# Main execution
if ($Watch) {
    Write-Host "Watching health status every $Interval seconds... (Ctrl+C to stop)" -ForegroundColor Yellow
    while ($true) {
        $health = Get-AllServicesHealth

        if ($Json) {
            $health | ConvertTo-Json -Depth 3
        }
        else {
            Show-HealthReport -Health $health
            Write-Host "Refreshing in $Interval seconds..." -ForegroundColor Gray
        }

        Start-Sleep -Seconds $Interval
    }
}
else {
    $health = Get-AllServicesHealth

    if ($Json) {
        $health | ConvertTo-Json -Depth 3
    }
    else {
        Show-HealthReport -Health $health
    }

    # Exit with appropriate code
    if ($health.overall -eq "healthy") {
        exit 0
    }
    elseif ($health.overall -eq "degraded") {
        exit 1
    }
    else {
        exit 2
    }
}
