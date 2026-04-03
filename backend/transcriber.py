import os
from faster_whisper import WhisperModel

_model = None


def load_model() -> None:
    global _model
    model_size = os.getenv("WHISPER_MODEL", "small")
    print(f"Loading Whisper model '{model_size}'...")
    # cpu + int8 is the recommended combo for CPU-only inference
    _model = WhisperModel(model_size, device="cpu", compute_type="int8")
    print("Whisper model loaded.")


def is_loaded() -> bool:
    return _model is not None


def transcribe(audio_path: str) -> dict:
    if _model is None:
        raise RuntimeError("Whisper model is not loaded.")
    segments, info = _model.transcribe(audio_path)
    text = " ".join(segment.text for segment in segments).strip()
    return {
        "text": text,
        "language": info.language,
    }
