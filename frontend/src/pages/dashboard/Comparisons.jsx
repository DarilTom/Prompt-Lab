import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  getExecutions,
  compareAndRecommendExecutions,
} from "../../services/executionService";
import { useInstalledModels } from "../../hooks/useInstalledModels";

function formatDate(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDuration(nanoseconds) {
  if (!nanoseconds) return "—";

  const seconds = nanoseconds / 1_000_000_000;

  if (seconds < 1) {
    return `${Math.round(nanoseconds / 1_000_000)} ms`;
  }

  return `${seconds.toFixed(2)} s`;
}

function tokensPerSecond(execution) {
  if (!execution?.eval_count || !execution?.total_duration) {
    return "—";
  }

  const seconds = execution.total_duration / 1_000_000_000;

  if (seconds <= 0) {
    return "—";
  }

  return `${(execution.eval_count / seconds).toFixed(1)} tok/s`;
}

async function copyToClipboard(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textArea);
    return success;
  } catch (err) {
    console.error("Clipboard copy error:", err);
    return false;
  }
}

function ExecutionSelectCard({
  label,
  executions,
  selectedId,
  onChange,
  disabledId,
}) {
  const selectedExecution = executions.find(
    (execution) => String(execution.id) === String(selectedId)
  );

  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-subtle">
      <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
      </div>

      <select
        value={selectedId}
        onChange={(event) => onChange(event.target.value)}
        className="mt-3 w-full rounded-control border border-border bg-background px-3 py-3 font-mono text-xs outline-none focus:border-brand"
      >
        <option value="">Select an execution...</option>

        {executions.map((execution) => (
          <option
            key={execution.id}
            value={execution.id}
            disabled={String(execution.id) === String(disabledId)}
          >
            RUN-{String(execution.id).padStart(3, "0")}
            {" · "}
            {execution.prompt_title}
            {" · "}
            v{execution.version_number}
            {" · "}
            {execution.model}
          </option>
        ))}
      </select>

      {selectedExecution && (
        <div className="mt-4 space-y-1 text-xs text-muted">
          <p>
            <span className="font-semibold text-ink">Version:</span> v
            {selectedExecution.version_number}
          </p>

          <p>
            <span className="font-semibold text-ink">Model:</span>{" "}
            {selectedExecution.model}
          </p>

          <p>
            <span className="font-semibold text-ink">Executed:</span>{" "}
            {formatDate(selectedExecution.created_at)}
          </p>
        </div>
      )}
    </div>
  );
}

