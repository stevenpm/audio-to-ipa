import os
import whisper

_model = None


def load_model() -> None:
    global _model
    model_size = os.getenv("WHISPER_MODEL", "small")
    print(f"Loading Whisper model '{model_size}'...")
    _model = whisper.load_model(model_size)
    print("Whisper model loaded.")


def is_loaded() -> bool:
    return _model is not None


def transcribe(audio_path: str) -> dict:
    if _model is None:
        raise RuntimeError("Whisper model is not loaded.")
    result = _model.transcribe(audio_path, fp16=False)
    return {
        "text": result["text"].strip(),
        "language": result.get("language", "en"),
    }
