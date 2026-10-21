import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getEvaluationRun } from "../../services/evaluationService";

function formatDuration(nanoseconds) {
  if (nanoseconds === null || nanoseconds === undefined) {
    return "—";
  }

  const seconds = Number(nanoseconds) / 1_000_000_000;

  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;

  return `${minutes}m ${remaining.toFixed(1)}s`;
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function scoreClasses(score) {
  if (score === null || score === undefined) {
    return "text-muted";
  }

  const numeric = Number(score);

  if (Number.isNaN(numeric)) {
    return "text-muted";
  }

  if (numeric >= 80) return "text-success";
  if (numeric >= 60) return "text-brand";
  if (numeric >= 40) return "text-warning";
  return "text-error";
}

function statusClasses(status) {
  switch (status) {
    case "completed":
      return "bg-success/10 text-success";
    case "running":
      return "bg-brand/10 text-brand";
    case "failed":
      return "bg-error/10 text-error";
    default:
      return "bg-border text-muted";
  }
}

function capitalizeLabel(value) {
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function EvaluationResult() {
  const { id } = useParams();

  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadRun() {
      try {
        setLoading(true);
        setError("");

        const data = await getEvaluationRun(id);
        setRun(data);
      } catch (err) {
        console.error(err);
        setError(err.message || "Unable to load evaluation run.");
      } finally {
        setLoading(false);
      }
    }

    loadRun();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-border border-t-brand" />
          <p className="mt-4 text-sm text-muted">
            Loading evaluation run...
          </p>
        </div>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="space-y-6 pb-12 max-w-4xl">
        <Link
          to="/dashboard/evaluations"
          className="inline-flex items-center gap-2 text-xs font-medium text-muted hover:text-ink"
        >
          ← Back to evaluations
        </Link>

        <div className="rounded-xl border border-error/20 bg-error/5 p-6 text-sm text-error">
          <p className="font-semibold">Unable to load evaluation run</p>
          <p className="mt-1">{error || "Run not found."}</p>
        </div>
      </div>
    );
  }

  const passRate =
    run.total_cases > 0
      ? ((Number(run.passed_cases) / Number(run.total_cases)) * 100).toFixed(0)
      : "0";

  return (
    <div className="space-y-8 pb-12 max-w-5xl">
      {/* Back button */}
      <Link
        to="/dashboard/evaluations"
        className="inline-flex items-center gap-2 text-xs font-medium text-muted hover:text-ink"
      >
        <svg
          width="14"
          height="14"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1.75"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 18l-6-6 6-6"
          />
        </svg>
        Back to evaluations
      </Link>

      {/* Header & Concise Overview */}
      <section className="rounded-xl border border-border bg-surface p-6 shadow-subtle">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brand">
              Evaluation result
            </p>

            <h1 className="mt-1 font-serif text-3xl sm:text-4xl tracking-tight text-ink">
              Run #{run.id}
            </h1>

            <p className="mt-1.5 text-sm text-muted">
              {run.prompt_title} · <span className="font-mono">v{run.version_number}</span>
            </p>

            <p className="mt-0.5 text-xs text-muted">
              Dataset: {run.dataset_name} · Model: {run.model}
            </p>
          </div>

          <span
            className={`w-fit rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${statusClasses(
              run.status
            )}`}
          >
            {run.status}
          </span>
        </div>

        {/* Primary Metrics Grid */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted font-mono">
              Overall score
            </p>
            <p
              className={`mt-2 font-mono text-3xl font-semibold ${scoreClasses(
                run.overall_score
              )}`}
            >
              {run.overall_score ?? "—"}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted font-mono">
              Test cases
            </p>
            <p className="mt-2 font-mono text-3xl font-semibold text-ink">
              {run.total_cases}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted font-mono">
              Passed cases
            </p>
            <p className="mt-2 font-mono text-3xl font-semibold text-success">
              {run.passed_cases}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted font-mono">
              Failed cases
            </p>
            <p className="mt-2 font-mono text-3xl font-semibold text-error">
              {run.failed_cases}
            </p>
          </div>
        </div>

        {/* Concise Plain-English Explanation Banner */}
        <div className="mt-4 rounded-lg border border-brand/20 bg-brand/5 p-4 text-sm text-ink">
          <p className="leading-relaxed">
            This evaluation scored <strong className="font-mono">{run.overall_score ?? "—"}</strong> out of 100 overall.
            {" "}<strong>{run.passed_cases}</strong> of <strong>{run.total_cases}</strong> test cases passed successfully
            {" "}(<strong className="font-mono">{passRate}%</strong> pass rate).
          </p>
        </div>

        {/* Collapsible Execution Details (duration, tokens, timestamps) */}
        <details className="mt-4 border-t border-border pt-3 group">
          <summary className="cursor-pointer list-none text-xs font-medium text-muted hover:text-ink flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5">
              <svg
                width="12"
                height="12"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
                className="transition-transform group-open:rotate-90"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 18l6-6-6-6"
                />
              </svg>
              View technical execution metrics (Duration, tokens &amp; timestamp)
            </span>
            <span className="font-mono text-[10px] text-muted">Click to view</span>
          </summary>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted font-mono">
                Duration
              </p>
              <p className="mt-1 font-mono text-sm font-semibold text-ink">
                {formatDuration(run.total_duration)}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted font-mono">
                Input tokens
              </p>
              <p className="mt-1 font-mono text-sm font-semibold text-ink">
                {run.total_input_tokens ?? "—"}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted font-mono">
                Output tokens
              </p>
              <p className="mt-1 font-mono text-sm font-semibold text-ink">
                {run.total_output_tokens ?? "—"}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted font-mono">
                Completed
              </p>
              <p className="mt-1 font-mono text-xs font-semibold text-ink truncate">
                {formatDate(run.completed_at)}
              </p>
            </div>
          </div>
        </details>
      </section>

      {/* Individual Test Results */}
      <section className="space-y-4">
        <div>
          <h2 className="font-serif text-2xl text-ink">
            Test Case Results
          </h2>
          <p className="text-xs text-muted">
            Review the generated model responses for each test case. Expand to inspect individual criterion scores and evaluator feedback.
          </p>
        </div>

        <div className="space-y-4">
          {(run.results || []).map((result) => {
            const criteriaList = Object.entries(result.criteria_scores || {});
            return (
              <article
                key={result.id}
                className="overflow-hidden rounded-xl border border-border bg-surface shadow-subtle"
              >
                {/* Result header */}
                <div className="flex flex-col justify-between gap-3 border-b border-border p-5 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-ink text-sm sm:text-base">
                        {result.test_case_name || `Case #${result.test_case}`}
                      </h3>

                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${
                          result.status === "passed"
                            ? "bg-success/10 text-success"
                            : result.status === "failed"
                              ? "bg-error/10 text-error"
                              : "bg-warning/10 text-warning"
                        }`}
                      >
                        {result.status}
                      </span>
                    </div>

                    <p className="mt-1 font-mono text-[10px] text-muted">
                      Test case #{result.test_case} · Execution #{result.execution_id} · {result.execution_model}
                    </p>
                  </div>

                  <div className="sm:text-right">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-muted font-mono">
                      Score
                    </p>
                    <p
                      className={`font-mono text-2xl font-semibold ${scoreClasses(
                        result.score
                      )}`}
                    >
                      {result.score ?? "—"}
                    </p>
                  </div>
                </div>

                {/* Prominently displayed generated response */}
                <div className="p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-2">
                    Generated response
                  </p>
                  <div className="rounded-lg border border-border bg-background p-4">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                      {result.execution_output || "No response recorded."}
                    </p>
                  </div>
                </div>

                {/* Collapsible criteria scores, feedback, and execution metrics */}
                <details className="border-t border-border group">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 text-xs font-medium text-muted hover:text-ink hover:bg-background/40">
                    <span className="inline-flex items-center gap-1.5">
                      <svg
                        width="12"
                        height="12"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="transition-transform group-open:rotate-90"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 18l6-6-6-6"
                        />
                      </svg>
                      Criterion breakdown &amp; evaluator feedback
                    </span>
                    <span className="font-mono text-[10px] text-muted">
                      {criteriaList.length} criteria
                    </span>
                  </summary>

                  <div className="border-t border-border p-5 space-y-4 bg-background/20">
                    {/* Criteria breakdown */}
                    {criteriaList.length > 0 && (
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted mb-2">
                          Evaluation Criteria
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                          {criteriaList.map(([criterion, value]) => (
                            <div
                              key={criterion}
                              className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2"
                            >
                              <span className="text-xs capitalize text-muted truncate pr-2">
                                {capitalizeLabel(criterion)}
                              </span>
                              <span className="font-mono text-sm font-semibold text-ink shrink-0">
                                {value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Evaluator feedback */}
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted mb-1.5">
                        Judge Feedback
                      </p>
                      <div className="rounded-lg border border-border bg-background p-3 text-xs leading-5 text-muted">
                        {result.feedback || "No feedback recorded."}
                      </div>
                    </div>

                    {/* Execution metadata */}
                    <div className="flex flex-wrap gap-4 pt-1 font-mono text-[11px] text-muted border-t border-border/50">
                      <span>Duration: <strong className="text-ink">{formatDuration(result.execution_duration)}</strong></span>
                      <span>In tokens: <strong className="text-ink">{result.prompt_eval_count ?? "—"}</strong></span>
                      <span>Out tokens: <strong className="text-ink">{result.eval_count ?? "—"}</strong></span>
                      <span>Model: <strong className="text-ink">{result.execution_model || "—"}</strong></span>
                    </div>
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
