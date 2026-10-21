import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getExecutions } from "../../services/executionService";

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

const statusStyles = {
  completed: "bg-success/10 text-success border-success/20",
  failed: "bg-error/10 text-error border-error/20",
  running: "bg-warning/10 text-warning border-warning/20",
};

export default function Executions() {
  const navigate = useNavigate();

  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadExecutions();
  }, []);

  async function loadExecutions() {
    try {
      setLoading(true);
      setError("");

      const data = await getExecutions();

      setExecutions(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load execution history.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          Execution History
        </div>

        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-4xl leading-tight">
              Experiment Runs
            </h1>

            <p className="mt-2 max-w-2xl text-muted">
              Every prompt execution is recorded here for review,
              comparison, and analysis.
            </p>
          </div>

          <span className="font-mono text-xs text-muted">
            {executions.length} run
            {executions.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-card border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="rounded-card border border-border bg-surface p-8 text-sm text-muted">
          Loading execution history...
        </div>
      ) : executions.length === 0 ? (
        <div className="rounded-card border border-border bg-surface p-10 text-center shadow-subtle">

          <h2 className="font-serif text-3xl">
            No executions yet
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
            Run one of your prompts from the Execution Sandbox and
            the result will appear here.
          </p>

          <button
            onClick={() => navigate("/dashboard/prompts")}
            className="mt-6 rounded-control bg-brand px-5 py-2.5 text-sm font-semibold text-white"
          >
            Open Prompt Library
          </button>
        </div>
      ) : (
        <div className="space-y-4">

          {executions.map((execution) => (
            <article
              key={execution.id}
              className="rounded-card border border-border bg-surface p-5 shadow-subtle transition-all duration-200 hover:-translate-y-0.5 hover:shadow-raised"
            >
              <div>

                {/* Main */}
                <div className="min-w-0">

                  <div className="flex flex-wrap items-center gap-2">

                    <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                      RUN-{String(execution.id).padStart(3, "0")}
                    </span>

                    <span className="h-1 w-1 rounded-full bg-border" />

                    <span className="font-mono text-xs text-muted">
                      v{execution.version_number}
                    </span>

                    <span
                      className={`rounded-pill border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] ${
                        statusStyles[execution.status] ||
                        statusStyles.running
                      }`}
                    >
                      {execution.status}
                    </span>
                  </div>

                  <h2 className="mt-3 font-serif text-2xl">
                    {execution.prompt_title}
                  </h2>

                  <p className="mt-1 text-sm text-muted">
                    {execution.model}
                  </p>

                  {execution.error_message && (
                    <div className="mt-3 rounded-control border border-error/20 bg-error/5 p-4 text-sm text-error">
                      {execution.error_message}
                    </div>
                  )}

                  {/* Metrics inline */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
                    <div className="flex flex-wrap gap-4">
                      <div>
                        <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                          Duration
                        </p>
                        <p className="mt-0.5 font-mono text-xs font-semibold">
                          {formatDuration(execution.total_duration)}
                        </p>
                      </div>

                      <div>
                        <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                          In tokens
                        </p>
                        <p className="mt-0.5 font-mono text-xs font-semibold">
                          {execution.prompt_eval_count ?? "—"}
                        </p>
                      </div>

                      <div>
                        <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                          Out tokens
                        </p>
                        <p className="mt-0.5 font-mono text-xs font-semibold">
                          {execution.eval_count ?? "—"}
                        </p>
                      </div>

                      <div>
                        <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                          Executed
                        </p>
                        <p className="mt-0.5 text-xs font-medium">
                          {formatDate(execution.created_at)}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        navigate(`/dashboard/executions/${execution.id}`)
                      }
                      className="rounded-control border border-border bg-surface px-4 py-2 text-xs font-semibold transition-colors hover:border-brand hover:text-brand"
                    >
                      View Run →
                    </button>
                  </div>

                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
