import base64
import json
import os
from pathlib import Path

import anthropic

_client: anthropic.Anthropic | None = None

CHART_PATH = Path(__file__).parent / "data" / "sutterlin_chart.png"

SYSTEM_PROMPT = """You are an expert in reading Sütterlin Script, the old German handwriting script \
that was widely used until the mid-20th century. You will be given a reference chart showing the \
exact Sütterlin letter forms and their standard Latin equivalents, and a document written in \
Sütterlin Script. Your task is to decode the document letter by letter using ONLY the provided \
reference chart — do not rely on any other knowledge of Sütterlin beyond what the chart shows."""

DECODE_PROMPT = """The first image is the official Sütterlin Script reference chart. It shows \
each Sütterlin letter form alongside its corresponding standard Latin letter:
- Rows 1–2: lowercase a through m
- Rows 3–4: lowercase n through z
- Rows 5–6: uppercase A through M
- Rows 7–8: uppercase N through Z

The second image is the document to decode.

Using ONLY the reference chart above, decode the Sütterlin Script in the document image \
letter by letter into standard German text.

Rules:
- Match each handwritten letter to its chart equivalent as closely as possible
- Preserve word spacing, punctuation, and line breaks
- If a letter is ambiguous between two options, pick the most likely one given context and note it
- Do NOT translate — output the decoded German text only, not an English translation
- For characters you cannot confidently identify, use [?]

Return a JSON object with exactly these fields:
{
  "decoded_text": "the full decoded German text, preserving line breaks with \\n",
  "uncertain_characters": [
    {"position": "word or approximate location", "options": ["letter1", "letter2"], "chosen": "letter1"}
  ],
  "notes": "any observations about the handwriting style, legibility, or special characters",
  "confidence": "high | medium | low"
}

Return only valid JSON, no markdown code fences."""


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY environment variable is not set.")
        _client = anthropic.Anthropic(api_key=api_key)
    return _client


def _load_chart_b64() -> str:
    with open(CHART_PATH, "rb") as f:
        return base64.b64encode(f.read()).decode()


def decode_sutterlin(image_bytes: bytes, media_type: str) -> dict:
    client = _get_client()
    chart_b64 = _load_chart_b64()
    doc_b64 = base64.b64encode(image_bytes).decode()

    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    # First: the reference chart
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": chart_b64,
                        },
                    },
                    # Second: the document to decode
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": doc_b64,
                        },
                    },
                    {"type": "text", "text": DECODE_PROMPT},
                ],
            }
        ],
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    return json.loads(raw)
