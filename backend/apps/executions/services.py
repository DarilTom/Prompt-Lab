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

OLLAMA_REQUEST_TIMEOUT = getattr(
    settings,
    "OLLAMA_REQUEST_TIMEOUT",
    600,
)


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
    timeout=None,
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

    req_timeout = timeout if timeout is not None else OLLAMA_REQUEST_TIMEOUT

    response = requests.post(
        OLLAMA_CHAT_URL,
        json=payload,
        timeout=req_timeout,
    )

    response.raise_for_status()

    return response.json()


COMPARISON_JUDGE_SYSTEM_PROMPT = """You are an objective expert evaluator comparing two LLM prompt execution outputs.
Your task is to analyze the two actual responses and recommend which prompt/version performed better for the tested task.

Evaluation criteria:
1. Relevance: How well and directly the response addresses the user input.
2. Instruction Adherence: How accurately the response follows the specific prompt instructions and system instructions.
3. Factual Correctness & Consistency: Factual accuracy, avoidance of hallucinations, and logical consistency.
4. Clarity & Usefulness: Tone, readability, helpful structure, and practical utility.
5. Conciseness & Completeness: Thorough coverage of requirements without fluff, bloat, or unnecessary verbosity.

Decision rules:
- Do NOT base your recommendation on response length, token counts, or execution speed. Base it strictly on response quality, instruction adherence, and relevance.
- If one response is clearly superior, recommend that execution ("execution_a" or "execution_b").
- If both responses are of comparable quality, or if each has trade-offs that make them equally valid, you MUST explicitly decide "too_close_to_call".
- Be fair, balanced, and objective. Avoid making unsupported factual claims.

You MUST return ONLY valid JSON in this exact structure:
{
  "recommendation": "execution_a" | "execution_b" | "too_close_to_call",
  "winner_label": "Short label of winner or 'Too close to call'",
  "reasoning": "A concise explanation (2-3 sentences) summarizing why this recommendation was made.",
  "strengths_weaknesses": {
    "execution_a": {
      "strengths": ["string", "string"],
      "weaknesses": ["string", "string"]
    },
    "execution_b": {
      "strengths": ["string", "string"],
      "weaknesses": ["string", "string"]
    }
  },
  "criteria_comparison": {
    "relevance": "Comparison notes on relevance",
    "instruction_adherence": "Comparison notes on instruction adherence",
    "clarity_usefulness": "Comparison notes on clarity and usefulness",
    "conciseness_completeness": "Comparison notes on conciseness and completeness"
  }
}
Do not include markdown code fences or any text outside the JSON.
"""


def build_comparison_prompt(execution_a, execution_b):
    title_a = execution_a.prompt.title if execution_a.prompt else f"Run #{execution_a.id}"
    title_b = execution_b.prompt.title if execution_b.prompt else f"Run #{execution_b.id}"

    ver_a = (
        execution_a.prompt_version.version_number
        if execution_a.prompt_version
        else 1
    )
    ver_b = (
        execution_b.prompt_version.version_number
        if execution_b.prompt_version
        else 1
    )

    content_a = (
        execution_a.prompt_version.content
        if execution_a.prompt_version
        else ""
    )
    sys_a = (
        execution_a.prompt_version.system_prompt
        if execution_a.prompt_version
        else ""
    )

    content_b = (
        execution_b.prompt_version.content
        if execution_b.prompt_version
        else ""
    )
    sys_b = (
        execution_b.prompt_version.system_prompt
        if execution_b.prompt_version
        else ""
    )

    return f"""Compare the following two prompt execution responses:

=== EXECUTION A (RUN-{execution_a.id:03d}) ===
Prompt Title: {title_a} (v{ver_a})
Model: {execution_a.model}
System Prompt: {sys_a or "(None)"}
Prompt Template:
{content_a or "(None)"}

User Input:
{execution_a.input_text}

Generated Output:
{execution_a.output_text}

=== EXECUTION B (RUN-{execution_b.id:03d}) ===
Prompt Title: {title_b} (v{ver_b})
Model: {execution_b.model}
System Prompt: {sys_b or "(None)"}
Prompt Template:
{content_b or "(None)"}

User Input:
{execution_b.input_text}

Generated Output:
{execution_b.output_text}

Assess both responses thoroughly against the criteria and return the required JSON evaluation."""


def check_comparison_fairness(execution_a, execution_b):
    disclosures = []
    input_a = (execution_a.input_text or "").strip()
    input_b = (execution_b.input_text or "").strip()
    same_input = (input_a == input_b)

    if not same_input:
        disclosures.append(
            "Notice: The two runs used different inputs. Response differences may reflect differing user tasks rather than prompt quality alone."
        )

    same_model = (execution_a.model == execution_b.model)
    if not same_model:
        disclosures.append(
            f"Notice: The runs used different models ('{execution_a.model}' vs '{execution_b.model}'). Quality differences may arise from model capability differences as well as prompt wording."
        )

    disclosures.append(
        "Disclaimer: This is an AI-assisted recommendation. Quality judgments should be validated for your specific production use case."
    )

    return {
        "same_input": same_input,
        "same_model": same_model,
        "disclosures": disclosures,
    }


