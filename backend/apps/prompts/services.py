import json
import logging
import re
import requests

from apps.executions.services import run_ollama

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
  "improved_prompt": "The complete, ready-to-use improved prompt text",
  "explanation": "A concise explanation (2-3 short bullet points or sentences) detailing the key improvements made, such as role framing, constraints added, or format requirements."
}

Do NOT wrap the JSON in markdown code blocks. Output raw JSON only.
"""


def _extract_json(text):
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
    user_content = f"GOAL / TASK:\n{prompt_text.strip()}\n"

    if context and context.strip():
        user_content += f"\nADDITIONAL CONTEXT:\n{context.strip()}\n"

    if tone and tone.strip():
        user_content += f"\nDESIRED TONE:\n{tone.strip()}\n"

    if output_format and output_format.strip():
        user_content += f"\nDESIRED OUTPUT FORMAT:\n{output_format.strip()}\n"

    user_content += "\nPlease generate an improved, production-ready version of this prompt."

    try:
        raw_result = run_ollama(
            model=model,
            user_prompt=user_content,
            system_prompt=IMPROVER_SYSTEM_PROMPT,
        )
    except requests.exceptions.ConnectionError:
        raise ConnectionError(
            "Unable to connect to Ollama at http://localhost:11434. "
            "Please ensure the Ollama service is running locally."
        )
    except requests.exceptions.Timeout:
        raise TimeoutError(
            f"Ollama took too long to respond while improving the prompt with model '{model}'. "
            "Please try again."
        )
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Ollama request failed: {str(e)}")

    message_content = raw_result.get("message", {}).get("content", "").strip()

    parsed = _extract_json(message_content)

    if parsed and isinstance(parsed, dict) and "improved_prompt" in parsed:
        improved_prompt = parsed.get("improved_prompt", "").strip()
        explanation = parsed.get("explanation", "").strip()
        if not explanation:
            explanation = "Structured the prompt with clearer instructions, role framing, and constraints."
        return {
            "improved_prompt": improved_prompt,
            "explanation": explanation,
            "model": model,
        }

    # Fallback if model didn't follow JSON format:
    cleaned_content = re.sub(r"^```[a-z]*\n?", "", message_content)
    cleaned_content = re.sub(r"\n?```$", "", cleaned_content).strip()

    return {
        "improved_prompt": cleaned_content or prompt_text,
        "explanation": "Refined the prompt for improved clarity and specificity.",
        "model": model,
    }
