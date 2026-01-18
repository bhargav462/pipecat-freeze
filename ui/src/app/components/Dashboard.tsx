// ui/src/app/components/Dashboard.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import { Play, Pause, AlertCircle } from "lucide-react";

interface SessionEvent {
  event: string;
  time: number;
}

export default function Dashboard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sessions, setSessions] = useState<string[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [logs, setLogs] = useState<SessionEvent[]>([]);

  // 1. Fetch List of Recordings on Mount
  useEffect(() => {
    fetch("http://localhost:8765/recordings_list")
      .then((res) => res.json())
      .then((data) => setSessions(data))
      .catch((err) => console.error("Failed to fetch sessions:", err));
  }, []);

  // 2. Load Audio & Logs when a Session is selected
  useEffect(() => {
    if (!selectedSession || !containerRef.current) return;

    // Destroy previous instance
    if (wavesurfer.current) {
      wavesurfer.current.destroy();
    }

    // Initialize WaveSurfer
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#4f46e5",
      progressColor: "#818cf8",
      url: `http://localhost:8765/recordings/${selectedSession}.wav`,
      height: 128,
    });

    // Initialize Regions Plugin (for highlighting Freeze/Latency)
    const wsRegions = ws.registerPlugin(RegionsPlugin.create());

    // Load Logs
    fetch(`http://localhost:8765/recordings/${selectedSession}.json`)
      .then((res) => res.json())
      .then((events: SessionEvent[]) => {
        setLogs(events);
        visualizeEvents(events, wsRegions);
      });

    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("finish", () => setIsPlaying(false));

    wavesurfer.current = ws;

    return () => ws.destroy();
  }, [selectedSession]);

  // 3. Logic to visualize "Freeze" and Latency
  const visualizeEvents = (events: SessionEvent[], regions: any) => {
    let lastUserStop = 0;

    events.forEach((e, index) => {
      // Latency Calculation (Time between User Stop -> Bot Start)
      if (e.event === "USER_VAD_STOP") {
        lastUserStop = e.time;
      }
      if (e.event === "BOT_TTS_START" && lastUserStop > 0) {
        regions.addRegion({
          start: lastUserStop,
          end: e.time,
          color: "rgba(255, 255, 0, 0.3)", // Yellow for Latency
          content: "Latency",
          drag: false,
          resize: false,
        });
        lastUserStop = 0;
      }
    });

    // Detect Freeze (Naive approach: Look for long gaps > 3s where no event happened)
    // In a real app, the backend would log "FREEZE_START", but we are inferring it visually here.
    for (let i = 0; i < events.length - 1; i++) {
      const gap = events[i + 1].time - events[i].time;
      if (gap > 4.0) {
        // If gap > 4 seconds
        regions.addRegion({
          start: events[i].time,
          end: events[i + 1].time,
          color: "rgba(255, 0, 0, 0.5)", // RED for FREEZE
          content: "⚠️ SYSTEM FREEZE",
          drag: false,
          resize: false,
        });
      }
    }
  };

  const togglePlay = () => {
    wavesurfer.current?.playPause();
  };

  return (
    <div className="flex h-screen bg-gray-50 text-black">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 p-4">
        <h2 className="text-xl font-bold mb-4 text-black">Recordings</h2>
        <ul>
          {sessions.map((s) => (
            <li
              key={s}
              onClick={() => setSelectedSession(s)}
              className={`p-2 cursor-pointer rounded mb-2 ${
                selectedSession === s
                  ? "bg-indigo-100 text-indigo-700"
                  : "hover:bg-gray-100"
              }`}
            >
              {s}
            </li>
          ))}
        </ul>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        <h1 className="text-2xl font-bold mb-6 text-black">Session Analysis</h1>

        {selectedSession ? (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{selectedSession}</h3>
              <button
                onClick={togglePlay}
                className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700"
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>
            </div>

            {/* Waveform Container */}
            <div
              ref={containerRef}
              className="w-full border border-gray-200 rounded"
            />

            {/* Event Log Table */}
            <div className="mt-8">
              <h4 className="font-semibold mb-2">Event Logs</h4>
              <div className="bg-gray-100 p-4 rounded h-64 overflow-y-auto font-mono text-sm">
                {logs.map((log, i) => (
                  <div key={i} className="mb-1 border-b border-gray-200 pb-1">
                    <span className="text-gray-500">
                      [{log.time.toFixed(2)}s]
                    </span>
                    <span
                      className={`ml-2 font-bold ${
                        log.event.includes("FREEZE")
                          ? "text-red-600"
                          : "text-gray-800"
                      }`}
                    >
                      {log.event}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-400 border-2 border-dashed border-gray-300 rounded-lg">
            <div className="text-center">
              <AlertCircle className="mx-auto mb-2" />
              <p>Select a recording to analyze</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
