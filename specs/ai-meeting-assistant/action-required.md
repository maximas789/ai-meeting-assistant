# Action Required: AI Meeting Brainstorm Assistant

Manual steps that must be completed by a human. These cannot be automated.

## Before Implementation

### Hardware Setup
- [ ] **Set up ASUS Ascent GX10 server** - Required to run local AI models with sufficient RAM (128GB)
- [ ] **Connect ReSpeaker XVF3800 microphone** - USB audio device for 360-degree audio capture
- [ ] **Install ReSpeaker drivers** - May require Linux drivers from SeeedStudio wiki
- [ ] **Connect display via HDMI/USB-C** - For visual insight cards output
- [ ] **Connect speaker via 3.5mm** - For TTS voice output

### Software Dependencies
- [ ] **Install Ollama** - Download from https://ollama.ai and run installer
- [ ] **Pull llama3.3:70b model** - Run `ollama pull llama3.3:70b` (large download ~40GB)
- [ ] **Install PostgreSQL** - Local database server installation
- [ ] **Create PostgreSQL database** - Create `meeting_assistant` database and user
- [ ] **Install Python 3.10+** - Required for Whisper and Piper services
- [ ] **Install CUDA toolkit** - For GPU acceleration (if using NVIDIA GPU)
- [ ] **Install Docker** - For ChromaDB container (optional, can run native)

### API Keys & Accounts
- [ ] **Create Picovoice account** - Sign up at https://picovoice.ai for Porcupine wake word
- [ ] **Get Porcupine Access Key** - Free tier available, add to `.env` as `NEXT_PUBLIC_PORCUPINE_ACCESS_KEY`
- [ ] **Create custom wake word (optional)** - Use Picovoice Console to train "Hey Assistant" model

### Environment Configuration
- [ ] **Create `.env` file** - Copy from `.env.example` and fill in values
- [ ] **Set ADMIN_PIN** - Choose a secure 4-digit PIN for admin access
- [ ] **Configure POSTGRES_URL** - Database connection string with credentials

## During Implementation

### Phase 3: Whisper Service
- [ ] **Download Whisper model** - First run will download `large-v3` model (~3GB)
- [ ] **Verify GPU detection** - Ensure CUDA is detected for acceleration

### Phase 4: Wake Word
- [ ] **Download wake word model file** - Place `.ppn` file in `public/models/` directory
- [ ] **Test microphone permissions** - Browser will prompt for microphone access

### Phase 5: Piper TTS
- [ ] **Download Piper voice model** - Choose and download voice (e.g., `en_US-amy-medium`)
- [ ] **Place model in services/piper/models/** - TTS service needs model files

### Phase 6: ChromaDB
- [ ] **Start ChromaDB server** - Run `docker run -p 8003:8000 chromadb/chroma` or install natively

## After Implementation

### Testing & Verification
- [ ] **Test full audio pipeline** - Verify mic -> Whisper -> Ollama -> Piper flow
- [ ] **Verify wake word detection** - Test "Hey Assistant" activates system
- [ ] **Test barge-in functionality** - Verify interruption stops TTS playback
- [ ] **Test document upload** - Upload test PDF and verify RAG queries work
- [ ] **Run 8-hour stress test** - Verify system stability for full workday

### Production Deployment
- [ ] **Configure firewall rules** - Ensure all services can communicate locally
- [ ] **Set up service auto-start** - Configure services to start on boot
- [ ] **Configure backup schedule** - Back up PostgreSQL and ChromaDB data
- [ ] **Document local network setup** - Record IP addresses and ports used

### Security
- [ ] **Change default ADMIN_PIN** - Replace default `1234` with secure PIN
- [ ] **Review network isolation** - Ensure server is not exposed to internet
- [ ] **Set recording retention policy** - Configure how long to keep meeting data

---

> **Note:** These tasks are also listed in context within `implementation-plan.md`. Check off items here as you complete them to track manual setup progress.

## Quick Reference: Service URLs

After setup, services should be accessible at:

| Service | URL | Purpose |
|---------|-----|---------|
| Next.js App | http://localhost:3000 | Main application |
| Ollama | http://localhost:11434 | LLM inference |
| Whisper | http://localhost:8001 | Speech-to-text |
| Piper | http://localhost:8002 | Text-to-speech |
| ChromaDB | http://localhost:8003 | Vector database |
| PostgreSQL | localhost:5432 | Relational database |
