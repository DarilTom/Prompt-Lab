import os
import re
import requests
from django.conf import settings


OLLAMA_BASE_URL = getattr(
    settings,
    "OLLAMA_BASE_URL",
    os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
).rstrip("/")

OLLAMA_CHAT_URL = f"{OLLAMA_BASE_URL}/api/chat"
OLLAMA_TAGS_URL = f"{OLLAMA_BASE_URL}/api/tags"


def format_model_size(size_bytes):
    """
    Format bytes to human-readable size string (e.g. 3.3 GB).
    Matches Ollama's decimal-based display format.
    """
    if not isinstance(size_bytes, (int, float)) or size_bytes <= 0:
        return ""
    if size_bytes >= 1e9:
        return f"{size_bytes / 1e9:.1f} GB"
    if size_bytes >= 1e6:
        return f"{size_bytes / 1e6:.1f} MB"
    if size_bytes >= 1e3:
        return f"{size_bytes / 1e3:.1f} KB"
    return f"{int(size_bytes)} B"


def get_installed_models():
    """
    Queries local Ollama GET /api/tags to retrieve locally installed models.
    Returns a list of dicts with:
      - name: exact model name/tag
      - model: exact model name/tag
      - family: model family name
      - parameter_size: parameter count string (e.g. '4.3B')
      - size: integer size in bytes
      - size_formatted: human readable size string
      - modified_at: modification timestamp
      - digest: model digest
    """
    response = requests.get(OLLAMA_TAGS_URL, timeout=10)
    response.raise_for_status()

    data = response.json()
    raw_models = data.get("models", [])
    if not isinstance(raw_models, list):
        raw_models = []

    parsed_models = []
    for item in raw_models:
        if not isinstance(item, dict):
            continue
        name = item.get("name") or item.get("model") or ""
        if not name:
            continue
        details = item.get("details", {}) or {}
        raw_size = item.get("size")
        parsed_models.append(
            {
                "name": name,
                "model": name,
                "family": details.get("family", "") or "",
                "parameter_size": details.get("parameter_size", "") or "",
                "size": raw_size if isinstance(raw_size, (int, float)) else None,
                "size_formatted": format_model_size(raw_size),
                "modified_at": item.get("modified_at", "") or "",
                "digest": item.get("digest", "") or "",
            }
        )

    return parsed_models


def get_installed_model_names():
    """
    Returns a set of all valid names/tags for installed models.
    Normalizes ':latest' aliases so both 'model' and 'model:latest' match.
    """
    models = get_installed_models()
    names = set()
    for m in models:
        name = m.get("name", "")
        if name:
            names.add(name)
            if name.endswith(":latest"):
                names.add(name[:-7])
            else:
                names.add(f"{name}:latest")
    return names


def validate_model_installed(model_name):
    """
    Validates if model_name is installed in local Ollama.
    If Ollama is reachable and returns models, verifies model_name is in the list.
    If Ollama is unreachable or times out, allows the check to pass so execution
    can attempt the call and surface connection errors properly.
    """
    if not model_name or not str(model_name).strip():
        raise ValueError("model is required.")

    clean_name = str(model_name).strip()
    try:
        installed = get_installed_model_names()
        if installed and clean_name not in installed:
            return False, f"Model '{clean_name}' is not installed in local Ollama."
    except Exception:
        # If Ollama is not reachable or tags fails, defer to execution call
        pass

    return True, None


def compose_prompt(content, input_text):
    """
    Composes the prompt template content with user input text.
    If placeholder {{input}}, {input}, or [input] is present, replaces it;
    otherwise appends input_text to content.
    """
    content = (content or "").strip()
    input_text = (input_text or "").strip()

    if not content:
        return input_text

    if not input_text:
        return content

    placeholders = ["{{input}}", "{input}", "{{input_text}}", "{input_text}"]
    for ph in placeholders:
        if ph in content:
            return content.replace(ph, input_text)

    pattern = re.compile(r"\[input(?:\s+text)?\]", re.IGNORECASE)
    if pattern.search(content):
        return pattern.sub(input_text, content)

    return f"{content}\n\n{input_text}"


def run_ollama(
    model,
    user_prompt,
    system_prompt="",
    think=None,
):
    messages = []

    if system_prompt.strip():
        messages.append(
            {
                "role": "system",
                "content": system_prompt,
            }
        )

    messages.append(
        {
            "role": "user",
            "content": user_prompt,
        }
    )

    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
    }

    if think is not None:
        payload["think"] = think

    response = requests.post(
        OLLAMA_CHAT_URL,
        json=payload,
        timeout=300,
    )

    response.raise_for_status()

    return response.json()