def compare_and_recommend(execution_a, execution_b, judge_model=None):
    from apps.evaluations.services import _extract_json

    if not judge_model:
        installed = get_installed_models()
        if installed:
            names = [m.get("name") for m in installed if m.get("name")]
            for pref in ["gemma3:4b", "llama3.2:1b", "qwen3:4b"]:
                if pref in names:
                    judge_model = pref
                    break
            if not judge_model and names:
                judge_model = names[0]
        if not judge_model:
            judge_model = "gemma3:4b"

    fairness = check_comparison_fairness(execution_a, execution_b)
    user_prompt = build_comparison_prompt(execution_a, execution_b)

    is_qwen = "qwen" in str(judge_model).lower()
    run_kwargs = {}
    if is_qwen:
        run_kwargs["think"] = False

    result = run_ollama(
        model=judge_model,
        user_prompt=user_prompt,
        system_prompt=COMPARISON_JUDGE_SYSTEM_PROMPT,
        **run_kwargs,
    )

    raw_content = result.get("message", {}).get("content", "").strip()
    if is_qwen and "</think>" in raw_content:
        raw_content = re.sub(
            r"^.*?</think>", "", raw_content, flags=re.DOTALL
        ).strip()

    data = _extract_json(raw_content)
    if not data or not isinstance(data, dict):
        rec = "too_close_to_call"
        lower_raw = raw_content.lower()
        if "execution_a" in lower_raw or "execution a" in lower_raw:
            rec = "execution_a"
        elif "execution_b" in lower_raw or "execution b" in lower_raw:
            rec = "execution_b"

        data = {
            "recommendation": rec,
            "winner_label": (
                f"Experiment A (RUN-{execution_a.id:03d})"
                if rec == "execution_a"
                else (
                    f"Experiment B (RUN-{execution_b.id:03d})"
                    if rec == "execution_b"
                    else "Too close to call"
                )
            ),
            "reasoning": (
                raw_content[:400]
                if raw_content
                else "Evaluator response could not be parsed as structured JSON."
            ),
            "strengths_weaknesses": {
                "execution_a": {"strengths": [], "weaknesses": []},
                "execution_b": {"strengths": [], "weaknesses": []},
            },
            "criteria_comparison": {},
        }

    recommendation = data.get("recommendation", "too_close_to_call")
    if recommendation not in ["execution_a", "execution_b", "too_close_to_call"]:
        if "a" in str(recommendation).lower():
            recommendation = "execution_a"
        elif "b" in str(recommendation).lower():
            recommendation = "execution_b"
        else:
            recommendation = "too_close_to_call"

    rec_exec = None
    if recommendation == "execution_a":
        rec_exec = execution_a
    elif recommendation == "execution_b":
        rec_exec = execution_b

    winner_label = data.get("winner_label")
    if not winner_label or str(winner_label).strip() == "":
        if rec_exec:
            ver_label = (
                f"v{rec_exec.prompt_version.version_number}"
                if rec_exec.prompt_version
                else ""
            )
            prefix = "Experiment A" if recommendation == "execution_a" else "Experiment B"
            winner_label = f"{prefix} (RUN-{rec_exec.id:03d} · {ver_label})"
        else:
            winner_label = "Too close to call"

    return {
        "recommendation": recommendation,
        "winner_label": winner_label,
        "recommended_execution_id": rec_exec.id if rec_exec else None,
        "recommended_prompt_id": (
            rec_exec.prompt_id if (rec_exec and rec_exec.prompt) else None
        ),
        "recommended_version_number": (
            rec_exec.prompt_version.version_number
            if (rec_exec and rec_exec.prompt_version)
            else None
        ),
        "recommended_prompt_title": (
            rec_exec.prompt.title if (rec_exec and rec_exec.prompt) else None
        ),
        "reasoning": data.get("reasoning", ""),
        "strengths_weaknesses": data.get(
            "strengths_weaknesses",
            {
                "execution_a": {"strengths": [], "weaknesses": []},
                "execution_b": {"strengths": [], "weaknesses": []},
            },
        ),
        "criteria_comparison": data.get("criteria_comparison", {}),
        "fairness": fairness,
        "judge_model": judge_model,
        "execution_a": {
            "id": execution_a.id,
            "prompt_title": (
                execution_a.prompt.title
                if execution_a.prompt
                else f"Run #{execution_a.id}"
            ),
            "version_number": (
                execution_a.prompt_version.version_number
                if execution_a.prompt_version
                else 1
            ),
            "model": execution_a.model,
        },
        "execution_b": {
            "id": execution_b.id,
            "prompt_title": (
                execution_b.prompt.title
                if execution_b.prompt
                else f"Run #{execution_b.id}"
            ),
            "version_number": (
                execution_b.prompt_version.version_number
                if execution_b.prompt_version
                else 1
            ),
            "model": execution_b.model,
        },
    }