import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAdminStats } from "../../services/adminService";

function formatNumber(value) {
  return new Intl.NumberFormat("en-IN").format(value || 0);
}

function StatCard({ label, value, description, badge, badgeClass }) {
  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-subtle flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
            {label}
          </p>
          {badge && (
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-medium border ${badgeClass}`}
            >
              {badge}
            </span>
          )}
        </div>

        <p className="mt-3 font-serif text-3xl sm:text-4xl tracking-tight text-ink">
          {value}
        </p>
      </div>

      <p className="mt-2 text-xs text-muted leading-relaxed">
        {description}
      </p>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      setLoading(true);
      setError("");
      const data = await getAdminStats();
      setStats(data);
    } catch (err) {
      setError(
        err.message || "Failed to load administrative overview metrics."
      );
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-8 pb-16 max-w-5xl">
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-64 rounded bg-border/50" />
          <div className="h-4 w-96 rounded bg-border/30" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-card border border-border bg-surface p-5 shadow-subtle animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 pb-16 max-w-5xl">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl text-ink">
            Admin Dashboard
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            System overview and infrastructure health.
          </p>
        </div>

        <div className="rounded-card border border-error/20 bg-error/5 p-5 text-sm text-error">
          <p className="font-semibold">Unable to load admin metrics</p>
          <p className="mt-1 text-xs">{error}</p>
          <button
            type="button"
            onClick={loadStats}
            className="mt-3 rounded-control bg-error/10 px-3 py-1.5 text-xs font-semibold text-error hover:bg-error/20 transition-colors"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  const { users, prompts, executions, evaluations, ollama } = stats || {};

  return (
    <div className="space-y-8 pb-16 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-3xl sm:text-4xl text-ink">
              Admin Dashboard
            </h1>
            <span className="rounded-sm bg-brand/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-brand font-semibold">
              Admin
            </span>
          </div>
          <p className="mt-1.5 text-sm text-muted">
            Aggregate Prompt Lab metrics, Ollama model availability, and platform health.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadStats}
            className="rounded-control border border-border bg-surface px-3 py-2 text-xs font-medium text-ink hover:border-brand hover:text-brand transition-colors"
            title="Refresh metrics"
          >
            Refresh
          </button>
          <Link
            to="/dashboard/admin/users"
            className="rounded-control bg-ink px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Manage Users →
          </Link>
        </div>
      </div>

      {/* Overview Stat Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total Registered Users"
          value={formatNumber(users?.total)}
          description={`${formatNumber(users?.active)} active · ${formatNumber(users?.inactive)} inactive`}
        />

        <StatCard
          label="Active Users"
          value={formatNumber(users?.active)}
          description={
            users?.total > 0
              ? `${Math.round(((users?.active || 0) / users.total) * 100)}% active account rate`
              : "No registered accounts yet"
          }
          badge="Healthy"
          badgeClass="border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
        />

        <StatCard
          label="Total Saved Prompts"
          value={formatNumber(prompts?.total)}
          description="Prompts stored across user libraries"
        />

        <StatCard
          label="Total Executions"
          value={formatNumber(executions?.total)}
          description="Prompt sandbox runs recorded"
        />

        <StatCard
          label="Completed Evaluations"
          value={formatNumber(evaluations?.total_completed)}
          description="Full evaluation test runs completed"
        />

        <StatCard
          label="Ollama Runtime"
          value={ollama?.available ? `${ollama.model_count} Models` : "Offline"}
          description={
            ollama?.available
              ? "Local Ollama daemon running on port 11434"
              : "Ollama service unavailable or unreachable"
          }
          badge={ollama?.available ? "Online" : "Offline"}
          badgeClass={
            ollama?.available
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
              : "border-rose-500/20 bg-rose-500/10 text-rose-700"
          }
        />
      </div>

      {/* Ollama Models Discovery Section */}
      <section className="rounded-card border border-border bg-surface p-6 shadow-subtle space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-4">
          <div>
            <h2 className="text-base font-semibold text-ink">
              Installed LLM Runtime Models
            </h2>
            <p className="text-xs text-muted">
              Models discovered dynamically from Ollama at http://localhost:11434.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium border ${
                ollama?.available
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
                  : "border-rose-500/20 bg-rose-500/10 text-rose-700"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  ollama?.available ? "bg-emerald-600" : "bg-rose-600"
                }`}
              />
              {ollama?.available ? "Service Available" : "Service Disconnected"}
            </span>
          </div>
        </div>

        {ollama?.available ? (
          ollama?.models?.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-2">
              {ollama.models.map((mod) => (
                <div
                  key={mod.name}
                  className="rounded-control border border-border bg-background p-4 space-y-1.5"
                >
                  <p className="font-mono text-xs font-semibold text-ink break-all">
                    {mod.name}
                  </p>
                  <div className="flex items-center gap-3 font-mono text-[11px] text-muted">
                    {mod.family && <span>Family: {mod.family}</span>}
                    {mod.parameter_size && <span>Params: {mod.parameter_size}</span>}
                    {mod.size_formatted && <span>Disk: {mod.size_formatted}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-xs text-muted">
              Ollama is online, but no models are currently installed. Run `ollama pull gemma3:4b` to install one.
            </p>
          )
        ) : (
          <div className="rounded-control border border-rose-500/20 bg-rose-500/5 p-4 text-xs text-rose-700">
            <p className="font-medium">Ollama is currently unreachable.</p>
            <p className="mt-1 text-rose-600/90">
              {ollama?.error || "Ensure the Ollama application or daemon is started locally."}
            </p>
          </div>
        )}
      </section>

      {/* Quick Access Card */}
      <section className="rounded-card border border-border bg-surface p-6 shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-ink">
            User Account Management
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Review registered accounts, inspect registration dates and activity, or update active statuses.
          </p>
        </div>

        <Link
          to="/dashboard/admin/users"
          className="inline-flex items-center gap-2 rounded-control bg-ink px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity w-fit"
        >
          View Registered Users ({users?.total || 0}) →
        </Link>
      </section>
    </div>
  );
}
