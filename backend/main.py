import os
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from pydub import AudioSegment

import phonemizer_service
import spellings_service
import transcriber

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".flac", ".m4a", ".ogg", ".webm"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    transcriber.load_model()
    yield


app = FastAPI(title="audio-to-ipa", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": transcriber.is_loaded()}


@app.get("/languages")
def languages():
    return {"languages": phonemizer_service.supported_languages()}


class SpellingsRequest(BaseModel):
    ipa: str
    transcript: str


@app.post("/spellings")
async def get_spellings(req: SpellingsRequest):
    if not req.ipa or not req.transcript:
        raise HTTPException(status_code=422, detail="ipa and transcript are required.")
    try:
        variants = spellings_service.get_spelling_variants(req.ipa, req.transcript)
        return {"variants": variants}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to generate spellings: {exc}")


@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported file format '{suffix}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    # Save upload to a temp file
    tmp_input = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp_wav = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    try:
        tmp_input.write(await file.read())
        tmp_input.flush()
        tmp_input.close()

        # Normalize to WAV for Whisper
        audio = AudioSegment.from_file(tmp_input.name)
        audio.export(tmp_wav.name, format="wav")
        tmp_wav.close()

        # Transcribe
        result = transcriber.transcribe(tmp_wav.name)
        text = result["text"]
        language = result["language"]

        if not text:
            raise HTTPException(status_code=422, detail="No speech detected in the audio.")

        # Convert to IPA
        try:
            ipa = phonemizer_service.to_ipa(text, language)
        except RuntimeError as exc:
            raise HTTPException(status_code=422, detail=str(exc))

        return {
            "transcript": text,
            "ipa": ipa,
            "language": language,
            "language_name": phonemizer_service.get_language_name(language),
        }
    finally:
        for path in (tmp_input.name, tmp_wav.name):
            try:
                os.unlink(path)
            except OSError:
                pass
