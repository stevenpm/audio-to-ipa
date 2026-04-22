import os
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from pydub import AudioSegment

import document_analysis_service
import phonemizer_service
import spellings_service
import sutterlin_service
import transcriber

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".flac", ".m4a", ".ogg", ".webm"}
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
IMAGE_MEDIA_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    transcriber.load_model()
    yield


app = FastAPI(title="ScriptBridge", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost"],
    allow_methods=["*"],
    allow_headers=["*"],
)


CHART_PATH = Path(__file__).parent / "data" / "sutterlin_chart.png"


@app.get("/sutterlin-chart")
def get_sutterlin_chart():
    if not CHART_PATH.exists():
        raise HTTPException(status_code=404, detail="Chart image not found.")
    return FileResponse(CHART_PATH, media_type="image/png")


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": transcriber.is_loaded()}


@app.get("/languages")
def languages():
    return {"languages": phonemizer_service.supported_languages()}


class PhonemizeRequest(BaseModel):
    text: str
    language: str = "en"


@app.post("/phonemize")
async def phonemize_text(req: PhonemizeRequest):
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="text is required.")
    try:
        ipa = phonemizer_service.to_ipa(text, req.language)
    except RuntimeError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return {
        "transcript": text,
        "ipa": ipa,
        "language": req.language,
        "language_name": phonemizer_service.get_language_name(req.language),
    }


class SpellingsRequest(BaseModel):
    ipa: str
    transcript: str


class AlternativesRequest(BaseModel):
    ipa: str
    transcript: str
    language: str


@app.post("/spellings/alternatives")
async def get_alternatives(req: AlternativesRequest):
    if not req.ipa or not req.transcript or not req.language:
        raise HTTPException(status_code=422, detail="ipa, transcript, and language are required.")
    try:
        alternatives = spellings_service.get_spelling_alternatives(req.ipa, req.transcript, req.language)
        return {"alternatives": alternatives}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to generate alternatives: {exc}")


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


@app.post("/analyze-document")
async def analyze_document(file: UploadFile = File(...)):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported format '{suffix}'. Allowed: {', '.join(sorted(ALLOWED_IMAGE_EXTENSIONS))}",
        )
    media_type = IMAGE_MEDIA_TYPES[suffix]
    image_bytes = await file.read()
    if len(image_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status_code=422, detail="Image too large. Maximum 20 MB.")
    try:
        result = document_analysis_service.analyze_document(image_bytes, media_type)
        return result
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {exc}")


@app.post("/decode-sutterlin")
async def decode_sutterlin(file: UploadFile = File(...)):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported format '{suffix}'. Allowed: {', '.join(sorted(ALLOWED_IMAGE_EXTENSIONS))}",
        )
    media_type = IMAGE_MEDIA_TYPES[suffix]
    image_bytes = await file.read()
    if len(image_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status_code=422, detail="Image too large. Maximum 20 MB.")
    try:
        result = sutterlin_service.decode_sutterlin(image_bytes, media_type)
        return result
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Decoding failed: {exc}")
