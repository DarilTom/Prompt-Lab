import requests
from django.conf import settings


OLLAMA_CHAT_URL = "http://localhost:11434/api/chat"


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