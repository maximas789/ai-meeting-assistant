# API Reference

Complete documentation for all API endpoints in the AI Meeting Assistant.

## Base URL

```
http://localhost:3000/api
```

---

## Table of Contents

- [Chat](#chat)
- [Transcription](#transcription)
- [Text-to-Speech](#text-to-speech)
- [Documents](#documents)
- [Meetings](#meetings)
- [Settings](#settings)
- [Admin Authentication](#admin-authentication)
- [Diagnostics](#diagnostics)

---

## Chat

AI-powered chat with optional RAG (Retrieval-Augmented Generation).

### POST /api/chat

Send messages to the AI assistant and receive streaming responses.

**Request Body:**

```json
{
  "messages": [
    {
      "role": "user",
      "content": "What did we discuss in the last meeting?"
    }
  ],
  "useRAG": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `messages` | array | Yes | Array of message objects |
| `messages[].role` | string | Yes | `user`, `assistant`, or `system` |
| `messages[].content` | string | Yes | Message content (max 10,000 chars) |
| `useRAG` | boolean | No | Enable document context (default: `true`) |

**Response:** Server-Sent Events (SSE) stream

```
0:"Hello"
0:", I"
0:" can"
0:" help"
...
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 400 | Invalid JSON or request validation failed |

---

## Transcription

Speech-to-text using the Whisper service.

### POST /api/transcribe

Transcribe audio to text.

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `audio` | File | Yes | Audio file (WAV, MP3, WebM) |
| `language` | string | No | Language hint (e.g., `en`, `es`) |
| `task` | string | No | `transcribe` or `translate` |
| `detailed` | string | No | Set to `"true"` for word-level timestamps |

**Response:**

```json
{
  "text": "Hello, this is a test transcription.",
  "language": "en",
  "language_probability": 0.98,
  "duration": 3.5
}
```

**Detailed Response** (when `detailed=true`):

```json
{
  "text": "Hello, this is a test.",
  "language": "en",
  "duration": 3.5,
  "segments": [
    {
      "id": 0,
      "start": 0.0,
      "end": 1.5,
      "text": "Hello,",
      "words": [
        { "word": "Hello", "start": 0.0, "end": 0.5, "probability": 0.99 }
      ]
    }
  ]
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 400 | No audio file provided |
| 503 | Whisper service unavailable |

### GET /api/transcribe

Health check for the transcription service.

**Response:**

```json
{
  "status": "healthy",
  "service": "whisper",
  "model": "base",
  "device": "cpu"
}
```

---

## Text-to-Speech

Convert text to speech using the Piper TTS service.

### POST /api/speak

Synthesize speech from text.

**Request Body:**

```json
{
  "text": "Hello, how can I help you today?",
  "speed": "normal",
  "useConfiguredSpeed": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | Yes | Text to synthesize (max 5,000 chars) |
| `speed` | string | No | `slow`, `normal`, `fast`, `very_fast` |
| `useConfiguredSpeed` | boolean | No | Use admin-configured speed (default: `true`) |

**Response:** Binary WAV audio data

**Headers:**

| Header | Description |
|--------|-------------|
| `Content-Type` | `audio/wav` |
| `X-Audio-Duration` | Duration in seconds |
| `X-Sample-Rate` | Sample rate in Hz |

**Error Responses:**

| Status | Description |
|--------|-------------|
| 400 | No text provided or text too long |
| 503 | Piper service unavailable |

### GET /api/speak

Health check or list available voices.

**Query Parameters:**

| Parameter | Description |
|-----------|-------------|
| `action=voices` | List available voice models |

**Health Check Response:**

```json
{
  "status": "healthy",
  "service": "piper",
  "voice": "en_US-amy-medium",
  "sample_rate": 22050
}
```

**Voices Response:**

```json
{
  "current_voice": "en_US-amy-medium",
  "available_voices": [
    { "name": "en_US-amy-medium", "path": "/models/en_US-amy-medium.onnx" },
    { "name": "en_GB-alba-medium", "path": "/models/en_GB-alba-medium.onnx" }
  ],
  "sample_rate": 22050
}
```

---

## Documents

Document management and RAG queries.

### GET /api/documents

List all uploaded documents.

**Response:**

```json
[
  {
    "id": 1,
    "filename": "1704067200000_project_plan.pdf",
    "originalName": "project_plan.pdf",
    "mimeType": "application/pdf",
    "fileSize": 245760,
    "uploadedAt": "2024-01-01T00:00:00.000Z",
    "processedAt": "2024-01-01T00:00:05.000Z",
    "chunkCount": 12,
    "chromadbCollectionId": "documents"
  }
]
```

### POST /api/documents

Upload a new document.

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | Document file |

**Supported Types:**
- PDF (`application/pdf`)
- DOCX (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`)
- TXT (`text/plain`)
- Markdown (`text/markdown`)

**Max File Size:** 10MB

**Response:**

```json
{
  "id": 1,
  "filename": "1704067200000_document.pdf",
  "originalName": "document.pdf",
  "chunkCount": 8,
  "message": "Document uploaded and processed successfully"
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 400 | No file, unsupported type, or file too large |
| 503 | ChromaDB service unavailable |

### GET /api/documents/[id]

Get a specific document.

**Response:**

```json
{
  "id": 1,
  "filename": "1704067200000_document.pdf",
  "originalName": "document.pdf",
  "mimeType": "application/pdf",
  "fileSize": 245760,
  "uploadedAt": "2024-01-01T00:00:00.000Z",
  "processedAt": "2024-01-01T00:00:05.000Z",
  "chunkCount": 8,
  "chromadbCollectionId": "documents"
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 400 | Invalid document ID |
| 404 | Document not found |

### DELETE /api/documents/[id]

Delete a document.

**Response:**

```json
{
  "message": "Document deleted successfully",
  "id": 1
}
```

### POST /api/documents/query

Query documents using semantic search.

**Request Body:**

```json
{
  "query": "What are the project deadlines?",
  "nResults": 5,
  "includeContext": true,
  "generateAnswer": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | Search query (max 1,000 chars) |
| `nResults` | number | No | Number of results (1-20, default: 5) |
| `includeContext` | boolean | No | Include full context (default: `true`) |
| `generateAnswer` | boolean | No | Generate AI answer (default: `false`) |

**Response:**

```json
{
  "query": "What are the project deadlines?",
  "results": [
    {
      "text": "The project deadline is March 15th...",
      "source": "project_plan.pdf",
      "documentId": "1",
      "relevance": 0.89
    }
  ],
  "context": [
    {
      "text": "The project deadline is March 15th...",
      "source": "project_plan.pdf",
      "relevance": 0.89
    }
  ],
  "answer": "Based on the documents, the main project deadline is March 15th."
}
```

---

## Meetings

Meeting lifecycle management.

### GET /api/meetings

List all meetings.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Max results (default: 50) |
| `offset` | number | Pagination offset (default: 0) |
| `search` | string | Full-text search query |

**Response:**

```json
[
  {
    "id": 1,
    "title": "Weekly Standup",
    "startedAt": "2024-01-15T10:00:00.000Z",
    "endedAt": "2024-01-15T10:30:00.000Z",
    "transcript": "Meeting transcript...",
    "summary": "- Discussed project progress\n- Assigned tasks"
  }
]
```

### POST /api/meetings

Start a new meeting.

**Request Body:**

```json
{
  "title": "Project Planning Meeting"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | No | Meeting title (auto-generated if not provided) |

**Response:**

```json
{
  "id": 1,
  "title": "Project Planning Meeting",
  "startedAt": "2024-01-15T10:00:00.000Z",
  "endedAt": null,
  "transcript": null,
  "summary": null
}
```

### GET /api/meetings/[id]

Get a specific meeting.

**Response:**

```json
{
  "id": 1,
  "title": "Weekly Standup",
  "startedAt": "2024-01-15T10:00:00.000Z",
  "endedAt": "2024-01-15T10:30:00.000Z",
  "transcript": "Full meeting transcript...",
  "summary": "Meeting summary..."
}
```

### PATCH /api/meetings/[id]

Update a meeting (add transcript, end meeting).

**Request Body:**

```json
{
  "title": "Updated Title",
  "transcript": "Full transcript text",
  "appendTranscript": "New transcription to append",
  "endMeeting": true
}
```

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Update meeting title |
| `transcript` | string | Replace entire transcript |
| `appendTranscript` | string | Append to existing transcript |
| `endMeeting` | boolean | End meeting and generate summary |

**Response:**

```json
{
  "id": 1,
  "title": "Updated Title",
  "startedAt": "2024-01-15T10:00:00.000Z",
  "endedAt": "2024-01-15T10:30:00.000Z",
  "transcript": "Full transcript...",
  "summary": "AI-generated summary..."
}
```

### DELETE /api/meetings/[id]

Delete a meeting.

**Response:**

```json
{
  "success": true,
  "id": 1
}
```

---

## Settings

Admin settings management. Requires authentication.

### GET /api/settings

Get all settings.

**Headers:**
Requires admin session cookie.

**Response:**

```json
{
  "responseLength": "detailed",
  "voiceSpeed": "normal",
  "wakeWord": "hey assistant",
  "retentionDays": "90",
  "ttsEnabled": "true",
  "autoTranscribe": "true"
}
```

**Default Settings:**

| Key | Default | Options |
|-----|---------|---------|
| `responseLength` | `detailed` | `brief`, `detailed` |
| `voiceSpeed` | `normal` | `slow`, `normal`, `fast` |
| `wakeWord` | `hey assistant` | Any configured wake word |
| `retentionDays` | `90` | Number of days |
| `ttsEnabled` | `true` | `true`, `false` |
| `autoTranscribe` | `true` | `true`, `false` |

**Error Responses:**

| Status | Description |
|--------|-------------|
| 401 | Not authenticated |

### PUT /api/settings

Update settings.

**Headers:**
Requires admin session cookie.

**Request Body:**

```json
{
  "responseLength": "brief",
  "voiceSpeed": "fast"
}
```

**Response:**

```json
{
  "success": true
}
```

### DELETE /api/settings

Reset all settings to defaults.

**Response:**

```json
{
  "success": true,
  "defaults": {
    "responseLength": "detailed",
    "voiceSpeed": "normal",
    ...
  }
}
```

---

## Admin Authentication

PIN-based admin authentication.

### GET /api/admin

Check authentication status.

**Response:**

```json
{
  "authenticated": true,
  "timeRemaining": 1800000
}
```

| Field | Type | Description |
|-------|------|-------------|
| `authenticated` | boolean | Whether user is authenticated |
| `timeRemaining` | number | Milliseconds until session expires |

### POST /api/admin

Login with PIN.

**Request Body:**

```json
{
  "pin": "1234"
}
```

**Success Response:**

```json
{
  "success": true
}
```

**Error Response:**

```json
{
  "success": false,
  "error": "Invalid PIN"
}
```

| Status | Description |
|--------|-------------|
| 400 | PIN not provided |
| 401 | Invalid PIN |

### DELETE /api/admin

Logout (clear session).

**Response:**

```json
{
  "success": true
}
```

---

## Diagnostics

System health and configuration checks.

### GET /api/diagnostics

Get system diagnostics. No authentication required.

**Response:**

```json
{
  "timestamp": "2024-01-15T10:00:00.000Z",
  "env": {
    "POSTGRES_URL": true,
    "OLLAMA_BASE_URL": true,
    "OLLAMA_MODEL": true,
    "NEXT_PUBLIC_APP_URL": true
  },
  "database": {
    "connected": true,
    "schemaApplied": true
  },
  "ollama": {
    "configured": true,
    "reachable": true
  },
  "overallStatus": "ok"
}
```

| Field | Description |
|-------|-------------|
| `env` | Boolean flags for environment variables |
| `database.connected` | PostgreSQL connection status |
| `database.schemaApplied` | Whether migrations have run |
| `database.error` | Error message (if any) |
| `ollama.configured` | Ollama URL configured |
| `ollama.reachable` | Ollama API responding |
| `overallStatus` | `ok`, `warn`, or `error` |

### GET /api/test-ollama

Test Ollama connection and generation.

**Response:**

```json
{
  "success": true,
  "message": "Ollama is working correctly",
  "response": "Hello from Ollama!",
  "model": "llama3.2"
}
```

**Error Response:**

```json
{
  "success": false,
  "error": "Ollama not reachable",
  "hint": "Make sure Ollama is running with: ollama serve"
}
```

---

## Error Response Format

All endpoints return errors in a consistent format:

```json
{
  "error": "Error message",
  "details": "Additional information (optional)"
}
```

## Common HTTP Status Codes

| Status | Description |
|--------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (authentication required) |
| 404 | Not Found |
| 500 | Internal Server Error |
| 503 | Service Unavailable (external service down) |

---

## Rate Limiting

Currently, no rate limiting is implemented. For production deployments, consider adding rate limiting middleware.

## CORS

API endpoints are designed for same-origin requests from the Next.js frontend. For external access, configure CORS headers as needed.
