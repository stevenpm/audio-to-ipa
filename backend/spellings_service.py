import json
import os
import anthropic

_client: anthropic.Anthropic | None = None

LANGUAGES = [
    "English", "Spanish", "French", "German", "Italian", "Portuguese",
    "Dutch", "Russian", "Polish", "Greek", "Arabic", "Hebrew", "Hindi",
    "Japanese", "Korean", "Chinese (Mandarin)",
]


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY environment variable is not set.")
        _client = anthropic.Anthropic(api_key=api_key)
    return _client


def get_spelling_variants(ipa: str, transcript: str) -> list[dict]:
    """
    Given an IPA transcription and original text, return a list of likely
    spellings in various languages. Designed primarily for names.
    """
    client = _get_client()

    prompt = f"""You are a linguistics expert specializing in phonetics and cross-language name transliteration.

A user has recorded speech and it was transcribed to IPA (International Phonetic Alphabet).

Original text: "{transcript}"
IPA transcription: {ipa}

Your task: Generate the most likely spelling of this word/name in each of the following languages, as if a native speaker of that language were writing it phonetically using their own language's spelling conventions.

Languages: {", ".join(LANGUAGES)}

Rules:
- Focus on how the SOUNDS would be spelled in each language's writing system
- For names especially, consider how foreign names are adapted in that language/culture
- If the word is already a common word in that language, note that
- For languages with non-Latin scripts (Arabic, Hindi, Japanese, Korean, Chinese), provide both the native script AND a romanization in parentheses
- Keep notes brief (max 8 words)

Respond with a JSON array only, no other text. Each item must have exactly these fields:
- "language": the language name
- "spelling": the most likely spelling
- "notes": a brief note about the adaptation (or "standard spelling" if it's a common word)

Example format:
[
  {{"language": "Spanish", "spelling": "Yein", "notes": "adapts /dʒ/ sound as Y"}},
  {{"language": "German", "spelling": "Dscheyn", "notes": "Dsch represents /dʒ/ in German"}}
]"""

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()

    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    return json.loads(raw)


def get_spelling_alternatives(ipa: str, transcript: str, language: str) -> list[dict]:
    """
    Given an IPA transcription, original text, and a specific language,
    return multiple alternative spellings for that language ordered most to least common.
    """
    client = _get_client()

    prompt = f"""You are a linguistics expert specializing in phonetics and cross-language name transliteration.

Original text: "{transcript}"
IPA transcription: {ipa}
Target language: {language}

Your task: Generate ALL plausible alternative spellings of this word/name as it would be written in {language}, ordered from most common/popular to least common/rare.

Rules:
- The first spelling should be the most conventional or frequently seen spelling
- Include at least 3 spellings, up to 8 if genuinely plausible variants exist
- For languages with non-Latin scripts, provide the native script spelling
- Keep notes brief (max 8 words)
- Only include spellings a real person might actually use — no nonsense variants

Respond with a JSON array only, no other text. Each item must have exactly these fields:
- "spelling": the spelling variant
- "notes": very brief note on usage or frequency (e.g. "most common", "informal variant", "rare but valid")

Example:
[
  {{"spelling": "Jane", "notes": "most common spelling"}},
  {{"spelling": "Jayne", "notes": "popular variant"}},
  {{"spelling": "Jain", "notes": "rare variant"}}
]"""

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()

    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    return json.loads(raw)
