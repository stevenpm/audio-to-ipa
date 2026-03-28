from phonemizer import phonemize

# Maps Whisper language codes → espeak-ng language codes
LANGUAGE_MAP: dict[str, dict[str, str]] = {
    "en": {"espeak": "en-us", "name": "English"},
    "fr": {"espeak": "fr-fr", "name": "French"},
    "de": {"espeak": "de", "name": "German"},
    "es": {"espeak": "es", "name": "Spanish"},
    "it": {"espeak": "it", "name": "Italian"},
    "pt": {"espeak": "pt", "name": "Portuguese"},
    "nl": {"espeak": "nl", "name": "Dutch"},
    "pl": {"espeak": "pl", "name": "Polish"},
    "ru": {"espeak": "ru", "name": "Russian"},
    "zh": {"espeak": "cmn", "name": "Chinese (Mandarin)"},
    "ja": {"espeak": "ja", "name": "Japanese"},
    "ko": {"espeak": "ko", "name": "Korean"},
    "ar": {"espeak": "ar", "name": "Arabic"},
    "hi": {"espeak": "hi", "name": "Hindi"},
    "tr": {"espeak": "tr", "name": "Turkish"},
    "sv": {"espeak": "sv", "name": "Swedish"},
    "da": {"espeak": "da", "name": "Danish"},
    "fi": {"espeak": "fi", "name": "Finnish"},
    "el": {"espeak": "el", "name": "Greek"},
    "cs": {"espeak": "cs", "name": "Czech"},
    "ro": {"espeak": "ro", "name": "Romanian"},
    "hu": {"espeak": "hu", "name": "Hungarian"},
    "uk": {"espeak": "uk", "name": "Ukrainian"},
    "vi": {"espeak": "vi", "name": "Vietnamese"},
    "id": {"espeak": "id", "name": "Indonesian"},
    "he": {"espeak": "he", "name": "Hebrew"},
    "fa": {"espeak": "fa", "name": "Persian"},
    "ca": {"espeak": "ca", "name": "Catalan"},
    "hr": {"espeak": "hr", "name": "Croatian"},
    "sk": {"espeak": "sk", "name": "Slovak"},
}


def get_language_name(whisper_code: str) -> str:
    return LANGUAGE_MAP.get(whisper_code, {}).get("name", whisper_code.upper())


def to_ipa(text: str, language: str) -> str:
    entry = LANGUAGE_MAP.get(language)
    if entry is None:
        # Fall back to English if the language isn't in the map
        espeak_code = "en-us"
    else:
        espeak_code = entry["espeak"]

    try:
        result = phonemize(
            text,
            backend="espeak",
            language=espeak_code,
            with_stress=True,
            preserve_punctuation=True,
            njobs=1,
        )
        return result.strip()
    except Exception as exc:
        raise RuntimeError(f"IPA conversion failed for language '{language}': {exc}") from exc


def supported_languages() -> list[dict]:
    return [
        {"code": code, "name": info["name"], "espeak_code": info["espeak"]}
        for code, info in LANGUAGE_MAP.items()
    ]
