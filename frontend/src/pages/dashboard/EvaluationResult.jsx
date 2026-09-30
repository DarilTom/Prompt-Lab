import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getEvaluationRun } from "../../services/evaluationService";

function formatDuration(nanoseconds) {
  if (
    nanoseconds === null ||
    nanoseconds === undefined
  ) {
    return "—";
  }

  const seconds =
    Number(nanoseconds) / 1_000_000_000;

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

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusClasses(status) {
  switch (status) {
    case "completed":
      return "bg-success/10 text-success";

    case "failed":
      return "bg-error/10 text-error";

    case "running":
      return "bg-warning/10 text-warning";

    default:
      return "bg-border text-muted";
  }
}

function scoreClasses(score) {
  const value = Number(score);

  if (Number.isNaN(value)) {
    return "text-muted";
  }

  return value >= 70
    ? "text-success"
    : "text-error";
}

function capitalizeLabel(value) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );
}

function LoadingState() {
  return (
    <div className="flex min-h-[420px] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-border border-t-brand" />

        <p className="mt-4 text-sm text-muted">
          Loading evaluation result...
        </p>
      </div>
    </div>
  );
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

        setError(
          err.message ||
            "Unable to load the evaluation result."
        );
      } finally {
        setLoading(false);
      }
    }

    loadRun();
  }, [id]);

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Link
          to="/dashboard/evaluations"
          className="text-sm text-muted hover:text-ink"
        >
          ← Back to evaluations
        </Link>

        <div className="rounded-xl border border-error/20 bg-error/5 p-6 text-sm text-error">
          {error}
        </div>
      </div>
    );
  }

  if (!run) {
    return null;
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Back */}
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

      {/* Header */}
      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brand">
              Evaluation result
            </p>

            <h1 className="mt-2 font-serif text-4xl tracking-tight text-ink">
              Run #{run.id}
            </h1>

            <p className="mt-2 text-sm text-muted">
              {run.prompt_title} · v{run.version_number}
            </p>

            <p className="mt-1 text-xs text-muted">
              {run.dataset_name} · {run.model}
            </p>
          </div>

          <span
            className={`w-fit rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] ${statusClasses(
              run.status
            )}`}
          >
            {run.status}
          </span>
        </div>

        {/* Main metrics */}
        <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted">
              Overall score
            </p>

            <p
              className={`mt-2 font-mono text-2xl font-semibold ${scoreClasses(
                run.overall_score
              )}`}
            >
              {run.overall_score ?? "—"}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted">
              Test cases
            </p>

            <p className="mt-2 font-mono text-2xl font-semibold text-ink">
              {run.total_cases}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted">
              Passed
            </p>

            <p className="mt-2 font-mono text-2xl font-semibold text-success">
              {run.passed_cases}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted">
              Failed
            </p>

            <p className="mt-2 font-mono text-2xl font-semibold text-error">
              {run.failed_cases}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted">
              Duration
            </p>

            <p className="mt-2 font-mono text-2xl font-semibold text-ink">
              {formatDuration(run.total_duration)}
            </p>
          </div>
        </div>
      </section>

      {/* Aggregate metrics */}
      <section className="grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
            Input tokens
          </p>

          <p className="mt-2 font-mono text-2xl text-ink">
            {run.total_input_tokens ?? "—"}
          </p>

          <p className="mt-1 text-xs text-muted">
            Reported by Ollama across the run
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
            Output tokens
          </p>

          <p className="mt-2 font-mono text-2xl text-ink">
            {run.total_output_tokens ?? "—"}
          </p>

          <p className="mt-1 text-xs text-muted">
            Generated across all test cases
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
            Completed
          </p>

          <p className="mt-2 font-mono text-2xl text-ink">
            {formatDate(run.completed_at)}
          </p>

          <p className="mt-1 text-xs text-muted">
            Evaluation completion time
          </p>
        </div>
      </section>

      {/* Individual test results */}
      <section>
        <div className="mb-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            Detailed evaluation
          </p>

          <h2 className="mt-1 font-serif text-3xl text-ink">
            Test case results
          </h2>

          <p className="mt-2 text-sm text-muted">
            Inspect the generated response, score,
            evaluation criteria, and judge feedback
            for each case.
          </p>
        </div>

        <div className="space-y-5">
          {(run.results || []).map((result) => (
            <article
              key={result.id}
              className="overflow-hidden rounded-xl border border-border bg-surface"
            >
              {/* Result header */}
              <div className="flex flex-col justify-between gap-4 border-b border-border p-5 md:flex-row md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-ink">
                      {result.test_case_name}
                    </h3>

                    <span
                      className={`rounded-full px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] ${
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
                    Test case #{result.test_case}
                    {" · "}
                    Execution #{result.execution_id}
                    {" · "}
                    {result.execution_model}
                  </p>
                </div>

                <div className="md:text-right">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-muted">
                    Score
                  </p>

                  <p
                    className={`mt-1 font-mono text-3xl font-semibold ${scoreClasses(
                      result.score
                    )}`}
                  >
                    {result.score ?? "—"}
                  </p>
                </div>
              </div>

              <div className="grid gap-6 p-5 xl:grid-cols-[1.25fr_0.75fr]">
                {/* Response */}
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
                    Generated response
                  </p>

                  <div className="mt-3 rounded-lg border border-border bg-background p-4">
                    <p className="whitespace-pre-wrap text-sm leading-7 text-ink">
                      {result.execution_output ||
                        "No response recorded."}
                    </p>
                  </div>
                </div>

                {/* Evaluation */}
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
                    Evaluation criteria
                  </p>

                  <div className="mt-3 space-y-2">
                    {Object.entries(
                      result.criteria_scores || {}
                    ).map(
                      ([criterion, value]) => (
                        <div
                          key={criterion}
                          className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5"
                        >
                          <span className="text-xs capitalize text-muted">
                            {capitalizeLabel(
                              criterion
                            )}
                          </span>

                          <span className="font-mono text-sm font-semibold text-ink">
                            {value}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* Feedback + metrics */}
              <div className="grid gap-5 border-t border-border p-5 lg:grid-cols-[1fr_auto]">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
                    Evaluator feedback
                  </p>

                  <p className="mt-2 text-sm leading-6 text-muted">
                    {result.feedback ||
                      "No feedback recorded."}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[440px]">
                  <div className="rounded-lg border border-border bg-background p-3">
                    <p className="text-[9px] uppercase tracking-[0.1em] text-muted">
                      Duration
                    </p>
                    <p className="mt-1 font-mono text-sm text-ink">
                      {formatDuration(
                        result.execution_duration
                      )}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border bg-background p-3">
                    <p className="text-[9px] uppercase tracking-[0.1em] text-muted">
                      Input tokens
                    </p>
                    <p className="mt-1 font-mono text-sm text-ink">
                      {result.prompt_eval_count ??
                        "—"}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border bg-background p-3">
                    <p className="text-[9px] uppercase tracking-[0.1em] text-muted">
                      Output tokens
                    </p>
                    <p className="mt-1 font-mono text-sm text-ink">
                      {result.eval_count ?? "—"}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border bg-background p-3">
                    <p className="text-[9px] uppercase tracking-[0.1em] text-muted">
                      Model
                    </p>
                    <p className="mt-1 truncate font-mono text-sm text-ink">
                      {result.execution_model ||
                        "—"}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Footer actions */}
      <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row">
        <Link
          to="/dashboard/evaluations/run"
          className="inline-flex items-center justify-center gap-2 rounded-control bg-brand px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          Run another evaluation
        </Link>

        <Link
          to="/dashboard/evaluations"
          className="inline-flex items-center justify-center rounded-control border border-border bg-surface px-4 py-2.5 text-sm font-medium text-ink hover:border-ink"
        >
          Back to evaluations
        </Link>
      </div>
    </div>
  );
}