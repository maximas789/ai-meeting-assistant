# Reliability Testing Guide

This document outlines the testing procedures to ensure the AI Meeting Assistant operates reliably for extended periods.

---

## Table of Contents

- [Overview](#overview)
- [Pre-Test Checklist](#pre-test-checklist)
- [Long-Running Operation Tests](#long-running-operation-tests)
- [Memory Leak Detection](#memory-leak-detection)
- [Service Recovery Testing](#service-recovery-testing)
- [Performance Benchmarks](#performance-benchmarks)
- [Monitoring and Logging](#monitoring-and-logging)
- [Known Issues and Workarounds](#known-issues-and-workarounds)

---

## Overview

The AI Meeting Assistant is designed to run continuously during meetings that may last several hours. This guide provides procedures to verify the system's reliability and identify potential issues before production deployment.

### Target Metrics

| Metric | Target |
|--------|--------|
| Continuous operation | 8+ hours without restart |
| Memory growth | < 100MB over 8 hours |
| Service recovery time | < 30 seconds |
| Audio transcription latency | < 2 seconds |
| AI response time | < 5 seconds |

---

## Pre-Test Checklist

Before running reliability tests, ensure:

- [ ] All services are running (use `./scripts/health-check.ps1` or `./scripts/health-check.sh`)
- [ ] Database is healthy and has sufficient space
- [ ] Ollama has the required models loaded
- [ ] Browser console is open for monitoring
- [ ] System resource monitor is running (Task Manager / htop)

### Service Health Check

```powershell
# Windows
.\scripts\health-check.ps1 --watch

# Linux/macOS
./scripts/health-check.sh --watch
```

Or via API:
```bash
curl http://localhost:3000/api/diagnostics
```

---

## Long-Running Operation Tests

### Test 1: 8-Hour Continuous Operation

**Objective:** Verify the system can run for a full workday without degradation.

**Procedure:**

1. Start all services fresh:
   ```powershell
   .\scripts\stop.ps1
   .\scripts\start.ps1
   ```

2. Open the meeting page at `http://localhost:3000/meeting`

3. Start a simulated meeting session:
   - Enable wake word detection
   - Leave running for 8 hours
   - Every 30 minutes, perform:
     - One wake word activation
     - One manual recording (10-30 seconds)
     - Verify AI response is received

4. Monitor throughout:
   - Browser memory usage (Chrome DevTools → Performance → Memory)
   - Node.js process memory
   - Python service memory (Whisper, Piper)
   - Database connections

5. Record metrics every hour:
   - Browser tab memory
   - Response latency
   - Any errors in console

**Pass Criteria:**
- No crashes or freezes
- Memory stays within 100MB of initial
- All transcriptions complete successfully
- All AI responses received

### Test 2: High-Frequency Interaction

**Objective:** Verify the system handles rapid consecutive requests.

**Procedure:**

1. Open the meeting page

2. Perform rapid recording cycles:
   - Start recording
   - Speak for 5 seconds
   - Stop recording
   - Wait for transcription
   - Repeat 50 times

3. Verify:
   - All 50 transcriptions complete
   - No audio buffer overflow
   - No skipped recordings

**Pass Criteria:**
- 100% transcription success rate
- No UI freezing
- No memory accumulation

---

## Memory Leak Detection

### Browser Memory Profiling

1. Open Chrome DevTools (F12)
2. Go to Memory tab
3. Take heap snapshot at start
4. Run the application for 1 hour with periodic interactions
5. Take another heap snapshot
6. Compare snapshots for retained objects

**Common Leak Patterns to Check:**
- Audio buffers not being released
- Event listeners not removed
- Insight cards accumulating without limit
- WebSocket/SSE connections not closed

### Node.js Memory Profiling

```bash
# Start with memory inspection
node --inspect node_modules/.bin/next dev

# Connect Chrome DevTools to node inspector
# Navigate to chrome://inspect
```

### Python Service Memory

Monitor Whisper and Piper services:

```bash
# Linux
watch -n 5 'ps aux | grep -E "(whisper|piper)" | grep -v grep'

# Windows PowerShell
while ($true) {
  Get-Process -Name python* | Select-Object Id, ProcessName, WorkingSet64
  Start-Sleep -Seconds 5
}
```

---

## Service Recovery Testing

### Test 1: Whisper Service Recovery

**Procedure:**

1. Start the application with all services running
2. Perform a successful transcription
3. Kill the Whisper service:
   ```bash
   # Find and kill the process
   pkill -f "whisper"
   # or on Windows: taskkill /IM python.exe /F
   ```
4. Attempt another transcription (should fail gracefully)
5. Restart Whisper service
6. Wait for automatic reconnection (30 seconds max)
7. Verify transcription works again

**Pass Criteria:**
- UI shows "Whisper Offline" status
- No application crash
- Automatic recovery within 30 seconds of service restart

### Test 2: Ollama Service Recovery

**Procedure:**

1. Start the application
2. Perform a successful AI chat
3. Stop Ollama: `ollama stop`
4. Attempt another chat (should fail gracefully)
5. Restart Ollama: `ollama serve`
6. Verify chat works again

**Pass Criteria:**
- Error displayed to user
- No application crash
- Recovery on service restart

### Test 3: Database Recovery

**Procedure:**

1. Start the application
2. Perform some operations (create meeting, save settings)
3. Stop PostgreSQL:
   ```bash
   docker compose stop postgres
   ```
4. Attempt database operations (should fail gracefully)
5. Restart PostgreSQL:
   ```bash
   docker compose start postgres
   ```
6. Verify operations resume

**Pass Criteria:**
- Application remains responsive
- Clear error messages
- Data integrity maintained after recovery

---

## Performance Benchmarks

### Benchmark 1: Transcription Latency

Measure time from recording stop to transcription complete:

```javascript
// Add to browser console
const start = performance.now();
// ... after transcription completes
console.log(`Transcription latency: ${performance.now() - start}ms`);
```

**Target:** < 2 seconds for 10-second audio

### Benchmark 2: AI Response Time

Measure time from request to first token:

```javascript
// Add to browser console before chat request
console.time('aiResponse');
// ... when first response token arrives
console.timeEnd('aiResponse');
```

**Target:** < 3 seconds to first token

### Benchmark 3: TTS Synthesis Time

Measure time from text input to audio playback:

**Target:** < 1 second for short phrases (< 20 words)

---

## Monitoring and Logging

### Enable Verbose Logging

Set environment variable:
```bash
DEBUG=true pnpm run dev
```

### Log Locations

| Service | Log Location |
|---------|--------------|
| Next.js | Console output |
| Whisper | `services/whisper/logs/` |
| Piper | `services/piper/logs/` |
| PostgreSQL | `docker logs postgres` |
| ChromaDB | `docker logs chromadb` |

### Metrics to Collect

1. **System Metrics:**
   - CPU usage per service
   - Memory usage per service
   - Network I/O

2. **Application Metrics:**
   - Requests per minute
   - Error rate
   - Response times

3. **Audio Metrics:**
   - Buffer underruns
   - Sample rate mismatches
   - Encoding failures

---

## Known Issues and Workarounds

### Issue: Audio Context Not Resuming

**Symptoms:** Recording doesn't start after page has been idle

**Workaround:**
- The AudioContext may suspend after inactivity
- Click anywhere on the page before recording
- The application attempts automatic resume on user interaction

### Issue: Wake Word False Positives

**Symptoms:** Wake word triggers without being spoken

**Workaround:**
- Increase sensitivity threshold in settings
- Use a less common wake word
- Ensure proper microphone positioning

### Issue: Memory Growth in Long Sessions

**Symptoms:** Browser tab memory increases over time

**Workaround:**
- Insight cards are limited to prevent unbounded growth
- Refresh the page every 4 hours for very long meetings
- Clear old transcription history periodically

### Issue: Ollama Model Unloading

**Symptoms:** First request after idle is slow

**Cause:** Ollama unloads models from memory after inactivity

**Workaround:**
- Configure Ollama keep-alive: `OLLAMA_KEEP_ALIVE=24h`
- The application pre-warms connections on startup

---

## Reporting Issues

When reporting reliability issues, include:

1. **Environment:**
   - OS and version
   - Browser and version
   - Node.js version
   - Docker version (if applicable)

2. **Steps to Reproduce:**
   - Exact sequence of actions
   - Duration of operation before issue

3. **Logs:**
   - Browser console output
   - Service logs
   - System resource usage at time of issue

4. **Screenshots/Videos:**
   - UI state when issue occurred
   - Error messages displayed

---

## Test Schedule Recommendation

| Test | Frequency | Duration |
|------|-----------|----------|
| Basic functionality | Before each deployment | 15 minutes |
| 1-hour stability | Weekly | 1 hour |
| 8-hour endurance | Monthly | 8 hours |
| Service recovery | After infrastructure changes | 30 minutes |
| Memory profiling | After code changes | 2 hours |
