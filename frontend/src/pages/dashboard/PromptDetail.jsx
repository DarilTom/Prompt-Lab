import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  getPrompt,
  getPromptVersions,
  updatePrompt,
  createPromptVersion,
} from "../../services/promptService";

import { createExecution } from "../../services/executionService";

const statusConfig = {
  production: {
    label: "Production",
    className: "border-success/20 bg-success/10 text-success",
  },
  testing: {
    label: "Testing",
    className: "border-warning/20 bg-warning/10 text-warning",
  },
  draft: {
    label: "Draft",
    className: "border-border bg-neutral-100 text-muted",
  },
  archived: {
    label: "Archived",
    className: "border-border bg-neutral-100 text-muted",
  },
};

const categoryLabels = {
  content: "Content",
  ecommerce: "E-commerce",
  engineering: "Engineering",
  legal: "Legal",
  productivity: "Productivity",
  research: "Research",
  support: "Support",
};

const availableModels = [
  {
    value: "gemma3:4b",
    label: "Gemma 3 4B",
  },
];

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

function calculateTokensPerSecond(evalCount, duration) {
  if (!evalCount || !duration) return "—";

  const seconds = duration / 1_000_000_000;

  if (seconds <= 0) return "—";

  return `${(evalCount / seconds).toFixed(1)} tok/s`;
}

