# Pipecat Voice Agent with Freeze Detection

This project implements a voice AI agent using the Pipecat framework, designed to demonstrate real-time interaction, latency tracking, and anomaly detection (freeze simulation).

The system consists of a Python backend (FastAPI + Pipecat) for the agent logic and a Next.js frontend for session management and analysis.

# 🚀 Features

Real-time Voice Conversation: Low-latency interaction using Deepgram (STT), Gemini 2.5 Flash (LLM), and Cartesia (TTS).

Latency Tracking: Measures and logs "Turn Latency" (User finish speaking -> Bot start speaking) for every turn.

Freeze Simulation & Detection:

Simulation: Triggered via voice command ("check"). The bot intentionally pauses audio playback mid-sentence for 5 seconds to mimic a network/process hang.

Detection: A background monitor watches the audio stream. If the bot is "active" but no audio data flows for >3 seconds, it flags the event as a freeze.

Session Dashboard: A Next.js UI to browse past sessions, view transcripts, and inspect performance metrics (latency, freeze events).

# 🛠️ Architecture

Tech Stack
Framework: Pipecat (Python)

STT: Deepgram

LLM: Google Gemini 2.5 Flash

TTS: Cartesia (Sonic English)

Backend API: FastAPI

Frontend: Next.js + Tailwind CSS

Audio Output: PyAudio (Local hardware streaming)

Implementation Details

1. The Voice Pipeline
   I structured the bot using Pipecat's pipeline paradigm. However, to support the specific requirements of "Freeze Simulation," I implemented a custom audio handler:

AudioSpeaker Class: Instead of using the standard Pipecat output transport, I built a custom audio engine using aiohttp and PyAudio. This gave me granular control to:

Inspect audio chunks in real-time.

Inject artificial delays (freezes) into the stream logic.

Monitor the "heartbeat" of the audio stream to detect anomalies.

2. Freeze Detection Logic
   The freeze detection runs as a concurrent background task (monitor_freeze). It operates on a simple heuristic:

Active State: The bot signals it is currently processing/playing audio.

Heartbeat: Every time an audio chunk is written to the speaker, a timestamp is updated.

Threshold: If Time.now - Last_Audio_Timestamp > 3.0 seconds while in an Active State, a Freeze Event is logged.

3. Session Logging
   All conversation turns, including their timestamps, calculated latencies, and any detected freeze events, are serialized to JSON files in the recordings/ directory. These are served by the FastAPI backend to the Next.js frontend.

🧪 Testing & Validation
I tested the solution primarily through manual interaction scenarios:

Latency Check: Verified that the "Latency" metric in the logs matched the perceived delay. Gemini 2.5 Flash consistently delivered <2s latency.

Freeze Scenario:

Trigger: I used the prompt "Simulate freeze" during a conversation.

Observation: The bot stopped speaking mid-sentence.

Validation: Confirmed the console output 🚨 [UI ALERT] FREEZE DETECTED appeared after exactly 3 seconds of silence, and the event was correctly tagged in the session JSON.

⚖️ Trade-offs & Decisions
HTTP vs. Websockets for TTS: The assignment suggested using Cartesia Websockets. During implementation, I encountered persistent handshake timeouts and instability with the standard websocket transport on my local network. To ensure a reliable and robust demo, I switched to Cartesia's HTTP/REST API with chunked transfer encoding. This proved to be stable and offered comparable latency for this use case.

Local Audio Transport: Since this is a local demo, I used PyAudio to play sound directly from the server device rather than streaming it to a browser client via WebRTC. This simplified the architecture while still fully proving the core logic of freeze detection.

🔮 Future Improvements
Database Integration: Move from JSON file storage to SQLite or PostgreSQL for better query capabilities.

Real-time UI Updates: Implement a WebSocket connection between the Python backend and Next.js frontend to show the "Freeze Alert" on the dashboard instantly as it happens, rather than only in post-session analysis.

📦 How to Run
Prerequisites
Python 3.10+

Node.js 18+

API Keys for: Deepgram, Google Gemini, Cartesia.

1. Setup Backend
   Bash

# Clone repo

git clone [<repo-url>](https://github.com/bhargav462/pipecat-freeze)
cd bot

# Install dependencies

pip install -r requirements.txt

# Create .env file

# Add your API keys to .env

# Start Server

python server.py

2. Setup Frontend
   Bash

cd ui
npm install
npm run dev

3. Usage
   Open http://localhost:3000.

Click Start Bot.

Speak to the agent.

Say "check" to test the freeze detection logic.

Click Stop & Save to view the transcript and metrics.
