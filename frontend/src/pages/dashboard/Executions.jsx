import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import { getExecutions, deleteExecution } from "../../services/executionService";
import { useExecution } from "../../context/ExecutionContext";

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
  const location = useLocation();
  const { clearExecution } = useExecution();

  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successNotice, setSuccessNotice] = useState(
    location.state?.notice || ""
  );

  // Deletion state
  const [executionToDelete, setExecutionToDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [modalError, setModalError] = useState("");

  // Copy Response state
  const [copiedId, setCopiedId] = useState(null);
  const [copyError, setCopyError] = useState("");

  useEffect(() => {
    if (location.state?.notice) {
      window.history.replaceState({}, document.title);
    }
  }, [location.state?.notice]);

  // Close modal on Escape key press unless a deletion is in progress
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && executionToDelete && !deletingId) {
        setExecutionToDelete(null);
        setModalError("");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [executionToDelete, deletingId]);

  useEffect(() => {
    let cancelled = false;

    async function fetchExecutions() {
      try {
        const data = await getExecutions();
        if (!cancelled) {
          setExecutions(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load execution history.");
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

  function handleOpenDeleteModal(execution) {
    setExecutionToDelete(execution);
    setModalError("");
  }

  function handleCloseDeleteModal() {
    if (deletingId) return;
    setExecutionToDelete(null);
    setModalError("");
  }

  async function handleConfirmDelete() {
    if (!executionToDelete?.id || deletingId) return;

    const targetId = executionToDelete.id;
    const targetPromptId = executionToDelete.prompt;
    const runLabel = `RUN-${String(targetId).padStart(3, "0")}`;

    try {
      setDeletingId(targetId);
      setModalError("");

      await deleteExecution(targetId);

      // Successfully confirmed by backend -> remove from list
      setExecutions((prev) => prev.filter((item) => item.id !== targetId));

      // Clean up sandbox context for this prompt if needed
      if (targetPromptId) {
        clearExecution(targetPromptId);
      }

      setExecutionToDelete(null);
      setSuccessNotice(`Execution ${runLabel} was deleted successfully.`);
    } catch (err) {
      // Backend returned error (e.g. 400 for evaluation dependency, 403 for unauthorized)
      // Keep record in list and show explanation
      setModalError(
        err.message || "Failed to delete execution. Please try again."
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCopyResponse(event, execution) {
    event.stopPropagation();

    const outputText = execution.output_text;
    if (!outputText || !outputText.trim() || execution.status === "failed") {
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(outputText);
      } else {
        // Fallback for browsers / environments without navigator.clipboard
        const textArea = document.createElement("textarea");
        textArea.value = outputText;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }

      setCopiedId(execution.id);
      setCopyError("");
      setTimeout(() => {
        setCopiedId((current) => (current === execution.id ? null : current));
      }, 2000);
    } catch (err) {
      console.error("Failed to copy response:", err);
      setCopyError("Failed to copy response to clipboard.");
      setTimeout(() => setCopyError(""), 3500);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
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

      {/* Success Notice */}
      {successNotice && (
        <div className="flex items-center justify-between rounded-card border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-xs">
          <div className="flex items-center gap-2">
            <svg
              className="h-4 w-4 shrink-0 text-emerald-600"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-medium">{successNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessNotice("")}
            className="text-xs font-semibold text-emerald-700 transition-colors hover:text-emerald-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Copy Error Notice */}
      {copyError && (
        <div className="flex items-center justify-between rounded-card border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 shadow-xs">
          <div className="flex items-center gap-2">
            <svg
              className="h-4 w-4 shrink-0 text-rose-600"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span>{copyError}</span>
          </div>
          <button
            type="button"
            onClick={() => setCopyError("")}
            className="text-xs font-semibold text-rose-700 transition-colors hover:text-rose-900"
          >
            Dismiss
          </button>
        </div>
      )}

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
          <h2 className="font-serif text-3xl">No executions yet</h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
            Run one of your prompts from the Execution Sandbox and the result
            will appear here.
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
          {executions.map((execution) => {
            const hasUsableOutput = Boolean(
              execution.status !== "failed" &&
              execution.output_text &&
              execution.output_text.trim()
            );
            const isCopied = copiedId === execution.id;

            return (
              <article
                key={execution.id}
                role="button"
                tabIndex={0}
                onClick={() =>
                  navigate(`/dashboard/executions/${execution.id}`)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigate(`/dashboard/executions/${execution.id}`);
                  }
                }}
                className="group cursor-pointer rounded-card border border-border bg-surface p-5 shadow-subtle transition-all duration-200 hover:-translate-y-0.5 hover:shadow-raised focus:outline-none focus:ring-1 focus:ring-brand"
              >
                <div>
                  {/* Main */}
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-3">
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

                      {/* Top-right Copy Response action (only when usable output exists) */}
                      {hasUsableOutput && (
                        <button
                          type="button"
                          onClick={(e) => handleCopyResponse(e, execution)}
                          title={
                            isCopied ? "Response copied" : "Copy Response"
                          }
                          aria-label={
                            isCopied
                              ? "Response copied"
                              : `Copy response for RUN-${String(execution.id).padStart(3, "0")}`
                          }
                          className={`inline-flex shrink-0 items-center gap-1.5 rounded-control border px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-brand ${
                            isCopied
                              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                              : "border-border bg-surface text-muted hover:border-ink/20 hover:bg-neutral-100 hover:text-ink"
                          }`}
                        >
                          {isCopied ? (
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
                              <span className="hidden font-semibold text-emerald-700 sm:inline">
                                Response copied
                              </span>
                              <span className="font-semibold text-emerald-700 sm:hidden">
                                Copied!
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
                              <span className="hidden sm:inline">
                                Copy Response
                              </span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <h2 className="mt-3 font-serif text-2xl transition-colors group-hover:text-brand">
                      {execution.prompt_title}
                    </h2>

                    <p className="mt-1 text-sm text-muted">{execution.model}</p>

                    {execution.error_message && (
                      <div className="mt-3 rounded-control border border-error/20 bg-error/5 p-4 text-sm text-error">
                        {execution.error_message}
                      </div>
                    )}

                    {/* Metrics inline & actions */}
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

                      <div className="flex items-center gap-2">
                        {/* Single labelled Delete button at the bottom */}
                        <button
                          type="button"
                          disabled={deletingId === execution.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDeleteModal(execution);
                          }}
                          title={`Delete execution RUN-${String(execution.id).padStart(3, "0")}`}
                          aria-label={`Delete execution RUN-${String(execution.id).padStart(3, "0")}`}
                          className="inline-flex items-center gap-1.5 rounded-control border border-border bg-surface px-3 py-2 text-xs font-semibold text-muted transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-1 focus:ring-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
                        >
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
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                          <span>Delete</span>
                        </button>

                        {/* View Run button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/dashboard/executions/${execution.id}`);
                          }}
                          className="rounded-control border border-border bg-surface px-4 py-2 text-xs font-semibold transition-colors hover:border-brand hover:text-brand"
                        >
                          View Run →
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {executionToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-execution-dialog-title"
          aria-describedby="delete-execution-dialog-desc"
          onClick={handleCloseDeleteModal}
        >
          <div
            className="w-full max-w-md rounded-card border border-border bg-surface p-6 shadow-raised transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </div>

              <div className="min-w-0 flex-1">
                <h2
                  id="delete-execution-dialog-title"
                  className="font-serif text-xl text-ink"
                >
                  Delete Execution
                </h2>
                <p
                  id="delete-execution-dialog-desc"
                  className="mt-1 text-xs text-muted"
                >
                  Are you sure you want to permanently delete this execution from
                  your history?
                </p>
              </div>
            </div>

            {/* Execution identification details */}
            <div className="mt-4 rounded-control border border-border bg-background p-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  RUN-{String(executionToDelete.id).padStart(3, "0")}
                </span>
                <span className="font-mono text-[10px] text-muted">
                  v{executionToDelete.version_number} · {executionToDelete.model}
                </span>
              </div>
              <div className="mt-1.5 truncate font-medium text-ink">
                {executionToDelete.prompt_title}
              </div>
              <div className="mt-1 font-mono text-[10px] text-muted">
                Executed: {formatDate(executionToDelete.created_at)}
              </div>
            </div>

            {/* Error message inside modal if deletion failed */}
            {modalError && (
              <div className="mt-3.5 flex items-start gap-2 rounded-control border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                <svg
                  className="h-4 w-4 shrink-0 text-rose-600 mt-0.5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="flex-1">
                  <span className="font-semibold">Unable to delete: </span>
                  <span>{modalError}</span>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={handleCloseDeleteModal}
                className="rounded-control border border-border bg-surface px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-neutral-100 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-1.5 rounded-control bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-rose-700 disabled:opacity-50"
              >
                {deletingId ? (
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
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Execution</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
