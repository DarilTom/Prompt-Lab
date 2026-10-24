import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getExecution, deleteExecution } from "../../services/executionService";
import { useExecution } from "../../context/ExecutionContext";

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
  const { clearExecution } = useExecution();

  const [execution, setExecution] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchExecution() {
      try {
        const data = await getExecution(id);
        if (!cancelled) {
          setExecution(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load execution.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchExecution();

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleDeleteExecution() {
    if (!execution?.id || deleting) return;

    const runLabel = `RUN-${String(execution.id).padStart(3, "0")}`;
    const promptId = execution.prompt;

    try {
      setDeleting(true);
      setDeleteError("");

      await deleteExecution(execution.id);

      // Clear cached task in execution context if relevant
      if (promptId) {
        clearExecution(promptId);
      }

      navigate("/dashboard/executions", {
        replace: true,
        state: { notice: `Execution ${runLabel} was deleted successfully.` },
      });
    } catch (err) {
      setDeleteError(
        err.message || "Failed to delete execution. Please try again."
      );
    } finally {
      setDeleting(false);
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
        <h1 className="font-serif text-3xl">Execution not found</h1>

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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
              <span>Version {execution.version_number}</span>
              <span>·</span>
              <span>{execution.model}</span>
              <span>·</span>
              <span>{formatDate(execution.created_at)}</span>
            </div>
          </div>

          {/* Delete action */}
          <div className="sm:pt-8">
            {showDeleteConfirm ? (
              <div className="inline-flex items-center gap-2 rounded-control border border-rose-300 bg-rose-50/90 px-3 py-1.5 shadow-xs">
                <span className="text-xs font-medium text-rose-800">
                  Delete this run?
                </span>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDeleteExecution}
                  className="rounded bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Yes, delete"}
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteError("");
                  }}
                  className="rounded border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-muted hover:text-ink disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(true);
                  setDeleteError("");
                }}
                className="inline-flex items-center gap-1.5 rounded-control border border-border bg-surface px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus:ring-1 focus:ring-rose-500"
                title="Delete execution"
                aria-label="Delete execution"
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <span>Delete Execution</span>
              </button>
            )}
          </div>
        </div>

        {/* Delete error feedback */}
        {deleteError && (
          <div className="mt-4 flex items-center justify-between rounded-control border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-800">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Unable to delete:</span>
              <span>{deleteError}</span>
            </div>
            <button
              type="button"
              onClick={() => setDeleteError("")}
              className="text-xs font-semibold text-rose-700 hover:text-rose-900"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-4 border-t border-border pt-4">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
              Status
            </p>
            <p className="mt-1 text-sm font-semibold text-ink">
              {execution.status}
            </p>
          </div>

          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
              Duration
            </p>
            <p className="mt-1 font-mono text-sm font-semibold text-ink">
              {formatDuration(execution.total_duration)}
            </p>
          </div>

          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
              Input Tokens
            </p>
            <p className="mt-1 font-mono text-sm font-semibold text-ink">
              {execution.prompt_eval_count ?? "—"}
            </p>
          </div>

          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
              Output Tokens
            </p>
            <p className="mt-1 font-mono text-sm font-semibold text-ink">
              {execution.eval_count ?? "—"}
            </p>
          </div>
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
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            Input
          </p>
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
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            Response
          </p>
        </div>

        <div className="p-6">
          <div className="whitespace-pre-wrap rounded-control border border-border bg-background p-5 text-sm leading-7">
            {execution.output_text ||
              execution.error_message ||
              "No response available."}
          </div>
        </div>
      </section>
    </div>
  );
}
