import re
import requests
from django.conf import settings


OLLAMA_CHAT_URL = "http://localhost:11434/api/chat"


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

    response = requests.post(
        OLLAMA_CHAT_URL,
        json=payload,
        timeout=300,
    )

    response.raise_for_status()

    return response.json()