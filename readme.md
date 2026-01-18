# Pipecat Voice Agent with Freeze Detection

A real-time voice AI agent built using the Pipecat framework.  
This project demonstrates turn-level latency tracking and detection of audio playback freezes during speech synthesis.

---

## Features

- Real-time voice conversation
  - STT: Deepgram
  - LLM: Google Gemini 2.5 Flash
  - TTS: Cartesia
- Turn latency measurement (user stops speaking → bot starts speaking)
- Audio freeze simulation via voice command
- Automatic freeze detection during audio playback
- Session dashboard for transcripts and performance metrics

---

## Architecture

### Backend

- Python
- FastAPI
- Pipecat
- PyAudio (local audio playback)

### Frontend

- Next.js
- Tailwind CSS

The backend runs the voice pipeline, tracks metrics, and logs sessions.  
The frontend displays session history, transcripts, latency, and freeze events.

---

## Freeze Detection

- The bot maintains an active state while generating or playing audio
- Each audio chunk updates a heartbeat timestamp
- If no audio is emitted for more than 3 seconds while active, a freeze event is detected and logged

Freeze simulation can be triggered by saying "check", which pauses audio playback mid-sentence.

---

## Session Logging

Each session is saved as a JSON file containing:

- Conversation transcript
- Turn latency per exchange
- Detected freeze events with timestamps

---

## Design Decisions

- Cartesia HTTP API is used instead of WebSockets for improved local stability
- Audio is played locally using PyAudio to simplify the demo and focus on pipeline behavior

---

## Setup and Running

### Prerequisites

- Python 3.10+
- Node.js 18+
- API keys for:
  - Deepgram
  - Google Gemini
  - Cartesia

---

### Backend Setup

```bash
git clone https://github.com/bhargav462/pipecat-freeze
cd bot
pip install -r requirements.txt

# Create a .env file and add API keys
python server.py
```

# Frontend Setup

```
cd ui
npm install
npm run dev
```

### Usage

- Open http://localhost:3000
- Click Start Bot
- Speak with the agent
- Say "check" to simulate an audio freeze
- Click Stop & Save to view session metrics
