import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  getPrompt,
  getPromptVersions,
  updatePrompt,
  createPromptVersion,
} from "../../services/promptService";

import { useExecution } from "../../context/ExecutionContext";
import { deleteExecution } from "../../services/executionService";
import ModelSelector from "../../components/dashboard/ModelSelector";
import { useInstalledModels } from "../../hooks/useInstalledModels";

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
  const [searchParams, setSearchParams] = useSearchParams();

  const [prompt, setPrompt] = useState(null);
  const [versions, setVersions] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [versionsLoading, setVersionsLoading] = useState(true);

  const [error, setError] = useState("");

  const [status, setStatus] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [lifecycleNotice, setLifecycleNotice] = useState("");

  const [showNewVersion, setShowNewVersion] = useState(false);
  const [shouldScrollToVersion, setShouldScrollToVersion] = useState(false);
  const newVersionRef = useRef(null);

  useEffect(() => {
    if (shouldScrollToVersion && showNewVersion && newVersionRef.current) {
      const frameId = requestAnimationFrame(() => {
        newVersionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
      setShouldScrollToVersion(false);
      return () => cancelAnimationFrame(frameId);
    }
  }, [shouldScrollToVersion, showNewVersion]);

  function handleOpenNewVersion() {
    if (showNewVersion) {
      newVersionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } else {
      setShowNewVersion(true);
      setShouldScrollToVersion(true);
    }
  }

  const [versionContent, setVersionContent] = useState("");
  const [versionSystemPrompt, setVersionSystemPrompt] = useState("");
  const [changeSummary, setChangeSummary] = useState("");
  const [creatingVersion, setCreatingVersion] = useState(false);

  // Execution state & installed models
  const {
    models: installedModels,
    loading: modelsLoading,
    error: modelsError,
    retry: retryModels,
    defaultModel,
  } = useInstalledModels();

  const [userModel, setUserModel] = useState(null);
  const selectedModel =
    userModel &&
    installedModels.some(
      (m) => m.name === userModel || m.model === userModel
    )
      ? userModel
      : defaultModel;

  const {
    getExecutionState,
    runExecution,
    getPromptInputText,
    setPromptInputText,
    clearShouldScroll,
    clearExecution,
  } = useExecution();

  const [copiedResponse, setCopiedResponse] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingExecution, setDeletingExecution] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const executionState = getExecutionState(id);
  const execution = executionState?.result || null;
  const executionLoading = Boolean(executionState?.loading);

  const [localExecutionError, setLocalExecutionError] = useState("");
  const executionError = localExecutionError || executionState?.error || "";

  const executionInput = getPromptInputText(id);

  const responseRef = useRef(null);

  // Issue 2: Smoothly scroll to the rendered response section after execution completes
  useEffect(() => {
    if (
      executionState?.shouldScrollResponse &&
      executionState?.result &&
      responseRef.current
    ) {
      const timer = setTimeout(() => {
        responseRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        clearShouldScroll(id);
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [
    executionState?.shouldScrollResponse,
    executionState?.result,
    clearShouldScroll,
    id,
  ]);

  // Synchronize draft -> testing transition if execution finishes while on or returning to this page
  useEffect(() => {
    let cancelled = false;
    if (
      prompt?.status === "draft" &&
      executionState?.status === "completed"
    ) {
      (async () => {
        try {
          const fresh = await getPrompt(id);
          if (!cancelled && fresh) {
            setPrompt(fresh);
            setStatus(fresh.status);
          }
        } catch {
          // ignore
        }
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [id, prompt?.status, executionState?.status]);

  useEffect(() => {
    loadPrompt();
    loadVersions();
  }, [id]);

  // Synchronize selectedVersionId from URL search param or default to latest
  useEffect(() => {
    if (versions.length > 0) {
      const versionNumParam = searchParams.get("version");
      const versionIdParam = searchParams.get("versionId");

      if (versionNumParam) {
        const found = versions.find(
          (v) => String(v.version_number) === String(versionNumParam)
        );
        if (found) {
          setSelectedVersionId(found.id);
          return;
        }
      }

      if (versionIdParam) {
        const found = versions.find(
          (v) => String(v.id) === String(versionIdParam)
        );
        if (found) {
          setSelectedVersionId(found.id);
          return;
        }
      }

      // Default to latest version if not already set or invalid
      if (!selectedVersionId) {
        const defaultVer = prompt?.latest_version
          ? versions.find((v) => v.id === prompt.latest_version.id) || versions[0]
          : versions[0];
        if (defaultVer) {
          setSelectedVersionId(defaultVer.id);
        }
      }
    }
  }, [versions, searchParams, prompt, selectedVersionId]);

  const latestVersion = prompt?.latest_version;

  const activeVersion = useMemo(() => {
    if (selectedVersionId && versions.length > 0) {
      const found = versions.find((v) => v.id === Number(selectedVersionId));
      if (found) return found;
    }
    return latestVersion || (versions.length > 0 ? versions[0] : null);
  }, [selectedVersionId, versions, latestVersion]);

  function handleSelectVersion(targetVersion, shouldScrollToSandbox = false) {
    if (!targetVersion) return;
    setSelectedVersionId(targetVersion.id);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("version", String(targetVersion.version_number));
      return next;
    });

    if (shouldScrollToSandbox) {
      const el = document.getElementById("execution-sandbox");
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 80);
      }
    }
  }

  useEffect(() => {
    if (
      !loading &&
      (window.location.hash === "#execution-sandbox" ||
        window.location.hash === "#sandbox")
    ) {
      const el = document.getElementById("execution-sandbox");
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 150);
      }
    }
  }, [loading]);

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

  async function handleUpdateLifecycleStatus(newStatus) {
    try {
      setSavingStatus(true);
      setError("");
      setLifecycleNotice("");

      const updated = await updatePrompt(id, {
        status: newStatus,
      });

      setPrompt(updated);
      setStatus(updated.status);

      if (newStatus === "production") {
        setLifecycleNotice("Prompt successfully marked as Production.");
      } else if (newStatus === "archived") {
        setLifecycleNotice("Prompt has been archived.");
      } else if (newStatus === "testing") {
        setLifecycleNotice("Prompt moved to Testing.");
      }
    } catch (err) {
      setError(err.message || "Failed to update prompt status.");
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

      const hadProductionStatus = prompt?.status === "production";
      await loadPrompt();
      await loadVersions();

      if (hadProductionStatus) {
        setLifecycleNotice(
          "New version created — prompt automatically moved from Production back to Testing for validation."
        );
      }
    } catch (err) {
      setError(err.message || "Failed to create new version.");
    } finally {
      setCreatingVersion(false);
    }
  }

  function handleCopyResponse() {
    if (!execution?.output_text) return;
    setCopyError("");

    if (!navigator.clipboard?.writeText) {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = execution.output_text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        setCopiedResponse(true);
        setTimeout(() => setCopiedResponse(false), 2000);
      } catch {
        setCopyError("Failed to copy response to clipboard.");
        setTimeout(() => setCopyError(""), 3000);
      }
      return;
    }

    navigator.clipboard
      .writeText(execution.output_text)
      .then(() => {
        setCopiedResponse(true);
        setTimeout(() => setCopiedResponse(false), 2000);
      })
      .catch((err) => {
        console.error("Failed to copy:", err);
        setCopyError("Failed to copy response to clipboard.");
        setTimeout(() => setCopyError(""), 3000);
      });
  }

  async function handleConfirmDeleteExecution() {
    if (!execution?.id) return;
    try {
      setDeletingExecution(true);
      setDeleteError("");
      await deleteExecution(execution.id);
      clearExecution(id);
      setShowDeleteConfirm(false);
      setLifecycleNotice(`Execution #${execution.id} was deleted from history.`);
    } catch (err) {
      console.error("Failed to delete execution:", err);
      setDeleteError(err.message || "Failed to delete execution.");
    } finally {
      setDeletingExecution(false);
    }
  }

  async function handleRunExperiment(event) {
    event.preventDefault();
    setLocalExecutionError("");

    if (!activeVersion) {
      setLocalExecutionError(
        "This prompt does not have a version that can be executed."
      );
      return;
    }

    if (!selectedModel) {
      setLocalExecutionError("Please select an installed Ollama model to execute.");
      return;
    }

    const trimmedInput = executionInput.trim();
    if (!trimmedInput) {
      setLocalExecutionError("Please enter something to test.");
      return;
    }

    const outcome = await runExecution({
      promptId: id,
      promptTitle: prompt?.title || `Prompt #${id}`,
      versionId: activeVersion.id,
      versionNumber: activeVersion.version_number,
      model: selectedModel,
      inputText: trimmedInput,
    });

    if (outcome?.success && outcome.result) {
      const result = outcome.result;
      if (
        prompt?.status === "draft" &&
        (result.prompt_status === "testing" || result.status === "completed")
      ) {
        setPrompt((prev) => ({ ...prev, status: "testing" }));
        setStatus("testing");
        setLifecycleNotice(
          "Prompt automatically transitioned from Draft to Testing after successful execution."
        );
      }
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

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status Badge */}
            <span
              className={`rounded-pill border px-3 py-1.5 text-xs font-semibold ${currentStatus.className}`}
            >
              {currentStatus.label}
            </span>

            {/* Lifecycle Action: Promote to Production when in Testing */}
            {status === "testing" && (
              <button
                type="button"
                disabled={savingStatus}
                onClick={() => handleUpdateLifecycleStatus("production")}
                className="inline-flex items-center gap-1.5 rounded-control bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-subtle hover:bg-emerald-700 transition-colors disabled:opacity-50"
                title="Mark this tested prompt as ready for Production"
              >
                <svg
                  width="12"
                  height="12"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {savingStatus ? "Saving..." : "Mark as Production"}
              </button>
            )}

            {/* Lifecycle Action: Demote from Production to Testing if manual re-test desired */}
            {status === "production" && (
              <button
                type="button"
                disabled={savingStatus}
                onClick={() => handleUpdateLifecycleStatus("testing")}
                className="inline-flex items-center gap-1.5 rounded-control border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted hover:border-brand hover:text-brand transition-colors disabled:opacity-50"
                title="Return prompt to Testing status"
              >
                Move to Testing
              </button>
            )}

            {/* Lifecycle Action: Archive / Restore */}
            {status !== "archived" ? (
              <button
                type="button"
                disabled={savingStatus}
                onClick={() => handleUpdateLifecycleStatus("archived")}
                className="rounded-control border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-muted hover:border-rose-400 hover:text-rose-600 transition-colors disabled:opacity-50"
                title="Archive prompt"
              >
                Archive
              </button>
            ) : (
              <button
                type="button"
                disabled={savingStatus}
                onClick={() => handleUpdateLifecycleStatus("testing")}
                className="rounded-control border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-brand hover:bg-brand/5 transition-colors disabled:opacity-50"
                title="Restore prompt to Testing"
              >
                Restore to Testing
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lifecycle Transition Notice */}
      {lifecycleNotice && (
        <div className="flex items-center justify-between rounded-card border border-brand/30 bg-brand/5 p-3.5 text-xs font-medium text-brand">
          <div className="flex items-center gap-2">
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{lifecycleNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setLifecycleNotice("")}
            className="text-muted hover:text-ink text-xs p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-card border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {/* Active Version Inspector */}
      <section className="rounded-card border border-border bg-surface shadow-subtle">

        <div className="flex flex-col gap-4 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between">

          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold">
                Prompt Version
              </h2>

              {activeVersion && (
                <span
                  className={`rounded-pill px-2.5 py-1 font-mono text-xs font-semibold ${
                    latestVersion && activeVersion.id === latestVersion.id
                      ? "bg-ink text-white"
                      : "border border-amber-300 bg-amber-50 text-amber-900"
                  }`}
                >
                  v{activeVersion.version_number}
                  {latestVersion && activeVersion.id === latestVersion.id
                    ? " · Latest"
                    : " · Historical"}
                </span>
              )}

              {/* Version Switcher */}
              {versions.length > 1 && (
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <label htmlFor="version-inspector-select" className="sr-only">
                    Select version to inspect
                  </label>
                  <select
                    id="version-inspector-select"
                    value={activeVersion?.id || ""}
                    onChange={(event) => {
                      const found = versions.find(
                        (v) => v.id === Number(event.target.value)
                      );
                      if (found) handleSelectVersion(found);
                    }}
                    className="rounded-control border border-border bg-background px-2.5 py-1 font-mono text-xs font-medium text-ink outline-none focus:border-brand"
                  >
                    {versions.map((ver) => (
                      <option key={ver.id} value={ver.id}>
                        v{ver.version_number}{" "}
                        {latestVersion && ver.id === latestVersion.id
                          ? "(Latest)"
                          : "(Historical)"}
                        {ver.change_summary ? ` — ${ver.change_summary}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <p className="mt-1 text-sm text-muted">
              {activeVersion ? (
                <>
                  Created {formatDate(activeVersion.created_at)}
                  {activeVersion.change_summary && (
                    <span className="ml-2 font-medium text-ink">
                      · &ldquo;{activeVersion.change_summary}&rdquo;
                    </span>
                  )}
                </>
              ) : (
                "No version available."
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {activeVersion && (
              <button
                type="button"
                onClick={() => handleSelectVersion(activeVersion, true)}
                className="rounded-control border border-border bg-background px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-brand hover:text-brand"
              >
                Open in Sandbox ↓
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenNewVersion}
              className="rounded-control bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              + New Version
            </button>
          </div>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-2">

          <div>
            <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
              Prompt Template (v{activeVersion?.version_number || "—"})
            </div>

            <pre className="min-h-64 whitespace-pre-wrap rounded-control border border-border bg-background p-5 font-mono text-sm leading-7 text-ink">
              {activeVersion?.content ||
                "No prompt content available."}
            </pre>
          </div>

          <div>
            <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
              System Prompt
            </div>

            <pre className="min-h-64 whitespace-pre-wrap rounded-control border border-border bg-background p-5 font-mono text-sm leading-7 text-ink">
              {activeVersion?.system_prompt ||
                "No system prompt defined."}
            </pre>
          </div>

        </div>
      </section>

      {/* Execution Sandbox */}
      <section
        id="execution-sandbox"
        className="scroll-mt-20 rounded-card border border-border bg-surface shadow-subtle"
      >

        <div className="border-b border-border px-6 py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-semibold">
                  Execution Sandbox
                </h2>

                {activeVersion && (
                  <span
                    className={`rounded-pill px-2.5 py-1 font-mono text-xs font-semibold ${
                      latestVersion && activeVersion.id === latestVersion.id
                        ? "bg-background text-muted"
                        : "border border-amber-300 bg-amber-50 text-amber-900"
                    }`}
                  >
                    Testing v{activeVersion.version_number}
                    {latestVersion && activeVersion.id === latestVersion.id
                      ? " (Latest)"
                      : " (Historical)"}
                  </span>
                )}
              </div>

              <p className="mt-1 text-sm text-muted">
                Run prompt version {activeVersion?.version_number || "—"} against a local language model.
              </p>
            </div>

            {/* Version Switcher in Sandbox */}
            {versions.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                  Version:
                </span>
                <select
                  value={activeVersion?.id || ""}
                  onChange={(event) => {
                    const found = versions.find(
                      (v) => v.id === Number(event.target.value)
                    );
                    if (found) handleSelectVersion(found);
                  }}
                  className="rounded-control border border-border bg-background px-3 py-1.5 font-mono text-xs font-medium text-ink outline-none focus:border-brand"
                >
                  {versions.map((ver) => (
                    <option key={ver.id} value={ver.id}>
                      v{ver.version_number}{" "}
                      {latestVersion && ver.id === latestVersion.id
                        ? "(Latest)"
                        : "(Historical)"}
                    </option>
                  ))}
                </select>
              </div>
            )}

          </div>
        </div>

        {/* Historical Version Notice Banner */}
        {activeVersion &&
          latestVersion &&
          activeVersion.id !== latestVersion.id && (
            <div className="flex flex-col gap-2 border-b border-amber-200 bg-amber-50/70 px-6 py-3 text-xs text-amber-900 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold uppercase tracking-wider text-amber-800">
                  Notice:
                </span>
                <span>
                  You are testing historical <strong>Version {activeVersion.version_number}</strong>. The execution run will be saved and recorded against this version.
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleSelectVersion(latestVersion)}
                className="self-start text-xs font-semibold text-amber-900 underline hover:text-amber-950 sm:self-auto"
              >
                Switch to latest (v{latestVersion.version_number})
              </button>
            </div>
          )}

        <form onSubmit={handleRunExperiment} className="p-6">

          <div className="grid gap-6 lg:grid-cols-[220px_1fr]">

            {/* Model */}
            <div>
              <ModelSelector
                value={selectedModel}
                onChange={setUserModel}
                models={installedModels}
                loading={modelsLoading}
                error={modelsError}
                onRetry={retryModels}
                disabled={executionLoading}
                selectClassName="w-full rounded-control border border-border bg-background px-3 py-3 text-sm font-medium outline-none focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            {/* Input */}
            <div>
              <label className="mb-2 block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                Test Input
              </label>

              <textarea
                value={executionInput}
                onChange={(event) => {
                  setPromptInputText(id, event.target.value);
                }}
                disabled={executionLoading}
                rows={7}
                placeholder="Enter the input you want to test against this prompt..."
                className="w-full resize-y rounded-control border border-border bg-background px-4 py-3 font-mono text-sm leading-6 outline-none focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
              />

              <div className="mt-3 flex justify-end">

                <button
                  type="submit"
                  disabled={
                    executionLoading ||
                    !activeVersion ||
                    !selectedModel ||
                    installedModels.length === 0 ||
                    modelsLoading ||
                    !!modelsError
                  }
                  className="rounded-control bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {executionLoading
                    ? "Running..."
                    : `Run Prompt (v${activeVersion?.version_number ?? ""}) →`}
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
          <div ref={responseRef} className="border-t border-border scroll-mt-20">

            <div className="flex flex-col gap-3 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between">

              <div>
                <div className="flex flex-wrap items-center gap-3">

                  <h3 className="text-base font-semibold">
                    Response
                  </h3>

                  <span className="rounded-pill bg-success/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-success">
                    {execution.status}
                  </span>

                  {/* Automatic persistence badge */}
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-0.5 font-mono text-[10px] font-medium text-emerald-800">
                    <svg className="h-3 w-3 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Saved to Execution History
                  </span>

                </div>

                <p className="mt-1 text-xs text-muted">
                  {execution.model} · v{execution.version_number}
                </p>
              </div>

              {/* Response Actions Bar */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 font-mono text-[10px] text-muted">
                  Run #{execution.id}
                </span>

                {/* Copy Response */}
                <button
                  type="button"
                  onClick={handleCopyResponse}
                  className="inline-flex items-center gap-1.5 rounded-control border border-border bg-background px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-neutral-100 hover:text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                  title="Copy generated response to clipboard"
                >
                  {copiedResponse ? (
                    <>
                      <svg className="h-3.5 w-3.5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="font-semibold text-emerald-700">Copied!</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-3.5 w-3.5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                      <span>Copy Response</span>
                    </>
                  )}
                </button>

                {/* Delete Execution */}
                {showDeleteConfirm ? (
                  <div className="inline-flex items-center gap-2 rounded-control border border-rose-300 bg-rose-50/90 px-2.5 py-1 shadow-xs">
                    <span className="text-xs font-medium text-rose-800">Delete this run?</span>
                    <button
                      type="button"
                      disabled={deletingExecution}
                      onClick={handleConfirmDeleteExecution}
                      className="rounded bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                    >
                      {deletingExecution ? "Deleting..." : "Yes, delete"}
                    </button>
                    <button
                      type="button"
                      disabled={deletingExecution}
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteError("");
                      }}
                      className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-xs font-medium text-muted hover:text-ink disabled:opacity-50"
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
                    className="inline-flex items-center gap-1.5 rounded-control border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus:ring-1 focus:ring-rose-500"
                    title="Delete execution from history"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    <span>Delete Execution</span>
                  </button>
                )}
              </div>

            </div>

            {/* Copy error feedback if any */}
            {copyError && (
              <div className="mx-6 mt-4 rounded-control border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800">
                {copyError}
              </div>
            )}

            {/* Delete error feedback if any */}
            {deleteError && (
              <div className="mx-6 mt-4 flex items-center justify-between rounded-control border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-800">
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
        <section
          ref={newVersionRef}
          className="scroll-mt-8 rounded-card border border-brand/30 bg-surface shadow-subtle"
        >

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

            {versions.map((version) => {
              const isSelected = activeVersion && version.id === activeVersion.id;
              const isLatest =
                latestVersion && version.version_number === latestVersion.version_number;

              return (
                <article
                  key={version.id}
                  className={`rounded-card border bg-surface p-5 shadow-subtle transition-all hover:shadow-raised ${
                    isSelected ? "border-brand ring-2 ring-brand/15" : "border-border"
                  }`}
                >

                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

                    <div>

                      <div className="flex items-center gap-3">

                        <span className="rounded-pill bg-background px-2.5 py-1 font-mono text-xs font-semibold">
                          v{version.version_number}
                        </span>

                        {isLatest && (
                          <span className="rounded-pill bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                            Latest
                          </span>
                        )}

                        {isSelected && (
                          <span className="rounded-pill bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
                            Selected
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

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectVersion(version, false);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="rounded-control border border-border bg-background px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-brand hover:text-brand"
                        >
                          View Details ↑
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSelectVersion(version, true)}
                          className="rounded-control border border-brand bg-brand/5 px-3 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-brand hover:text-white"
                        >
                          Open in Sandbox ↓
                        </button>
                      </div>

                    </div>

                    <div className="max-w-2xl">
                      <p className="line-clamp-3 whitespace-pre-wrap font-mono text-xs leading-6 text-muted">
                        {version.content}
                      </p>
                    </div>

                  </div>

                </article>
              );
            })}

          </div>
        )}
      </section>

    </div>
  );
}