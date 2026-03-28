# audio-to-ipa

Convert speech to **International Phonetic Alphabet (IPA)** — upload an audio file or record directly from your microphone.

![screenshot placeholder](docs/screenshot.png)

## Features

- Upload audio files (MP3, WAV, FLAC, M4A, OGG)
- Record live from the microphone
- Displays plain-text transcript alongside IPA transcription
- One-click copy for both transcript and IPA output
- Supports 30+ languages — language is auto-detected

## How It Works

1. Audio is sent to a FastAPI backend
2. [OpenAI Whisper](https://github.com/openai/whisper) transcribes the speech and detects the language
3. [phonemizer](https://github.com/bootphon/phonemizer) (via espeak-ng) converts the text to IPA
4. Results are displayed side by side in the browser

Everything runs locally — no API keys required.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 24+
- [Docker Compose](https://docs.docker.com/compose/) v2
- ~4 GB free disk space (Docker images + Whisper model cache)
- ~2 GB RAM

## Quick Start

```bash
git clone https://github.com/YOUR_USERNAME/audio-to-ipa.git
cd audio-to-ipa
docker compose up --build
```

Then open **http://localhost** in your browser.

> **First run:** The Whisper `small` model (~244 MB) is downloaded automatically on first startup. The frontend will wait until the backend is ready. This can take 1–5 minutes depending on your connection speed.

## Switching Whisper Models

Edit `docker-compose.yml` and change the `WHISPER_MODEL` environment variable:

| Model | Size | Speed | Accuracy |
|-------|------|-------|----------|
| `tiny` | 75 MB | Fastest | Lower |
| `base` | 140 MB | Fast | Good |
| `small` | 244 MB | Moderate | **Default** |
| `medium` | 1.5 GB | Slow | Better |
| `large-v3` | 2.9 GB | Slowest | Best |

## Supported Languages

30+ languages including English, French, German, Spanish, Italian, Portuguese, Dutch, Polish, Russian, Chinese (Mandarin), Japanese, Korean, Arabic, Hindi, Turkish, and more.

## Local Development (without Docker)

### Backend

```bash
# Install system dependencies (macOS)
brew install espeak-ng ffmpeg

# Install system dependencies (Ubuntu/Debian)
sudo apt-get install espeak-ng ffmpeg libsndfile1

cd backend
python -m venv .venv && source .venv/bin/activate
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** — the Vite dev server proxies `/api` to `http://localhost:8000`.

## Project Structure

```
audio-to-ipa/
├── backend/
│   ├── main.py                 # FastAPI app, endpoints
│   ├── transcriber.py          # Whisper model singleton
│   ├── phonemizer_service.py   # Text → IPA conversion
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── types.ts
│   │   └── components/
│   │       ├── FileUpload.tsx
│   │       ├── MicRecorder.tsx
│   │       └── IPADisplay.tsx
│   ├── nginx.conf
│   └── Dockerfile
└── docker-compose.yml
```

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/transcribe` | POST | Upload audio file, returns transcript + IPA |
| `/health` | GET | Liveness check |
| `/languages` | GET | List of supported languages |

### Example

```bash
curl -X POST http://localhost:8000/transcribe \
  -F "file=@speech.mp3"
```

```json
{
  "transcript": "Hello world",
  "ipa": "həlˈoʊ wˈɜːld",
  "language": "en",
  "language_name": "English"
}
```
