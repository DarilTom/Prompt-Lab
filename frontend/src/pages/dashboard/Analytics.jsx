import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getExecutions } from "../../services/executionService";

function formatDuration(nanoseconds) {
  if (!nanoseconds) return "—";

  const seconds = nanoseconds / 1_000_000_000;

  if (seconds < 1) {
    return `${Math.round(nanoseconds / 1_000_000)} ms`;
  }

  return `${seconds.toFixed(2)} s`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-IN").format(value || 0);
}

function formatDate(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function MetricCard({ label, value, description }) {
  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-subtle">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">
        {label}
      </p>

      <p className="mt-3 font-serif text-3xl text-ink">
        {value}
      </p>

      {description && (
        <p className="mt-1 text-xs text-muted">
          {description}
        </p>
      )}
    </div>
  );
}

export default function Analytics() {
  const navigate = useNavigate();

  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    try {
      setLoading(true);
      setError("");

      const data = await getExecutions();

      setExecutions(
        Array.isArray(data) ? data : []
      );
    } catch (err) {
      setError(
        err.message || "Failed to load analytics."
      );
    } finally {
      setLoading(false);
    }
  }

  const analytics = useMemo(() => {
    const total = executions.length;

    const completed = executions.filter(
      (execution) =>
        execution.status === "completed"
    );

    const failed = executions.filter(
      (execution) =>
        execution.status === "failed"
    );

    const totalInputTokens = executions.reduce(
      (sum, execution) =>
        sum + (execution.prompt_eval_count || 0),
      0
    );

    const totalOutputTokens = executions.reduce(
      (sum, execution) =>
        sum + (execution.eval_count || 0),
      0
    );

    const durations = completed
      .map((execution) => execution.total_duration)
      .filter(Boolean);

    const averageDuration =
      durations.length > 0
        ? durations.reduce(
            (sum, duration) => sum + duration,
            0
          ) / durations.length
        : null;

    const successRate =
      total > 0
        ? (completed.length / total) * 100
        : 0;

    const modelCounts = {};

    executions.forEach((execution) => {
      modelCounts[execution.model] =
        (modelCounts[execution.model] || 0) + 1;
    });

    const modelBreakdown = Object.entries(modelCounts)
      .map(([model, runs]) => ({
        model,
        runs,
        percentage:
          total > 0 ? (runs / total) * 100 : 0,
      }))
      .sort((a, b) => b.runs - a.runs);

    return {
      total,
      completed: completed.length,
      failed: failed.length,
      successRate,
      totalInputTokens,
      totalOutputTokens,
      averageDuration,
      modelBreakdown,
    };
  }, [executions]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-5 w-24 animate-pulse rounded bg-neutral-200" />
        <div className="h-10 w-1/2 animate-pulse rounded bg-neutral-200" />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-32 animate-pulse rounded-card bg-neutral-200"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          Analytics
        </div>

        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-4xl leading-tight">
              Experiment Analytics
            </h1>

            <p className="mt-2 max-w-2xl text-muted">
              Measure execution performance using your recorded
              prompt experiments.
            </p>
          </div>

          <button
            onClick={loadAnalytics}
            className="rounded-control border border-border bg-surface px-4 py-2.5 text-sm font-semibold transition-colors hover:border-brand hover:text-brand"
          >
            Refresh Data
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-card border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {/* Primary metrics */}
      <section>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

          <MetricCard
            label="Total Runs"
            value={formatNumber(analytics.total)}
            description="All recorded executions"
          />

          <MetricCard
            label="Success Rate"
            value={`${analytics.successRate.toFixed(1)}%`}
            description={`${analytics.completed} completed`}
          />

          <MetricCard
            label="Average Duration"
            value={formatDuration(
              analytics.averageDuration
            )}
            description="Across completed runs"
          />

          <MetricCard
            label="Failed Runs"
            value={formatNumber(analytics.failed)}
            description="Executions requiring review"
          />

        </div>
      </section>

      {/* Token metrics */}
      <section>
        <div className="mb-4">
          <h2 className="font-serif text-3xl">
            Token Usage
          </h2>

          <p className="mt-1 text-sm text-muted">
            Aggregate token counts recorded from Ollama executions.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">

          <MetricCard
            label="Input Tokens"
            value={formatNumber(
              analytics.totalInputTokens
            )}
            description="Prompt evaluation tokens"
          />

          <MetricCard
            label="Output Tokens"
            value={formatNumber(
              analytics.totalOutputTokens
            )}
            description="Generated response tokens"
          />

        </div>
      </section>

      {/* Model breakdown */}
      <section>
        <div className="mb-4">
          <h2 className="font-serif text-3xl">
            Model Usage
          </h2>

          <p className="mt-1 text-sm text-muted">
            Distribution of executions across available models.
          </p>
        </div>

        {analytics.modelBreakdown.length === 0 ? (
          <div className="rounded-card border border-border bg-surface p-8 text-center text-sm text-muted">
            No execution data available yet.
          </div>
        ) : (
          <div className="rounded-card border border-border bg-surface p-5 shadow-subtle">
            <div className="space-y-5">

              {analytics.modelBreakdown.map((item) => (
                <div key={item.model}>

                  <div className="mb-2 flex items-center justify-between gap-4">

                    <span className="font-mono text-xs font-semibold">
                      {item.model}
                    </span>

                    <span className="font-mono text-xs text-muted">
                      {item.runs} run
                      {item.runs === 1 ? "" : "s"} ·{" "}
                      {item.percentage.toFixed(0)}%
                    </span>

                  </div>

                  <div className="h-2 overflow-hidden rounded-pill bg-border">

                    <div
                      className="h-full rounded-pill bg-brand transition-all duration-500"
                      style={{
                        width: `${item.percentage}%`,
                      }}
                    />

                  </div>

                </div>
              ))}

            </div>
          </div>
        )}
      </section>

      {/* Recent activity */}
      <section>

        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="font-serif text-3xl">
              Recent Executions
            </h2>

            <p className="mt-1 text-sm text-muted">
              Latest recorded experiment activity.
            </p>
          </div>

          <button
            onClick={() =>
              navigate("/dashboard/executions")
            }
            className="text-sm font-semibold text-muted hover:text-brand"
          >
            View all →
          </button>
        </div>

        {executions.length === 0 ? (
          <div className="rounded-card border border-border bg-surface p-8 text-center text-sm text-muted">
            No executions have been recorded yet.
          </div>
        ) : (
          <div className="space-y-3">

            {executions.slice(0, 5).map((execution) => (
              <button
                key={execution.id}
                onClick={() =>
                  navigate(
                    `/dashboard/executions/${execution.id}`
                  )
                }
                className="group flex w-full flex-col gap-3 rounded-card border border-border bg-surface p-5 text-left shadow-subtle transition-all duration-200 hover:-translate-y-0.5 hover:shadow-raised sm:flex-row sm:items-center sm:justify-between"
              >

                <div>
                  <div className="flex flex-wrap items-center gap-2">

                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-muted">
                      RUN-
                      {String(execution.id).padStart(3, "0")}
                    </span>

                    <span className="h-1 w-1 rounded-full bg-border" />

                    <span className="font-mono text-xs text-muted">
                      v{execution.version_number}
                    </span>

                  </div>

                  <h3 className="mt-2 font-serif text-xl group-hover:text-brand">
                    {execution.prompt_title}
                  </h3>

                  <p className="mt-1 text-xs text-muted">
                    {execution.model} ·{" "}
                    {formatDate(execution.created_at)}
                  </p>
                </div>

                <div className="flex items-center gap-5">

                  <div className="text-right">
                    <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                      Duration
                    </p>

                    <p className="mt-1 font-mono text-xs font-semibold">
                      {formatDuration(
                        execution.total_duration
                      )}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                      Output
                    </p>

                    <p className="mt-1 font-mono text-xs font-semibold">
                      {execution.eval_count ?? "—"}
                    </p>
                  </div>

                  <span className="text-muted transition-transform group-hover:translate-x-1 group-hover:text-brand">
                    →
                  </span>

                </div>

              </button>
            ))}

          </div>
        )}
      </section>

    </div>
  );
}