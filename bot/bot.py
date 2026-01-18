import asyncio
import os
import signal
import time
import json
import aiohttp
import pyaudio
import google.generativeai as genai
from dotenv import load_dotenv

from pipecat.frames.frames import TextFrame, TranscriptionFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineTask, PipelineParams
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.transports.local.audio import LocalAudioTransport, LocalAudioTransportParams
from pipecat.processors.frame_processor import FrameProcessor
from pipecat.audio.vad.silero import SileroVADAnalyzer

load_dotenv()

# --- 1. SESSION LOGGER (Saves Data for UI) ---
class SessionLogger:
    def __init__(self):
        self.session_id = str(int(time.time()))
        os.makedirs("recordings", exist_ok=True)
        self.filename = f"recordings/session_{self.session_id}.json"
        
        self.data = {
            "session_id": self.session_id,
            "start_time": time.time(),
            "turns": []
        }
        print(f"📝 Logging session to {self.filename}", flush=True)

    def log_turn(self, role, text, latency=None, is_freeze=False):
        entry = {
            "role": role,
            "text": text,
            "timestamp": time.time(),
            "latency_ms": int(latency * 1000) if latency else None,
            "is_freeze": is_freeze
        }
        self.data["turns"].append(entry)
        self._save()

    def _save(self):
        with open(self.filename, "w") as f:
            json.dump(self.data, f, indent=2)

# --- 2. SHARED AUDIO ENGINE (Speaker + Freeze Logic) ---
class AudioSpeaker:
    def __init__(self):
        self.api_key = os.getenv("CARTESIA_API_KEY")
        self.voice_id = "79a125e8-cd45-4c13-8a67-188112f4dd22"
        self.url = "https://api.cartesia.ai/tts/bytes"
        self.headers = {"X-API-Key": self.api_key, "Cartesia-Version": "2024-06-10", "Content-Type": "application/json"}
        
        self.p = pyaudio.PyAudio()
        self.stream = self.p.open(format=pyaudio.paInt16, channels=1, rate=44100, output=True)
        
        self.is_active = False
        self.last_audio_time = 0
        self.should_freeze = False

        print("✅ Speaker initialized.", flush=True)

    async def speak(self, text, session):
        if not text: return
        
        self.is_active = True
        self.last_audio_time = time.time()
        print(f"🔊 Generating audio...", flush=True)
        
        payload = {
            "model_id": "sonic-english",
            "transcript": text,
            "voice": {"mode": "id", "id": self.voice_id},
            "output_format": {"container": "raw", "encoding": "pcm_s16le", "sample_rate": 44100}
        }

        try:
            async with session.post(self.url, headers=self.headers, json=payload) as resp:
                if resp.status == 200:
                    chunk_count = 0
                    async for chunk in resp.content.iter_chunked(4096):
                        if chunk:
                            self.stream.write(chunk)
                            self.last_audio_time = time.time() # Update heartbeat
                            chunk_count += 1
                            
                            # SIMULATE FREEZE logic
                            if self.should_freeze and chunk_count == 5:
                                print("\n❄️ SIMULATING FREEZE (5s pause)...\n", flush=True)
                                await asyncio.sleep(5) 
                                self.should_freeze = False
                                self.last_audio_time = time.time() # Reset heartbeat after freeze
        except Exception as e:
            print(f"❌ Connection Failed: {e}", flush=True)
        finally:
            self.is_active = False

    def cleanup(self):
        if self.stream: self.stream.stop_stream(); self.stream.close()
        self.p.terminate()

# --- 3. FREEZE MONITOR (Background Task) ---
async def monitor_freeze(speaker: AudioSpeaker):
    print("👀 Freeze Monitor Started...", flush=True)
    while True:
        await asyncio.sleep(0.5)
        if speaker.is_active:
            silence_duration = time.time() - speaker.last_audio_time
            # If silence > 3s while active, it's a freeze
            if silence_duration > 3.0:
                print(f"\n🚨 [UI ALERT] FREEZE DETECTED! ({silence_duration:.1f}s silence) 🚨\n", flush=True)

# --- 4. SPEAKING LLM (Logic + Logging) ---
class SpeakingGeminiLLM(FrameProcessor):
    def __init__(self, speaker: AudioSpeaker, session: aiohttp.ClientSession, logger: SessionLogger):
        super().__init__()
        self.speaker = speaker
        self.session = session
        self.logger = logger
        self.stt_end_time = 0
        
        try:
            genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
            self.model = genai.GenerativeModel("models/gemini-2.5-flash")
            self.chat = self.model.start_chat(history=[])
            print("✅ GEMINI 2.5 READY", flush=True)
        except Exception as e:
            print(f"❌ GEMINI ERROR: {e}", flush=True)

    async def process_frame(self, frame, direction):
        if isinstance(frame, TextFrame) or isinstance(frame, TranscriptionFrame):
            text = frame.text
            if text:
                print(f"\n🗣️ USER: '{text}'", flush=True)
                self.stt_end_time = time.time() # Start latency clock
                self.logger.log_turn("user", text)

                if "check" in text.lower():
                    self.speaker.should_freeze = True
                    self.logger.log_turn("system", "Freeze Triggered", is_freeze=True)

                try:
                    response = await self.chat.send_message_async(text)
                    if response.text:
                        # Calculate Latency
                        latency = time.time() - self.stt_end_time
                        print(f"🤖 BOT: '{response.text}' (Latency: {latency:.2f}s)", flush=True)
                        
                        self.logger.log_turn("bot", response.text, latency=latency)
                        await self.speaker.speak(response.text, self.session)
                except Exception as e:
                    print(f"❌ LLM ERROR: {e}", flush=True)
            return

        await super().process_frame(frame, direction)

async def main():
    print(f"BOT STARTED (Controlled by Server)", flush=True) 
    
    session_logger = SessionLogger()
    speaker = AudioSpeaker()
    
    async with aiohttp.ClientSession() as session:
        # Start Freeze Monitor
        monitor_task = asyncio.create_task(monitor_freeze(speaker))
        
        # Initial Greeting
        await speaker.speak("System ready", session)

        transport = LocalAudioTransport(
            params=LocalAudioTransportParams(
                audio_out_enabled=False, 
                audio_in_enabled=True,
                vad_enabled=True,
                vad_analyzer=SileroVADAnalyzer(),
                audio_in_sample_rate=16000, 
                audio_in_channels=1
            )
        )

        stt = DeepgramSTTService(api_key=os.getenv("DEEPGRAM_API_KEY"))
        llm = SpeakingGeminiLLM(speaker, session, session_logger)
        
        pipeline = Pipeline([transport.input(), stt, llm])
        task = PipelineTask(pipeline, params=PipelineParams(allow_interruptions=True))
        runner = PipelineRunner()

        # Graceful Shutdown Handling
        stop_event = asyncio.Event()
        def handle_signal(sig, frame):
            print("\n🛑 Stop signal received", flush=True)
            stop_event.set()
        
        signal.signal(signal.SIGINT, handle_signal)
        signal.signal(signal.SIGTERM, handle_signal)

        print("🔊 Bot Listening...", flush=True)
        runner_task = asyncio.create_task(runner.run(task))
        
        await stop_event.wait() 

        print("⏳ Shutting down...", flush=True)
        monitor_task.cancel()
        await transport.stop()
        await runner.cancel()
        speaker.cleanup()
        print("✅ Bot Stopped Cleanly.")

if __name__ == "__main__":
    try: asyncio.run(main())
    except KeyboardInterrupt: pass