import json
import logging
import re
import requests

from apps.executions.services import get_ollama_base_url, run_ollama

logger = logging.getLogger(__name__)

IMPROVER_SYSTEM_PROMPT = """You are an expert prompt engineer. Your job is to transform rough user goals or task descriptions into clear, structured, and highly effective prompts.

Apply these prompt engineering principles:
1. Clearly specify the persona or role for the AI.
2. Formulate explicit, actionable task instructions.
3. Incorporate any supplied context, desired tone, and output format.
4. Add clear constraints, guardrails, and structure (e.g. sections, bullet points, or placeholders like [Input Text] if relevant).
5. Remove ambiguity and avoid vague phrasing.

You MUST respond with valid JSON in this exact structure:
{
  "improved_prompt": "The complete, ready-to-use improved prompt text as a single string",
  "explanation": "A concise explanation as a string (2-3 short bullet points or sentences) detailing the key improvements made, such as role framing, constraints added, or format requirements."
}

Do NOT wrap the JSON in markdown code blocks. Output raw JSON only.
"""


class InvalidModelOutputError(ValueError):
    """Raised when the model returns an invalid, unparseable, or truncated response."""
    pass


def _extract_json(text):
    if not isinstance(text, str):
        return None
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    return None


def _format_prompt_text(value, default=""):
    """
    Safely converts a prompt value (which may be a string, a list of paragraphs,
    or other types from LLM output) into a clean string.
    """
    if value is None:
        return default
    if isinstance(value, str):
        cleaned = value.strip()
        return cleaned if cleaned else default
    if isinstance(value, (list, tuple)):
        items = [str(item).strip() for item in value if item is not None and str(item).strip()]
        return "\n\n".join(items) if items else default
    cleaned = str(value).strip()
    return cleaned if cleaned else default


def _format_explanation(value, default=""):
    """
    Safely converts an explanation (which may be a string, a list of bullet points,
    or a dictionary from LLM output) into a clean string formatted with bullet points.
    """
    if value is None:
        return default
    if isinstance(value, str):
        cleaned = value.strip()
        return cleaned if cleaned else default
    if isinstance(value, (list, tuple)):
        items = [str(item).strip() for item in value if item is not None and str(item).strip()]
        if not items:
            return default
        formatted = []
        for item in items:
            if item.startswith(("-", "*", "•", "–")) or re.match(r"^\d+[\.\)]", item):
                formatted.append(item)
            else:
                formatted.append(f"• {item}")
        return "\n".join(formatted)
    if isinstance(value, dict):
        items = [f"• {k}: {v}" for k, v in value.items() if v]
        return "\n".join(items) if items else default
    cleaned = str(value).strip()
    return cleaned if cleaned else default


def _clean_input_field(value, default="", join_delimiter="\n"):
    """
    Safely converts an input field into a clean string.
    If it is a list/tuple, joins non-empty items with join_delimiter.
    """
    if value is None:
        return default
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (list, tuple)):
        items = [str(item).strip() for item in value if item is not None and str(item).strip()]
        return join_delimiter.join(items) if items else default
    cleaned = str(value).strip()
    return cleaned if cleaned else default


def generate_improved_prompt(
    *,
    prompt_text,
    context="",
    tone="",
    output_format="",
    model="gemma3:4b",
):
    """
    Calls Ollama to improve a prompt based on user goals, optional context,
    tone, and desired output format.
    """
    clean_prompt = _clean_input_field(prompt_text)
    clean_context = _clean_input_field(context)
    clean_tone = _clean_input_field(tone, join_delimiter=", ")
    clean_output_format = _clean_input_field(output_format, join_delimiter=", ")
    clean_model = str(model).strip() if model else "gemma3:4b"

    user_content = f"GOAL / TASK:\n{clean_prompt}\n"

    if clean_context:
        user_content += f"\nADDITIONAL CONTEXT:\n{clean_context}\n"

    if clean_tone:
        user_content += f"\nDESIRED TONE:\n{clean_tone}\n"

    if clean_output_format:
        user_content += f"\nDESIRED OUTPUT FORMAT:\n{clean_output_format}\n"

    user_content += "\nPlease generate an improved, production-ready version of this prompt."

    improver_options = {
        "num_predict": 512,
        "temperature": 0.2,
    }
    run_kwargs = {
        "options": improver_options,
        "format": "json",
    }
    if "qwen" in clean_model.lower():
        run_kwargs["think"] = False

    try:
        raw_result = run_ollama(
            model=clean_model,
            user_prompt=user_content,
            system_prompt=IMPROVER_SYSTEM_PROMPT,
            **run_kwargs,
        )
    except requests.exceptions.ConnectionError:
        base_url = get_ollama_base_url()
        raise ConnectionError(
            f"Unable to connect to Ollama at {base_url}. "
            "Please ensure the Ollama service is reachable."
        )
    except requests.exceptions.Timeout:
        raise TimeoutError(
            f"Ollama took too long to respond while improving the prompt with model '{clean_model}'. "
            "Please try again."
        )
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Ollama request failed: {str(e)}")

    message_content = raw_result.get("message", {}).get("content", "")
    if isinstance(message_content, list):
        message_content = "\n".join(str(m) for m in message_content)
    elif not isinstance(message_content, str):
        message_content = str(message_content) if message_content else ""
    message_content = message_content.strip()

    # Strip any <think>...</think> reasoning blocks if present
    cleaned_message = re.sub(r"<think>.*?</think>", "", message_content, flags=re.DOTALL).strip()
    cleaned_message = re.sub(r"</?think>", "", cleaned_message).strip()

    parsed = _extract_json(cleaned_message) or _extract_json(message_content)

    if parsed:
        if isinstance(parsed, list) and len(parsed) > 0 and isinstance(parsed[0], dict):
            parsed = parsed[0]

        if isinstance(parsed, dict) and "improved_prompt" in parsed:
            improved_prompt = _format_prompt_text(parsed.get("improved_prompt"))
            explanation = _format_explanation(
                parsed.get("explanation"),
                default="Structured the prompt with clearer instructions, role framing, and constraints.",
            )
            if improved_prompt:
                return {
                    "improved_prompt": improved_prompt,
                    "explanation": explanation,
                    "model": clean_model,
                }

    raise InvalidModelOutputError(
        "Model returned invalid or truncated response. Could not extract improved prompt."
    )
