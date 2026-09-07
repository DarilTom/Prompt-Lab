import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { getPrompts } from "../../services/promptService";
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

function formatNumber(value) {
  return new Intl.NumberFormat("en-IN").format(value || 0);
}

function StatCard({ label, value, description, className = "" }) {
  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-subtle">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
      </p>

      <p className={`mt-2 font-serif text-4xl tracking-tight ${className}`}>
        {value}
      </p>

      <p className="mt-1.5 text-xs text-muted">
        {description}
      </p>
    </div>
  );
}

export default function Overview() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [prompts, setPrompts] = useState([]);
  const [executions, setExecutions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadOverview();
  }, []);

  async function loadOverview() {
    try {
      setLoading(true);
      setError("");

      const [promptData, executionData] = await Promise.all([
        getPrompts(),
        getExecutions(),
      ]);

      setPrompts(
        Array.isArray(promptData) ? promptData : []
      );

      setExecutions(
        Array.isArray(executionData) ? executionData : []
      );
    } catch (err) {
      setError(
        err.message || "Failed to load dashboard data."
      );
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const activePrompts = prompts.filter(
      (prompt) => prompt.status !== "archived"
    );

    const completedExecutions = executions.filter(
      (execution) => execution.status === "completed"
    );

    const durations = completedExecutions
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
      executions.length > 0
        ? (completedExecutions.length /
            executions.length) *
          100
        : 0;

    return {
      activePrompts: activePrompts.length,
      totalExecutions: executions.length,
      successRate,
      averageDuration,
    };
  }, [prompts, executions]);

  const recentPrompts = useMemo(() => {
    const executionCounts = {};

    executions.forEach((execution) => {
      executionCounts[execution.prompt] =
        (executionCounts[execution.prompt] || 0) + 1;
    });

    return [...prompts]
      .sort(
        (a, b) =>
          new Date(b.updated_at || 0) -
          new Date(a.updated_at || 0)
      )
      .slice(0, 5)
      .map((prompt) => ({
        ...prompt,
        runCount: executionCounts[prompt.id] || 0,
      }));
  }, [prompts, executions]);

  const modelBreakdown = useMemo(() => {
    const counts = {};

    executions.forEach((execution) => {
      counts[execution.model] =
        (counts[execution.model] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([model, runs]) => ({
        model,
        runs,
        percentage:
          executions.length > 0
            ? (runs / executions.length) * 100
            : 0,
      }))
      .sort((a, b) => b.runs - a.runs)
      .slice(0, 5);
  }, [executions]);

  if (loading) {
    return (
      <div className="space-y-7 pb-10">

        <div className="space-y-3">
          <div className="h-4 w-40 animate-pulse rounded bg-neutral-200" />
          <div className="h-10 w-72 animate-pulse rounded bg-neutral-200" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded bg-neutral-200" />
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-32 animate-pulse rounded-card bg-neutral-200"
            />
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="h-80 animate-pulse rounded-card bg-neutral-200 lg:col-span-2" />
          <div className="h-80 animate-pulse rounded-card bg-neutral-200" />
        </div>

      </div>
    );
  }

  return (
    <div className="space-y-7 pb-10">

      {/* Greeting */}
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          Experiment workspace
        </p>

        <h2 className="mt-1 font-serif text-3xl text-ink">
          Welcome, {user?.name?.split(" ")[0] || "there"}.
        </h2>

        <p className="mt-1 text-sm text-muted">
          Here's what's happening in your lab right now.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-card border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">

        <StatCard
          label="Active Prompts"
          value={formatNumber(stats.activePrompts)}
          description="Non-archived experiments"
          className="text-brand"
        />

        <StatCard
          label="Executions"
          value={formatNumber(stats.totalExecutions)}
          description="Recorded experiment runs"
          className="text-accent"
        />

        <StatCard
          label="Success Rate"
          value={`${stats.successRate.toFixed(1)}%`}
          description="Completed executions"
          className="text-success"
        />

        <StatCard
          label="Avg. Duration"
          value={formatDuration(stats.averageDuration)}
          description="Across completed runs"
          className="text-warning"
        />

      </div>

      {/* Main content */}
      <div className="grid gap-5 lg:grid-cols-3">

        {/* Recent prompts */}
        <section className="overflow-hidden rounded-card border border-border bg-surface shadow-subtle lg:col-span-2">

          <div className="flex items-center justify-between border-b border-border px-5 py-4">

            <div>
              <h3 className="text-sm font-semibold text-ink">
                Recent prompts
              </h3>

              <p className="mt-0.5 text-xs text-muted">
                Your most recently updated experiments.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                navigate("/dashboard/prompts")
              }
              className="text-xs font-semibold text-brand transition-opacity hover:opacity-70"
            >
              View all →
            </button>

          </div>

          {recentPrompts.length === 0 ? (
            <div className="p-8 text-center">

              <p className="font-serif text-2xl">
                No prompts yet
              </p>

              <p className="mt-2 text-sm text-muted">
                Create your first experiment to populate
                this workspace.
              </p>

              <button
                type="button"
                onClick={() =>
                  navigate("/dashboard/prompts/new")
                }
                className="mt-5 rounded-control bg-brand px-4 py-2.5 text-sm font-semibold text-white"
              >
                + New Prompt
              </button>

            </div>
          ) : (
            <div className="divide-y divide-border">

              {recentPrompts.map((prompt) => (
                <button
                  key={prompt.id}
                  type="button"
                  onClick={() =>
                    navigate(
                      `/dashboard/prompts/${prompt.id}`
                    )
                  }
                  className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-background"
                >

                  <div className="min-w-0 flex-1">

                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-ink group-hover:text-brand">
                        {prompt.title}
                      </span>

                      <span className="shrink-0 rounded-sm bg-background px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-muted">
                        {prompt.status}
                      </span>
                    </div>

                    <p className="mt-1 truncate text-xs text-muted">
                      {prompt.description || "No description"}
                    </p>

                  </div>

                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                      Version
                    </p>

                    <p className="mt-1 font-mono text-xs">
                      {prompt.latest_version
                        ? `v${prompt.latest_version.version_number}`
                        : "—"}
                    </p>
                  </div>

                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                      Runs
                    </p>

                    <p className="mt-1 font-mono text-xs">
                      {prompt.runCount}
                    </p>
                  </div>

                  <div className="hidden shrink-0 text-right md:block">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                      Updated
                    </p>

                    <p className="mt-1 max-w-32 font-mono text-[10px] text-muted">
                      {formatDate(prompt.updated_at)}
                    </p>
                  </div>

                  <span className="shrink-0 text-muted transition-transform group-hover:translate-x-1 group-hover:text-brand">
                    →
                  </span>

                </button>
              ))}

            </div>
          )}

        </section>

        {/* Model usage */}
        <section className="rounded-card border border-border bg-surface p-5 shadow-subtle">

          <div className="flex items-start justify-between">

            <div>
              <h3 className="text-sm font-semibold text-ink">
                Model usage
              </h3>

              <p className="mt-0.5 text-xs text-muted">
                Based on recorded executions.
              </p>
            </div>

            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
              {executions.length} runs
            </span>

          </div>

          {modelBreakdown.length === 0 ? (
            <div className="py-12 text-center">

              <p className="font-serif text-xl">
                No model data yet
              </p>

              <p className="mt-2 text-xs leading-5 text-muted">
                Execute a prompt to start collecting model
                usage data.
              </p>

            </div>
          ) : (
            <div className="mt-6 space-y-5">

              {modelBreakdown.map((item) => (
                <div key={item.model}>

                  <div className="mb-2 flex items-center justify-between gap-4">

                    <span className="truncate font-mono text-xs font-semibold">
                      {item.model}
                    </span>

                    <span className="shrink-0 font-mono text-[10px] text-muted">
                      {item.runs} ·{" "}
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
          )}

        </section>

      </div>

      {/* Recent executions */}
      <section className="rounded-card border border-border bg-surface shadow-subtle">

        <div className="flex items-center justify-between border-b border-border px-5 py-4">

          <div>
            <h3 className="text-sm font-semibold text-ink">
              Recent executions
            </h3>

            <p className="mt-0.5 text-xs text-muted">
              Latest activity from your experiment runs.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              navigate("/dashboard/executions")
            }
            className="text-xs font-semibold text-brand transition-opacity hover:opacity-70"
          >
            View all →
          </button>

        </div>

        {executions.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">
            No executions have been recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-border">

            {executions.slice(0, 5).map((execution) => (
              <button
                key={execution.id}
                type="button"
                onClick={() =>
                  navigate(
                    `/dashboard/executions/${execution.id}`
                  )
                }
                className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-background"
              >

                <div className="min-w-0 flex-1">

                  <div className="flex flex-wrap items-center gap-2">

                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                      RUN-
                      {String(execution.id).padStart(3, "0")}
                    </span>

                    <span className="h-1 w-1 rounded-full bg-border" />

                    <span className="font-mono text-[10px] text-muted">
                      v{execution.version_number}
                    </span>

                    <span className="rounded-pill border border-success/20 bg-success/10 px-2 py-0.5 font-mono text-[9px] uppercase text-success">
                      {execution.status}
                    </span>

                  </div>

                  <p className="mt-1 truncate text-sm font-medium text-ink group-hover:text-brand">
                    {execution.prompt_title}
                  </p>

                  <p className="mt-0.5 text-xs text-muted">
                    {execution.model} ·{" "}
                    {formatDate(execution.created_at)}
                  </p>

                </div>

                <div className="hidden shrink-0 text-right sm:block">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                    Duration
                  </p>

                  <p className="mt-1 font-mono text-xs font-semibold">
                    {formatDuration(
                      execution.total_duration
                    )}
                  </p>
                </div>

                <div className="hidden shrink-0 text-right sm:block">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                    Output
                  </p>

                  <p className="mt-1 font-mono text-xs font-semibold">
                    {formatNumber(
                      execution.eval_count
                    )}
                  </p>
                </div>

                <span className="shrink-0 text-muted transition-transform group-hover:translate-x-1 group-hover:text-brand">
                  →
                </span>

              </button>
            ))}

          </div>
        )}

      </section>

    </div>
  );
}