function ResponsePanel({ execution, label }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");

  const hasOutput = Boolean(
    execution?.output_text && execution.output_text.trim()
  );

  async function handleCopy(e) {
    e.stopPropagation();
    if (!hasOutput) return;

    const ok = await copyToClipboard(execution.output_text);
    if (ok) {
      setCopied(true);
      setCopyError("");
      setTimeout(() => setCopied(false), 2000);
    } else {
      setCopyError("Failed to copy response.");
      setTimeout(() => setCopyError(""), 3000);
    }
  }

  return (
    <div className="rounded-card border border-border bg-surface shadow-subtle">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              {label}
            </div>

            <h3 className="mt-1 font-serif text-2xl">
              RUN-{String(execution.id).padStart(3, "0")}
            </h3>
          </div>

          <span className="rounded-pill bg-success/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-success">
            {execution.status}
          </span>
        </div>

        <div className="mt-2 text-xs text-muted">
          v{execution.version_number} · {execution.model}
        </div>
      </div>

      <div className="p-5">
        <div className="mb-5">
          <div className="mb-2 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">
            Input
          </div>

          <div className="rounded-control border border-border bg-background p-4">
            <p className="whitespace-pre-wrap font-mono text-xs leading-6">
              {execution.input_text}
            </p>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">
              Response
            </span>

            {/* Copy Response Button */}
            {hasOutput && (
              <button
                type="button"
                onClick={handleCopy}
                title={copied ? "Response copied" : "Copy Response"}
                aria-label={
                  copied
                    ? "Response copied"
                    : `Copy response for ${label} (RUN-${String(execution.id).padStart(3, "0")})`
                }
                className={`inline-flex items-center gap-1.5 rounded-control border px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-brand ${
                  copied
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-border bg-surface text-muted hover:border-ink/20 hover:bg-neutral-100 hover:text-ink"
                }`}
              >
                {copied ? (
                  <>
                    <svg
                      className="h-3.5 w-3.5 text-emerald-600"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="font-semibold text-emerald-700">
                      Response copied
                    </span>
                  </>
                ) : (
                  <>
                    <svg
                      className="h-3.5 w-3.5 text-muted"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect
                        x="9"
                        y="9"
                        width="13"
                        height="13"
                        rx="2"
                        ry="2"
                      />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    <span>Copy Response</span>
                  </>
                )}
              </button>
            )}
          </div>

          {copyError && (
            <p className="mb-2 text-xs text-error">{copyError}</p>
          )}

          <div
            className={`rounded-control border border-border bg-background p-4 overflow-hidden transition-all ${
              expanded ? "" : "max-h-64"
            }`}
          >
            <p className="whitespace-pre-wrap text-sm leading-7">
              {execution.output_text ||
                execution.error_message ||
                "No response available."}
            </p>
          </div>

          {!expanded && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mt-2 text-xs font-medium text-muted hover:text-ink"
            >
              Show full response ↓
            </button>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Metric
            label="Duration"
            value={formatDuration(execution.total_duration)}
          />

          <Metric
            label="Input Tokens"
            value={execution.prompt_eval_count ?? "—"}
          />

          <Metric
            label="Output Tokens"
            value={execution.eval_count ?? "—"}
          />

          <Metric
            label="Output Speed"
            value={tokensPerSecond(execution)}
          />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-control border border-border p-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
        {label}
      </p>

      <p className="mt-1 font-mono text-xs font-semibold text-ink">{value}</p>
    </div>
  );
}

export default function Comparisons() {
  const navigate = useNavigate();

  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");

  // Copy Both state
  const [copiedBoth, setCopiedBoth] = useState(false);

  // AI Recommendation state
  const [analyzing, setAnalyzing] = useState(false);
  const [recommendation, setRecommendation] = useState(null);
  const [recommendationError, setRecommendationError] = useState("");
  const [userSelectedJudgeModel, setUserSelectedJudgeModel] = useState("");

  const { models: installedModels, loading: modelsLoading } =
    useInstalledModels();

  const defaultJudgeModel = useMemo(() => {
    if (!installedModels || installedModels.length === 0) return "";
    const names = installedModels.map((m) => m.name || m.model || "");
    return (
      names.find((n) => n.startsWith("gemma3:4b")) ||
      names.find((n) => n.startsWith("qwen3:4b")) ||
      names.find((n) => n.startsWith("llama3.2:1b")) ||
      names[0] ||
      ""
    );
  }, [installedModels]);

  const activeJudgeModel = userSelectedJudgeModel || defaultJudgeModel;

  // Reset recommendation whenever selection changes
  function handleSelectLeft(id) {
    setLeftId(id);
    setRecommendation(null);
    setRecommendationError("");
  }

  function handleSelectRight(id) {
    setRightId(id);
    setRecommendation(null);
    setRecommendationError("");
  }

  useEffect(() => {
    let cancelled = false;

    async function fetchExecutions() {
      try {
        setLoading(true);
        setError("");

        const data = await getExecutions();

        const completed = (Array.isArray(data) ? data : []).filter(
          (execution) => execution.status === "completed"
        );

        if (!cancelled) {
          setExecutions(completed);
          if (completed.length >= 2) {
            setLeftId(String(completed[1].id));
            setRightId(String(completed[0].id));
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.message || "Failed to load executions for comparison."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchExecutions();

    return () => {
      cancelled = true;
    };
  }, []);

  const leftExecution = useMemo(
    () =>
      executions.find(
        (execution) => String(execution.id) === String(leftId)
      ),
    [executions, leftId]
  );

  const rightExecution = useMemo(
    () =>
      executions.find(
        (execution) => String(execution.id) === String(rightId)
      ),
    [executions, rightId]
  );

  const hasBothOutputs = Boolean(
    leftExecution?.output_text?.trim() && rightExecution?.output_text?.trim()
  );

  async function handleCopyBoth() {
    if (!leftExecution || !rightExecution) return;

    const formatted = `=== Experiment A (RUN-${String(leftExecution.id).padStart(3, "0")} · ${leftExecution.prompt_title} v${leftExecution.version_number} · ${leftExecution.model}) ===\n${leftExecution.output_text}\n\n=== Experiment B (RUN-${String(rightExecution.id).padStart(3, "0")} · ${rightExecution.prompt_title} v${rightExecution.version_number} · ${rightExecution.model}) ===\n${rightExecution.output_text}`;

    const ok = await copyToClipboard(formatted);
    if (ok) {
      setCopiedBoth(true);
      setTimeout(() => setCopiedBoth(false), 2000);
    }
  }

  async function handleAnalyzeAndRecommend() {
    if (!leftExecution || !rightExecution || analyzing) return;

    try {
      setAnalyzing(true);
      setRecommendationError("");

      const result = await compareAndRecommendExecutions({
        execution_a_id: leftExecution.id,
        execution_b_id: rightExecution.id,
        judge_model: activeJudgeModel || undefined,
      });

      setRecommendation(result);
    } catch (err) {
      setRecommendationError(
        err.message || "Failed to analyze and recommend prompt comparison."
      );
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-4xl leading-tight">
              Compare Experiments
            </h1>

            <p className="mt-2 max-w-2xl text-muted">
              Compare two completed prompt executions side by side using their
              responses, measured metrics, and AI-assisted recommendations.
            </p>
          </div>

          <button
            onClick={() => navigate("/dashboard/executions")}
            className="rounded-control border border-border bg-surface px-4 py-2.5 text-sm font-semibold transition-colors hover:border-brand hover:text-brand"
          >
            Execution History
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-card border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-card border border-border bg-surface p-8 text-sm text-muted">
          Loading executions...
        </div>
      ) : executions.length < 2 ? (
        <div className="rounded-card border border-border bg-surface p-10 text-center shadow-subtle">
          <h2 className="font-serif text-3xl">Not enough executions</h2>

          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">
            Run at least two completed experiments before comparing responses.
          </p>

          <button
            onClick={() => navigate("/dashboard/prompts")}
            className="mt-6 rounded-control bg-brand px-5 py-2.5 text-sm font-semibold text-white"
          >
            Open Prompt Library
          </button>
        </div>
      ) : (
        <>
          {/* Selectors */}
          <section>
            <div className="mb-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                Choose experiments
              </p>

              <h2 className="mt-1 font-serif text-2xl text-ink">
                Select two completed runs to compare.
              </h2>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ExecutionSelectCard
                label="Experiment A"
                executions={executions}
                selectedId={leftId}
                onChange={handleSelectLeft}
                disabledId={rightId}
              />

              <ExecutionSelectCard
                label="Experiment B"
                executions={executions}
                selectedId={rightId}
                onChange={handleSelectRight}
                disabledId={leftId}
              />
            </div>
          </section>

          {/* AI-Assisted Recommendation Control Bar */}
          {leftExecution && rightExecution && (
            <section className="rounded-card border border-border bg-surface p-5 shadow-subtle">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4 text-brand"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-brand">
                      AI-Assisted Evaluation
                    </span>
                  </div>
                  <h3 className="mt-1 font-serif text-xl text-ink">
                    Evaluate &amp; Compare with AI
                  </h3>
                  <p className="mt-0.5 text-xs text-muted">
                    Assess response relevance, instruction adherence, factual
                    consistency, and clarity.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Judge Model Selector */}
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="judge-model-select"
                      className="font-mono text-[10px] uppercase tracking-wider text-muted hidden sm:inline"
                    >
                      Judge:
                    </label>
                    <select
                      id="judge-model-select"
                      value={activeJudgeModel}
                      onChange={(e) => setUserSelectedJudgeModel(e.target.value)}
                      disabled={analyzing || modelsLoading}
                      className="rounded-control border border-border bg-background px-3 py-2 font-mono text-xs text-ink outline-none transition-colors focus:border-brand disabled:opacity-60"
                      title="Select Ollama model to evaluate and compare responses"
                    >
                      {installedModels && installedModels.length > 0 ? (
                        installedModels.map((m) => {
                          const name = m.name || m.model || "";
                          return (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          );
                        })
                      ) : (
                        <option value="">
                          {modelsLoading
                            ? "Loading models..."
                            : "Default Ollama Model"}
                        </option>
                      )}
                    </select>
                  </div>

                  {/* Trigger Button */}
                  <button
                    type="button"
                    disabled={analyzing || !hasBothOutputs}
                    onClick={handleAnalyzeAndRecommend}
                    className="inline-flex items-center gap-2 rounded-control bg-brand px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {analyzing ? (
                      <>
                        <svg
                          className="h-3.5 w-3.5 animate-spin"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden="true"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        <span>Evaluating responses...</span>
                      </>
                    ) : (
                      <>
                        <svg
                          className="h-3.5 w-3.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        <span>Analyze &amp; Recommend</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Recommendation Error */}
              {recommendationError && (
                <div className="mt-4 flex items-center justify-between rounded-control border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Analysis Failed:</span>
                    <span>{recommendationError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRecommendationError("")}
                    className="text-xs font-semibold text-rose-700 hover:text-rose-900"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Recommendation Results Card */}
              {recommendation && (
                <div className="mt-6 border-t border-border pt-6">
                  {/* Outcome header */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                        Evaluation Verdict
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
                        {recommendation.recommendation === "too_close_to_call" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                            <span>⚖️</span>
                            <span>Too Close to Call</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                            <span>🏆</span>
                            <span>
                              Recommended: {recommendation.winner_label}
                            </span>
                          </span>
                        )}

                        <span className="font-mono text-[11px] text-muted">
                          Judge: {recommendation.judge_model}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Summary reasoning */}
                  {recommendation.reasoning && (
                    <div className="mt-4 rounded-control border border-border bg-background p-4 text-xs leading-6 text-ink">
                      <p className="font-semibold text-ink mb-1">
                        Analysis Summary:
                      </p>
                      <p className="text-muted">{recommendation.reasoning}</p>
                    </div>
                  )}

                  {/* Fairness & Reliability Disclosures */}
                  {recommendation.fairness?.disclosures?.length > 0 && (
                    <div className="mt-3.5 rounded-control border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
                      <div className="font-semibold mb-1">
                        Fairness &amp; Reliability Notes:
                      </div>
                      <div className="space-y-1 text-amber-800/90">
                        {recommendation.fairness.disclosures.map((disc, idx) => (
                          <p key={idx} className="flex items-start gap-1.5">
                            <span className="select-none text-amber-600 font-bold">
                              •
                            </span>
                            <span>{disc}</span>
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Strengths & Weaknesses Comparison Grid */}
                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    {/* Experiment A */}
                    <div className="rounded-control border border-border bg-background p-4 text-xs">
                      <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
                        <span className="font-serif text-sm font-semibold text-ink">
                          Experiment A (RUN-
                          {String(leftExecution.id).padStart(3, "0")})
                        </span>
                        <span className="font-mono text-[10px] text-muted">
                          v{leftExecution.version_number} ·{" "}
                          {leftExecution.model}
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-700 mb-1">
                            Key Strengths:
                          </p>
                          {recommendation.strengths_weaknesses?.execution_a
                            ?.strengths?.length > 0 ? (
                            <ul className="space-y-1 text-muted">
                              {recommendation.strengths_weaknesses.execution_a.strengths.map(
                                (s, i) => (
                                  <li
                                    key={i}
                                    className="flex items-start gap-1.5"
                                  >
                                    <span className="text-emerald-600">✓</span>
                                    <span>{s}</span>
                                  </li>
                                )
                              )}
                            </ul>
                          ) : (
                            <p className="text-muted italic">
                              None highlighted
                            </p>
                          )}
                        </div>

                        <div>
                          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-700 mb-1">
                            Weaknesses / Trade-offs:
                          </p>
                          {recommendation.strengths_weaknesses?.execution_a
                            ?.weaknesses?.length > 0 ? (
                            <ul className="space-y-1 text-muted">
                              {recommendation.strengths_weaknesses.execution_a.weaknesses.map(
                                (w, i) => (
                                  <li
                                    key={i}
                                    className="flex items-start gap-1.5"
                                  >
                                    <span className="text-amber-600">–</span>
                                    <span>{w}</span>
                                  </li>
                                )
                              )}
                            </ul>
                          ) : (
                            <p className="text-muted italic">
                              No major weaknesses identified
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Experiment B */}
                    <div className="rounded-control border border-border bg-background p-4 text-xs">
                      <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
                        <span className="font-serif text-sm font-semibold text-ink">
                          Experiment B (RUN-
                          {String(rightExecution.id).padStart(3, "0")})
                        </span>
                        <span className="font-mono text-[10px] text-muted">
                          v{rightExecution.version_number} ·{" "}
                          {rightExecution.model}
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-700 mb-1">
                            Key Strengths:
                          </p>
                          {recommendation.strengths_weaknesses?.execution_b
                            ?.strengths?.length > 0 ? (
                            <ul className="space-y-1 text-muted">
                              {recommendation.strengths_weaknesses.execution_b.strengths.map(
                                (s, i) => (
                                  <li
                                    key={i}
                                    className="flex items-start gap-1.5"
                                  >
                                    <span className="text-emerald-600">✓</span>
                                    <span>{s}</span>
                                  </li>
                                )
                              )}
                            </ul>
                          ) : (
                            <p className="text-muted italic">
                              None highlighted
                            </p>
                          )}
                        </div>

                        <div>
                          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-700 mb-1">
                            Weaknesses / Trade-offs:
                          </p>
                          {recommendation.strengths_weaknesses?.execution_b
                            ?.weaknesses?.length > 0 ? (
                            <ul className="space-y-1 text-muted">
                              {recommendation.strengths_weaknesses.execution_b.weaknesses.map(
                                (w, i) => (
                                  <li
                                    key={i}
                                    className="flex items-start gap-1.5"
                                  >
                                    <span className="text-amber-600">–</span>
                                    <span>{w}</span>
                                  </li>
                                )
                              )}
                            </ul>
                          ) : (
                            <p className="text-muted italic">
                              No major weaknesses identified
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Criteria Comparison Details */}
                  {recommendation.criteria_comparison &&
                    Object.keys(recommendation.criteria_comparison).length >
                      0 && (
                      <div className="mt-4 rounded-control border border-border bg-background p-3.5 text-xs">
                        <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">
                          Criteria Assessment:
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2 text-muted">
                          {Object.entries(
                            recommendation.criteria_comparison
                          ).map(([criterion, note]) => (
                            <div key={criterion}>
                              <span className="font-semibold text-ink capitalize">
                                {criterion.replace(/_/g, " ")}:
                              </span>{" "}
                              <span>{String(note)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Separate efficiency notice */}
                  <p className="mt-3.5 text-right font-mono text-[10px] text-muted/70">
                    * Evaluation is based on output quality, relevance, and
                    instructions. Efficiency metrics are listed below.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Comparison Side-by-Side Results */}
          {leftExecution && rightExecution ? (
            <section>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-serif text-3xl">Side-by-Side Results</h2>

                  <p className="mt-1 text-sm text-muted">
                    Compare the generated responses and execution performance.
                  </p>
                </div>

                {/* Copy Both Action */}
                {hasBothOutputs && (
                  <button
                    type="button"
                    onClick={handleCopyBoth}
                    title="Copy both experiment outputs to clipboard"
                    className={`inline-flex items-center gap-1.5 rounded-control border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-brand ${
                      copiedBoth
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-border bg-surface text-muted hover:border-ink/20 hover:bg-neutral-100 hover:text-ink"
                    }`}
                  >
                    {copiedBoth ? (
                      <>
                        <svg
                          className="h-3.5 w-3.5 text-emerald-600"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="font-semibold text-emerald-700">
                          Both copied!
                        </span>
                      </>
                    ) : (
                      <>
                        <svg
                          className="h-3.5 w-3.5 text-muted"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <rect
                            x="9"
                            y="9"
                            width="13"
                            height="13"
                            rx="2"
                            ry="2"
                          />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        <span>Copy Both</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <ResponsePanel
                  execution={leftExecution}
                  label="Experiment A"
                />

                <ResponsePanel
                  execution={rightExecution}
                  label="Experiment B"
                />
              </div>
            </section>
          ) : (
            <div className="rounded-card border border-border bg-surface p-8 text-center text-sm text-muted">
              Select two experiments to begin the comparison.
            </div>
          )}
        </>
      )}
    </div>
  );
}
