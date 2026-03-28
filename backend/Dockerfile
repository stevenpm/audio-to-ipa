FROM python:3.11-slim

# System dependencies:
# - espeak-ng: required by phonemizer for IPA conversion
# - ffmpeg: required by pydub for MP3/M4A/WebM decoding
# - libsndfile1: required by soundfile (whisper dependency)
# - curl: used by docker-compose health check
RUN apt-get update && apt-get install -y --no-install-recommends \
    espeak-ng \
    ffmpeg \
    libsndfile1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Upgrade pip and install setuptools (required by openai-whisper's build system)
RUN pip install --no-cache-dir --upgrade pip setuptools

# Install CPU-only PyTorch first (separate layer for caching — ~800MB vs ~2GB GPU wheel)
RUN pip install --no-cache-dir \
    torch==2.5.1 \
    --index-url https://download.pytorch.org/whl/cpu

# Install openai-whisper separately with --no-build-isolation so it can access
# the globally installed setuptools/pkg_resources during its legacy setup.py build
RUN pip install --no-cache-dir --no-build-isolation openai-whisper==20240930

# Install remaining Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Whisper model is NOT baked into the image.
# It is downloaded on first startup and cached in the named volume at /root/.cache/whisper
# See docker-compose.yml: whisper-cache:/root/.cache/whisper

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
