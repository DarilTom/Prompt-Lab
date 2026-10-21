import { useEffect, useMemo, useState } from "react";
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

function tokensPerSecond(execution) {
  if (!execution.eval_count || !execution.total_duration) {
    return "—";
  }

  const seconds =
    execution.total_duration / 1_000_000_000;

  if (seconds <= 0) {
    return "—";
  }

  return `${(
    execution.eval_count / seconds
  ).toFixed(1)} tok/s`;
}

function ExecutionSelectCard({
  label,
  executions,
  selectedId,
  onChange,
  disabledId,
}) {
  const selectedExecution = executions.find(
    (execution) =>
      String(execution.id) === String(selectedId)
  );

  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-subtle">
      <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
      </div>

      <select
        value={selectedId}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="mt-3 w-full rounded-control border border-border bg-background px-3 py-3 font-mono text-xs outline-none focus:border-brand"
      >
        <option value="">Select an execution...</option>

        {executions.map((execution) => (
          <option
            key={execution.id}
            value={execution.id}
            disabled={
              String(execution.id) === String(disabledId)
            }
          >
            RUN-
            {String(execution.id).padStart(3, "0")}
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
            <span className="font-semibold text-ink">
              Version:
            </span>{" "}
            v{selectedExecution.version_number}
          </p>

          <p>
            <span className="font-semibold text-ink">
              Model:
            </span>{" "}
            {selectedExecution.model}
          </p>

          <p>
            <span className="font-semibold text-ink">
              Executed:
            </span>{" "}
            {formatDate(selectedExecution.created_at)}
          </p>
        </div>
      )}
    </div>
  );
}

function ResponsePanel({ execution, label }) {
  const [expanded, setExpanded] = useState(false);

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
          <div className="mb-2 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">
            Response
          </div>

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
            value={formatDuration(
              execution.total_duration
            )}
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

      <p className="mt-1 font-mono text-xs font-semibold text-ink">
        {value}
      </p>
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

  useEffect(() => {
    loadExecutions();
  }, []);

  async function loadExecutions() {
    try {
      setLoading(true);
      setError("");

      const data = await getExecutions();

      const completed = (
        Array.isArray(data) ? data : []
      ).filter(
        (execution) =>
          execution.status === "completed"
      );

      setExecutions(completed);

      if (completed.length >= 2) {
        setLeftId(String(completed[1].id));
        setRightId(String(completed[0].id));
      }
    } catch (err) {
      setError(
        err.message ||
          "Failed to load executions for comparison."
      );
    } finally {
      setLoading(false);
    }
  }

  const leftExecution = useMemo(
    () =>
      executions.find(
        (execution) =>
          String(execution.id) === String(leftId)
      ),
    [executions, leftId]
  );

  const rightExecution = useMemo(
    () =>
      executions.find(
        (execution) =>
          String(execution.id) === String(rightId)
      ),
    [executions, rightId]
  );

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>

        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          Response Comparison
        </div>

        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

          <div>
            <h1 className="font-serif text-4xl leading-tight">
              Compare Experiments
            </h1>

            <p className="mt-2 max-w-2xl text-muted">
              Compare two completed prompt executions side by
              side using their responses and measured metrics.
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

          <h2 className="font-serif text-3xl">
            Not enough executions
          </h2>

          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">
            Run at least two completed experiments before
            comparing responses.
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
                onChange={setLeftId}
                disabledId={rightId}
              />

              <ExecutionSelectCard
                label="Experiment B"
                executions={executions}
                selectedId={rightId}
                onChange={setRightId}
                disabledId={leftId}
              />

            </div>
          </section>

          {/* Comparison */}
          {leftExecution && rightExecution ? (
            <section>

              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-serif text-3xl">
                    Side-by-Side Results
                  </h2>

                  <p className="mt-1 text-sm text-muted">
                    Compare the generated responses and execution
                    performance.
                  </p>
                </div>
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