export default function PromptDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [prompt, setPrompt] = useState(null);
  const [versions, setVersions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [versionsLoading, setVersionsLoading] = useState(true);

  const [error, setError] = useState("");

  const [status, setStatus] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  const [showNewVersion, setShowNewVersion] = useState(false);

  const [versionContent, setVersionContent] = useState("");
  const [versionSystemPrompt, setVersionSystemPrompt] = useState("");
  const [changeSummary, setChangeSummary] = useState("");
  const [creatingVersion, setCreatingVersion] = useState(false);

  // Execution state
  const [selectedModel, setSelectedModel] = useState(
    availableModels[0].value
  );

  const [executionInput, setExecutionInput] = useState("");

  const [execution, setExecution] = useState(null);
  const [executionLoading, setExecutionLoading] = useState(false);
  const [executionError, setExecutionError] = useState("");

  useEffect(() => {
    loadPrompt();
    loadVersions();
  }, [id]);

  async function loadPrompt() {
    try {
      setLoading(true);
      setError("");

      const data = await getPrompt(id);

      setPrompt(data);
      setStatus(data.status);
    } catch (err) {
      setError(err.message || "Failed to load prompt.");
    } finally {
      setLoading(false);
    }
  }

  async function loadVersions() {
    try {
      setVersionsLoading(true);

      const data = await getPromptVersions(id);

      setVersions(data);
    } catch (err) {
      setError(err.message || "Failed to load version history.");
    } finally {
      setVersionsLoading(false);
    }
  }

  async function handleStatusChange(event) {
    const newStatus = event.target.value;

    try {
      setSavingStatus(true);
      setError("");

      const updated = await updatePrompt(id, {
        status: newStatus,
      });

      setPrompt(updated);
      setStatus(updated.status);
    } catch (err) {
      setError(err.message || "Failed to update status.");
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleCreateVersion(event) {
    event.preventDefault();

    if (!versionContent.trim()) {
      setError("Prompt content is required.");
      return;
    }

    try {
      setCreatingVersion(true);
      setError("");

      await createPromptVersion(id, {
        content: versionContent.trim(),
        system_prompt: versionSystemPrompt.trim(),
        change_summary: changeSummary.trim(),
      });

      setVersionContent("");
      setVersionSystemPrompt("");
      setChangeSummary("");

      setShowNewVersion(false);

      await loadPrompt();
      await loadVersions();
    } catch (err) {
      setError(err.message || "Failed to create new version.");
    } finally {
      setCreatingVersion(false);
    }
  }

  async function handleRunExperiment(event) {
    event.preventDefault();

    if (!latestVersion) {
      setExecutionError(
        "This prompt does not have a version that can be executed."
      );
      return;
    }

    if (!executionInput.trim()) {
      setExecutionError("Please enter something to test.");
      return;
    }

    try {
      setExecutionLoading(true);
      setExecutionError("");
      setExecution(null);

      const result = await createExecution({
        prompt_version: latestVersion.id,
        model: selectedModel,
        input_text: executionInput.trim(),
      });

      setExecution(result);
    } catch (err) {
      setExecutionError(
        err.message || "Failed to execute the prompt."
      );
    } finally {
      setExecutionLoading(false);
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

  if (!prompt) {
    return (
      <div className="rounded-card border border-border bg-surface p-8">
        <h2 className="font-serif text-3xl">Prompt not found</h2>

        <p className="mt-2 text-muted">
          This prompt may have been deleted or you may not have access
          to it.
        </p>

        <button
          onClick={() => navigate("/dashboard/prompts")}
          className="mt-6 rounded-control bg-brand px-4 py-2.5 text-sm font-semibold text-white"
        >
          Back to Prompt Library
        </button>
      </div>
    );
  }

  const latestVersion = prompt.latest_version;

  const currentStatus =
    statusConfig[prompt.status] || statusConfig.draft;

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <button
          onClick={() => navigate("/dashboard/prompts")}
          className="mb-5 text-sm font-medium text-muted transition-colors hover:text-brand"
        >
          ← Back to Prompt Library
        </button>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">

          <div className="max-w-3xl">

            <div className="mb-3 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
              <span>
                EXP-{String(prompt.id).padStart(3, "0")}
              </span>

              <span className="h-1 w-1 rounded-full bg-border" />

              <span>
                {categoryLabels[prompt.category] || prompt.category}
              </span>
            </div>

            <h1 className="font-serif text-4xl leading-tight">
              {prompt.title}
            </h1>

            {prompt.description && (
              <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
                {prompt.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">

            <select
              value={status}
              onChange={handleStatusChange}
              disabled={savingStatus}
              className="rounded-control border border-border bg-surface px-3 py-2.5 text-sm font-medium text-ink outline-none focus:border-brand"
            >
              <option value="draft">Draft</option>
              <option value="testing">Testing</option>
              <option value="production">Production</option>
              <option value="archived">Archived</option>
            </select>

            <span
              className={`rounded-pill border px-3 py-1.5 text-xs font-semibold ${currentStatus.className}`}
            >
              {currentStatus.label}
            </span>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-card border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {/* Current Version */}
      <section className="rounded-card border border-border bg-surface shadow-subtle">

        <div className="flex flex-col gap-4 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between">

          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">
                Current Version
              </h2>

              <span className="rounded-pill bg-ink px-2.5 py-1 font-mono text-xs text-white">
                {latestVersion
                  ? `v${latestVersion.version_number}`
                  : "No version"}
              </span>
            </div>

            <p className="mt-1 text-sm text-muted">
              Last updated{" "}
              {formatDate(
                latestVersion?.created_at || prompt.updated_at
              )}
            </p>
          </div>

          <button
            onClick={() => setShowNewVersion((value) => !value)}
            className="rounded-control bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            + New Version
          </button>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-2">

          <div>
            <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
              Prompt
            </div>

            <pre className="min-h-64 whitespace-pre-wrap rounded-control border border-border bg-background p-5 font-mono text-sm leading-7 text-ink">
              {latestVersion?.content ||
                "No prompt content available."}
            </pre>
          </div>

          <div>
            <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
              System Prompt
            </div>

            <pre className="min-h-64 whitespace-pre-wrap rounded-control border border-border bg-background p-5 font-mono text-sm leading-7 text-ink">
              {latestVersion?.system_prompt ||
                "No system prompt defined."}
            </pre>
          </div>

        </div>
      </section>

      {/* Execution Sandbox */}
      <section className="rounded-card border border-border bg-surface shadow-subtle">

        <div className="border-b border-border px-6 py-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold">
                  Execution Sandbox
                </h2>

                {latestVersion && (
                  <span className="rounded-pill bg-background px-2.5 py-1 font-mono text-xs font-semibold text-muted">
                    v{latestVersion.version_number}
                  </span>
                )}
              </div>

              <p className="mt-1 text-sm text-muted">
                Run this prompt against a local language model.
              </p>
            </div>

            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              Local inference
            </span>

          </div>
        </div>

        <form onSubmit={handleRunExperiment} className="p-6">

          <div className="grid gap-6 lg:grid-cols-[220px_1fr]">

            {/* Model */}
            <div>
              <label className="mb-2 block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                Model
              </label>

              <select
                value={selectedModel}
                onChange={(event) =>
                  setSelectedModel(event.target.value)
                }
                className="w-full rounded-control border border-border bg-background px-3 py-3 text-sm font-medium outline-none focus:border-brand"
              >
                {availableModels.map((model) => (
                  <option
                    key={model.value}
                    value={model.value}
                  >
                    {model.label}
                  </option>
                ))}
              </select>

              <p className="mt-2 text-xs leading-5 text-muted">
                Running locally through Ollama.
              </p>
            </div>

            {/* Input */}
            <div>
              <label className="mb-2 block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                Test Input
              </label>

              <textarea
                value={executionInput}
                onChange={(event) =>
                  setExecutionInput(event.target.value)
                }
                rows={7}
                placeholder="Enter the input you want to test against this prompt..."
                className="w-full resize-y rounded-control border border-border bg-background px-4 py-3 font-mono text-sm leading-6 outline-none focus:border-brand"
              />

              <div className="mt-3 flex justify-end">

                <button
                  type="submit"
                  disabled={
                    executionLoading ||
                    !latestVersion
                  }
                  className="rounded-control bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {executionLoading
                    ? "Running..."
                    : "Run Prompt →"}
                </button>

              </div>
            </div>

          </div>
        </form>

        {/* Execution error */}
        {executionError && (
          <div className="mx-6 mb-6 rounded-control border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
            {executionError}
          </div>
        )}

        {/* Execution Result */}
        {execution && (
          <div className="border-t border-border">

            <div className="flex flex-col gap-3 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between">

              <div>
                <div className="flex items-center gap-3">

                  <h3 className="text-base font-semibold">
                    Response
                  </h3>

                  <span className="rounded-pill bg-success/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-success">
                    {execution.status}
                  </span>

                </div>

                <p className="mt-1 text-xs text-muted">
                  {execution.model} · v{execution.version_number}
                </p>
              </div>

              <span className="font-mono text-[10px] text-muted">
                Run #{execution.id}
              </span>

            </div>

            {/* Output */}
            <div className="p-6">

              <div className="rounded-control border border-border bg-background p-5">

                <p className="whitespace-pre-wrap text-sm leading-7 text-ink">
                  {execution.output_text ||
                    "No output was returned."}
                </p>

              </div>

              {/* Metrics */}
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

                <div className="rounded-control border border-border bg-surface p-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                    Duration
                  </p>

                  <p className="mt-2 font-mono text-sm font-semibold">
                    {formatDuration(execution.total_duration)}
                  </p>
                </div>

                <div className="rounded-control border border-border bg-surface p-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                    Input Tokens
                  </p>

                  <p className="mt-2 font-mono text-sm font-semibold">
                    {execution.prompt_eval_count ?? "—"}
                  </p>
                </div>

                <div className="rounded-control border border-border bg-surface p-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                    Output Tokens
                  </p>

                  <p className="mt-2 font-mono text-sm font-semibold">
                    {execution.eval_count ?? "—"}
                  </p>
                </div>

                <div className="rounded-control border border-border bg-surface p-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                    Output Speed
                  </p>

                  <p className="mt-2 font-mono text-sm font-semibold">
                    {calculateTokensPerSecond(
                      execution.eval_count,
                      execution.total_duration
                    )}
                  </p>
                </div>

              </div>

            </div>

          </div>
        )}

      </section>

      {/* New Version */}
      {showNewVersion && (
        <section className="rounded-card border border-brand/30 bg-surface shadow-subtle">

          <div className="border-b border-border px-6 py-5">
            <h2 className="text-lg font-semibold">
              Create New Version
            </h2>

            <p className="mt-1 text-sm text-muted">
              Create a new version without overwriting previous versions.
            </p>
          </div>

          <form
            onSubmit={handleCreateVersion}
            className="space-y-5 p-6"
          >

            <div>
              <label className="mb-2 block text-sm font-semibold">
                Prompt Content
              </label>

              <textarea
                value={versionContent}
                onChange={(event) =>
                  setVersionContent(event.target.value)
                }
                rows={9}
                placeholder="Write the updated prompt..."
                className="w-full resize-y rounded-control border border-border bg-background px-4 py-3 font-mono text-sm leading-6 outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">
                System Prompt
              </label>

              <textarea
                value={versionSystemPrompt}
                onChange={(event) =>
                  setVersionSystemPrompt(event.target.value)
                }
                rows={5}
                placeholder="Optional system instructions..."
                className="w-full resize-y rounded-control border border-border bg-background px-4 py-3 font-mono text-sm leading-6 outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">
                Change Summary
              </label>

              <input
                value={changeSummary}
                onChange={(event) =>
                  setChangeSummary(event.target.value)
                }
                placeholder="Example: Added a concise response constraint"
                className="w-full rounded-control border border-border bg-background px-4 py-3 text-sm outline-none focus:border-brand"
              />
            </div>

            <div className="flex justify-end gap-3">

              <button
                type="button"
                onClick={() => setShowNewVersion(false)}
                className="rounded-control border border-border bg-surface px-4 py-2.5 text-sm font-semibold"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={creatingVersion}
                className="rounded-control bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creatingVersion
                  ? "Creating..."
                  : "Create Version"}
              </button>

            </div>

          </form>
        </section>
      )}

      {/* Version History */}
      <section>

        <div className="mb-5 flex items-end justify-between">

          <div>
            <h2 className="font-serif text-3xl">
              Version History
            </h2>

            <p className="mt-1 text-sm text-muted">
              Every saved version of this experiment.
            </p>
          </div>

          <span className="font-mono text-xs text-muted">
            {versions.length} version
            {versions.length === 1 ? "" : "s"}
          </span>

        </div>

        {versionsLoading ? (
          <div className="rounded-card border border-border bg-surface p-6 text-sm text-muted">
            Loading version history...
          </div>
        ) : versions.length === 0 ? (
          <div className="rounded-card border border-border bg-surface p-8 text-center text-muted">
            No version history available.
          </div>
        ) : (
          <div className="space-y-3">

            {versions.map((version) => (
              <article
                key={version.id}
                className="rounded-card border border-border bg-surface p-5 shadow-subtle transition-shadow hover:shadow-raised"
              >

                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

                  <div>

                    <div className="flex items-center gap-3">

                      <span className="rounded-pill bg-background px-2.5 py-1 font-mono text-xs font-semibold">
                        v{version.version_number}
                      </span>

                      {latestVersion &&
                        version.version_number ===
                          latestVersion.version_number && (
                          <span className="rounded-pill bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                            Current
                          </span>
                        )}

                    </div>

                    {version.change_summary && (
                      <p className="mt-3 text-sm font-medium">
                        {version.change_summary}
                      </p>
                    )}

                    <p className="mt-1 text-xs text-muted">
                      Created {formatDate(version.created_at)}
                    </p>

                  </div>

                  <div className="max-w-2xl">
                    <p className="line-clamp-3 whitespace-pre-wrap font-mono text-xs leading-6 text-muted">
                      {version.content}
                    </p>
                  </div>

                </div>

              </article>
            ))}

          </div>
        )}
      </section>

    </div>
  );
}