import base64
import json
import os
from pathlib import Path

import anthropic

_client: anthropic.Anthropic | None = None
_glossary: list[dict] | None = None

GLOSSARY_PATH = Path(__file__).parent / "data" / "its_glossary.json"


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY environment variable is not set.")
        _client = anthropic.Anthropic(api_key=api_key)
    return _client


def _load_glossary() -> list[dict]:
    global _glossary
    if _glossary is None:
        with open(GLOSSARY_PATH, encoding="utf-8") as f:
            data = json.load(f)
        _glossary = data["entries"]
    return _glossary


def _build_compact_glossary() -> str:
    """Build a compact abbreviations reference for the prompt."""
    entries = _load_glossary()
    lines = []
    for e in entries:
        term = e["term"]
        expansion = e.get("expansion") or ""
        definition = e.get("definition") or ""
        # Keep definition brief
        brief = definition.split("(i.e.")[0].split("See also")[0].strip()
        if len(brief) > 120:
            brief = brief[:120] + "…"
        if expansion:
            lines.append(f"{term} [{expansion}]: {brief}")
        else:
            lines.append(f"{term}: {brief}")
    return "\n".join(lines)


def search_glossary(terms: list[str]) -> list[dict]:
    """Find glossary entries matching a list of terms (case-insensitive)."""
    entries = _load_glossary()
    results = []
    seen = set()
    for search in terms:
        s = search.strip().lower()
        for e in entries:
            key = (e["term"], e.get("expansion"))
            if key in seen:
                continue
            if e["term"].lower() == s or (e.get("expansion") or "").lower() == s:
                results.append(e)
                seen.add(key)
    return results


SYSTEM_PROMPT = """You are an expert in reading and translating historical German documents, \
specializing in WWII-era records, Nazi administrative paperwork, and historical German \
handwriting scripts including Kurrent, Sütterlin, and Kanzlei. You are also deeply familiar \
with the records of the International Tracing Service (ITS) and the terminology, abbreviations, \
and euphemisms used in Nazi Germany's bureaucratic documentation."""

ANALYSIS_PROMPT = """Please analyze this document image carefully.

This is likely a WWII-era German document (official record, camp document, transport list, \
identity card, etc.). Use the following ITS glossary of common abbreviations and terms as \
reference when you encounter abbreviations:

--- GLOSSARY (excerpt) ---
{glossary}
--- END GLOSSARY ---

Please provide your analysis as a JSON object with exactly these fields:
{{
  "transcription": "The verbatim text from the document, preserving abbreviations and original spelling",
  "translation": "Full English translation of the transcription",
  "document_type": "Your best guess at the document type (e.g. transport list, identity card, camp record, death certificate)",
  "identified_terms": [
    {{"term": "abbreviation or term as written", "meaning": "what it means", "context": "brief note on significance"}}
  ],
  "uncertain_readings": [
    {{"text": "word or phrase", "possible_readings": ["option1", "option2"], "reason": "why it's unclear"}}
  ],
  "notes": "Any additional observations about the document, its condition, date, provenance, etc.",
  "confidence": "high | medium | low"
}}

Return only valid JSON, no markdown code fences."""


def analyze_document(image_bytes: bytes, media_type: str) -> dict:
    client = _get_client()
    glossary_text = _build_compact_glossary()
    # Trim glossary to fit within reasonable token budget (~8000 chars)
    if len(glossary_text) > 8000:
        glossary_text = glossary_text[:8000] + "\n[... glossary continues ...]"

    prompt = ANALYSIS_PROMPT.format(glossary=glossary_text)

    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": base64.b64encode(image_bytes).decode(),
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
    )

    raw = message.content[0].text.strip()
    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    result = json.loads(raw)

    # Enrich identified_terms with full glossary entries
    found_term_names = [t.get("term", "") for t in result.get("identified_terms", [])]
    glossary_matches = search_glossary(found_term_names)
    result["glossary_entries"] = glossary_matches

    return result
