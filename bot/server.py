import os
import subprocess
import json
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure recordings directory exists
os.makedirs("recordings", exist_ok=True)
app.mount("/recordings", StaticFiles(directory="recordings"), name="recordings")

bot_process = None

@app.post("/start")
def start_bot():
    global bot_process
    if bot_process is not None and bot_process.poll() is None:
        return {"status": "already_running", "pid": bot_process.pid}
    
    print("🚀 Spawning bot process...")
    bot_process = subprocess.Popen(["python", "bot.py"], cwd=os.getcwd())
    return {"status": "started", "pid": bot_process.pid}

@app.post("/stop")
def stop_bot():
    global bot_process
    if bot_process is None or bot_process.poll() is not None:
        return {"status": "not_running"}

    print(f"🛑 Stopping bot process {bot_process.pid}...")
    bot_process.terminate() # Sends SIGTERM, allowing bot.py to run cleanup
    
    try:
        bot_process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        print("⚠️ Bot stuck, forcing kill...")
        bot_process.kill()

    bot_process = None
    return {"status": "not_running"}

@app.get("/sessions")
def list_sessions():
    """Lists all JSON session files."""
    files = [f for f in os.listdir("recordings") if f.endswith(".json")]
    # Sort by creation time (newest first)
    files.sort(key=lambda x: os.path.getctime(os.path.join("recordings", x)), reverse=True)
    return {"sessions": files}

@app.get("/sessions/{filename}")
def get_session_data(filename: str):
    """Returns the full content of a specific session."""
    path = os.path.join("recordings", filename)
    if not os.path.exists(path):
        return JSONResponse(status_code=404, content={"error": "File not found"})
    
    with open(path, "r") as f:
        data = json.load(f)
    return data

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)