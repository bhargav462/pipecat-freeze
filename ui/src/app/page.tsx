"use client";
import { useState, useEffect } from "react";
import { Mic, Square, Play, RefreshCw, AlertTriangle } from "lucide-react";

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [sessions, setSessions] = useState<string[]>([]);
  const [status, setStatus] = useState("Ready");
  const [selectedSession, setSelectedSession] = useState<any>(null);

  const SERVER_URL = "http://localhost:8000";

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/sessions`);
      const data = await res.json();
      setSessions(data.sessions);
    } catch (e) {
      console.error("Failed to fetch sessions", e);
    }
  };

  const startSession = async () => {
    setStatus("Starting...");
    try {
      await fetch(`${SERVER_URL}/start`, { method: "POST" });
      setIsRecording(true);
      setStatus("Bot Listening...");
    } catch (e) {
      setStatus("Error Starting");
    }
  };

  const stopSession = async () => {
    setStatus("Stopping & Saving...");
    try {
      await fetch(`${SERVER_URL}/stop`, { method: "POST" });
      setIsRecording(false);
      setStatus("Saved");
      setTimeout(fetchSessions, 1000);
    } catch (e) {
      setStatus("Error Stopping");
    }
  };

  const analyzeSession = async (filename: string) => {
    try {
      const res = await fetch(`${SERVER_URL}/sessions/${filename}`);
      const data = await res.json();
      setSelectedSession(data);
    } catch (e) {
      console.error("Error fetching detail", e);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 font-sans flex gap-8">
      {/* LEFT PANEL: CONTROLS */}
      <div className="w-1/2 max-w-2xl mx-auto">
        <header className="mb-8 border-b border-gray-700 pb-4">
          <h1 className="text-3xl font-bold text-blue-400">
            Pipecat Voice Agent
          </h1>
          <p className="text-gray-400">
            Assignment: Freeze Detection & Latency
          </p>
        </header>

        <div className="bg-gray-800 p-6 rounded-xl shadow-lg mb-8 flex flex-col items-center">
          <div className="mb-4 text-xl font-semibold text-gray-300">
            Status:{" "}
            <span className={isRecording ? "text-green-400" : "text-gray-400"}>
              {status}
            </span>
          </div>
          <div className="flex gap-4">
            {!isRecording ? (
              <button
                onClick={startSession}
                className="flex items-center gap-2 px-8 py-4 bg-green-600 hover:bg-green-500 rounded-full text-xl font-bold transition-all shadow-lg hover:shadow-green-500/50"
              >
                <Mic size={24} /> Start Bot
              </button>
            ) : (
              <button
                onClick={stopSession}
                className="flex items-center gap-2 px-8 py-4 bg-red-600 hover:bg-red-500 rounded-full text-xl font-bold transition-all shadow-lg hover:shadow-red-500/50"
              >
                <Square size={24} /> Stop & Save
              </button>
            )}
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Recorded Sessions</h2>
            <button
              onClick={fetchSessions}
              className="p-2 hover:bg-gray-700 rounded-full"
            >
              <RefreshCw size={20} />
            </button>
          </div>
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session}
                className="p-4 bg-gray-700/50 rounded-lg flex justify-between items-center hover:bg-gray-700 transition"
              >
                <div className="font-mono text-blue-300 text-sm">{session}</div>
                <button
                  onClick={() => analyzeSession(session)}
                  className="px-3 py-1 bg-blue-600/80 hover:bg-blue-500 rounded text-sm font-medium flex items-center gap-2"
                >
                  <Play size={14} /> View
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: ANALYSIS VIEW */}
      {selectedSession && (
        <div className="w-1/2 bg-gray-800 p-6 rounded-xl shadow-lg overflow-y-auto h-[80vh]">
          <h2 className="text-xl font-bold mb-4 border-b border-gray-700 pb-2">
            Session Transcript
          </h2>
          <div className="space-y-4">
            {selectedSession.turns.map((turn: any, idx: number) => (
              <div
                key={idx}
                className={`flex flex-col ${
                  turn.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    turn.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-700 text-gray-200"
                  }`}
                >
                  {turn.is_freeze && (
                    <div className="bg-red-500/20 text-red-300 text-xs px-2 py-1 rounded mb-1 flex items-center gap-1 font-bold">
                      <AlertTriangle size={12} /> FREEZE DETECTED
                    </div>
                  )}
                  <p>{turn.text}</p>
                </div>
                {turn.latency_ms && (
                  <span className="text-xs text-gray-500 mt-1">
                    Latency: {turn.latency_ms}ms
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
