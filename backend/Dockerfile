FROM python:3.11-slim

# System dependencies:
# - espeak-ng: required by phonemizer for IPA conversion
# - ffmpeg: required by pydub for MP3/M4A/WebM decoding
# - libsndfile1: required by soundfile (faster-whisper dependency)
# - curl: used by docker-compose health check
RUN apt-get update && apt-get install -y --no-install-recommends \
    espeak-ng \
    ffmpeg \
    libsndfile1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# The Whisper model is downloaded on first startup and cached
# in the named volume at /root/.cache/huggingface
# See docker-compose.yml: whisper-cache:/root/.cache/huggingface

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
