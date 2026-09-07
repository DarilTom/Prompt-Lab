import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getExecution } from "../../services/executionService";

function formatDate(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "medium",
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

export default function ExecutionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [execution, setExecution] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadExecution();
  }, [id]);

  async function loadExecution() {
    try {
      setLoading(true);
      setError("");

      const data = await getExecution(id);

      setExecution(data);
    } catch (err) {
      setError(err.message || "Failed to load execution.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-5 w-32 animate-pulse rounded bg-neutral-200" />
        <div className="h-10 w-2/3 animate-pulse rounded bg-neutral-200" />
        <div className="h-64 animate-pulse rounded-card bg-neutral-200" />
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="rounded-card border border-border bg-surface p-8">
        <h1 className="font-serif text-3xl">
          Execution not found
        </h1>

        <button
          onClick={() => navigate("/dashboard/executions")}
          className="mt-6 rounded-control bg-brand px-4 py-2.5 text-sm font-semibold text-white"
        >
          Back to Executions
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      <div>
        <button
          onClick={() => navigate("/dashboard/executions")}
          className="mb-5 text-sm font-medium text-muted hover:text-brand"
        >
          ← Back to Execution History
        </button>

        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          RUN-{String(execution.id).padStart(3, "0")}
        </div>

        <h1 className="mt-2 font-serif text-4xl">
          {execution.prompt_title}
        </h1>

        <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted">
          <span>
            Version {execution.version_number}
          </span>

          <span>·</span>

          <span>{execution.model}</span>

          <span>·</span>

          <span>
            {formatDate(execution.created_at)}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-card border border-error/20 bg-error/5 p-4 text-sm text-error">
          {error}
        </div>
      )}

      {/* Input */}
      <section className="rounded-card border border-border bg-surface shadow-subtle">

        <div className="border-b border-border px-6 py-5">
          <h2 className="text-lg font-semibold">
            Input
          </h2>
        </div>

        <div className="p-6">
          <pre className="whitespace-pre-wrap rounded-control border border-border bg-background p-5 font-mono text-sm leading-7">
            {execution.input_text}
          </pre>
        </div>

      </section>

      {/* Response */}
      <section className="rounded-card border border-border bg-surface shadow-subtle">

        <div className="border-b border-border px-6 py-5">
          <h2 className="text-lg font-semibold">
            Response
          </h2>
        </div>

        <div className="p-6">
          <div className="whitespace-pre-wrap rounded-control border border-border bg-background p-5 text-sm leading-7">
            {execution.output_text ||
              execution.error_message ||
              "No response available."}
          </div>
        </div>

      </section>

      {/* Metrics */}
      <section>

        <h2 className="mb-4 font-serif text-3xl">
          Execution Metrics
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-card border border-border bg-surface p-5 shadow-subtle">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
              Status
            </p>

            <p className="mt-2 text-sm font-semibold">
              {execution.status}
            </p>
          </div>

          <div className="rounded-card border border-border bg-surface p-5 shadow-subtle">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
              Duration
            </p>

            <p className="mt-2 font-mono text-sm font-semibold">
              {formatDuration(execution.total_duration)}
            </p>
          </div>

          <div className="rounded-card border border-border bg-surface p-5 shadow-subtle">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
              Input Tokens
            </p>

            <p className="mt-2 font-mono text-sm font-semibold">
              {execution.prompt_eval_count ?? "—"}
            </p>
          </div>

          <div className="rounded-card border border-border bg-surface p-5 shadow-subtle">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
              Output Tokens
            </p>

            <p className="mt-2 font-mono text-sm font-semibold">
              {execution.eval_count ?? "—"}
            </p>
          </div>

        </div>
      </section>

    </div>
  );
}