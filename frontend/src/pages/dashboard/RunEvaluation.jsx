import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import {
  createEvaluationRun,
  getEvaluationDatasets,
  getPromptsForEvaluation,
  getPromptVersionsForEvaluation,
  pollEvaluationRun,
} from "../../services/evaluationService";
import ModelSelector from "../../components/dashboard/ModelSelector";
import { useInstalledModels } from "../../hooks/useInstalledModels";

function unwrapList(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  return [];
}

function formatDuration(nanoseconds) {
  if (
    nanoseconds === null ||
    nanoseconds === undefined
  ) {
    return "—";
  }

  const seconds =
    Number(nanoseconds) / 1_000_000_000;

  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;

  return `${minutes}m ${remaining.toFixed(1)}s`;
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusClasses(status) {
  switch (status) {
    case "completed":
      return "bg-success/10 text-success";

    case "failed":
      return "bg-error/10 text-error";

    case "running":
      return "bg-warning/10 text-warning";

    default:
      return "bg-border text-muted";
  }
}

function scoreClasses(score) {
  const numericScore = Number(score);

  if (Number.isNaN(numericScore)) {
    return "text-muted";
  }

  if (numericScore >= 70) {
    return "text-success";
  }

  return "text-error";
}

function LoadingBlock() {
  return (
    <div className="flex min-h-[360px] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-border border-t-brand" />

        <p className="mt-4 text-sm text-muted">
          Loading evaluation workspace...
        </p>
      </div>
    </div>
  );
}

export default function RunEvaluation() {
  const [prompts, setPrompts] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [versions, setVersions] = useState([]);

  const [selectedPromptId, setSelectedPromptId] =
    useState("");

  const [selectedVersionId, setSelectedVersionId] =
    useState("");

  const [selectedDatasetId, setSelectedDatasetId] =
    useState("");

  const {
    models: installedModels,
    loading: modelsLoading,
    error: modelsError,
    retry: retryModels,
    defaultModel,
  } = useInstalledModels();

  const [userModel, setUserModel] = useState(null);
  const model =
    userModel &&
    installedModels.some(
      (m) => m.name === userModel || m.model === userModel
    )
      ? userModel
      : defaultModel;

  const [loading, setLoading] = useState(true);
  const [loadingVersions, setLoadingVersions] =
    useState(false);

  const [running, setRunning] = useState(false);

  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    async function loadInitialData() {
      try {
        setError("");

        const [
          promptsData,
          datasetsData,
        ] = await Promise.all([
          getPromptsForEvaluation(),
          getEvaluationDatasets(),
        ]);

        const promptList =
          unwrapList(promptsData);

        const datasetList =
          unwrapList(datasetsData);

        setPrompts(promptList);
        setDatasets(datasetList);
      } catch (err) {
        console.error(err);

        setError(
          err.message ||
            "Unable to load evaluation data."
        );
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, []);

  useEffect(() => {
    if (!selectedPromptId) {
      setVersions([]);
      setSelectedVersionId("");
      return;
    }

    async function loadVersions() {
      try {
        setLoadingVersions(true);
        setError("");

        const data =
          await getPromptVersionsForEvaluation(
            selectedPromptId
          );

        const versionList = unwrapList(data);

        setVersions(versionList);

        if (versionList.length > 0) {
          setSelectedVersionId(
            String(versionList[0].id)
          );
        } else {
          setSelectedVersionId("");
        }
      } catch (err) {
        console.error(err);

        setVersions([]);
        setSelectedVersionId("");

        setError(
          err.message ||
            "Unable to load prompt versions."
        );
      } finally {
        setLoadingVersions(false);
      }
    }

    loadVersions();
  }, [selectedPromptId]);

  const selectedPrompt = useMemo(() => {
    return prompts.find(
      (prompt) =>
        String(prompt.id) ===
        String(selectedPromptId)
    );
  }, [prompts, selectedPromptId]);

  const selectedVersion = useMemo(() => {
    return versions.find(
      (version) =>
        String(version.id) ===
        String(selectedVersionId)
    );
  }, [versions, selectedVersionId]);

  const selectedDataset = useMemo(() => {
    return datasets.find(
      (dataset) =>
        String(dataset.id) ===
        String(selectedDatasetId)
    );
  }, [datasets, selectedDatasetId]);

  const canRun =
    selectedPromptId &&
    selectedVersionId &&
    selectedDatasetId &&
    model &&
    installedModels.length > 0 &&
    !modelsLoading &&
    !modelsError &&
    !running &&
    selectedDataset &&
    Number(selectedDataset.test_case_count || 0) >
      0;

  const [progressStatus, setProgressStatus] = useState("");
  const abortControllerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  async function handleRunEvaluation(event) {
    event.preventDefault();

    if (!canRun) {
      return;
    }

    try {
      setRunning(true);
      setError("");
      setResult(null);
      setProgressStatus("Starting evaluation...");

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      const initialRun = await createEvaluationRun({
        prompt_version: Number(selectedVersionId),
        dataset: Number(selectedDatasetId),
        model: model.trim(),
      });

      let finalRun = initialRun;
      if (initialRun.status !== "completed" && initialRun.status !== "failed") {
        const total = initialRun.total_cases || selectedDataset?.test_case_count || "";
        setProgressStatus(
          total ? `Evaluating test cases (0 of ${total})...` : "Evaluating test cases..."
        );

        finalRun = await pollEvaluationRun(initialRun.id, {
          signal: abortControllerRef.current.signal,
          onProgress: (inProgressRun) => {
            const completedCount =
              (inProgressRun.passed_cases || 0) + (inProgressRun.failed_cases || 0);
            setProgressStatus(
              `Evaluating test cases (${completedCount} of ${inProgressRun.total_cases})...`
            );
          },
        });
      }

      setResult(finalRun);
    } catch (err) {
      if (err.name === "AbortError") {
        return;
      }
      console.error(err);

      setError(
        err.message ||
          "Unable to start or complete the evaluation."
      );
    } finally {
      setRunning(false);
      setProgressStatus("");
    }
  }

  if (loading) {
    return <LoadingBlock />;
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <Link
          to="/dashboard/evaluations"
          className="inline-flex w-fit items-center gap-2 text-xs font-medium text-muted transition-standard hover:text-ink"
        >
          <svg
            width="14"
            height="14"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.75"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 18l-6-6 6-6"
            />
          </svg>
          Back to evaluations
        </Link>

        <div>
          <h1 className="font-serif text-4xl tracking-tight text-ink">
            Run a prompt against a test set.
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Select a prompt version and a repeatable
            evaluation dataset. Prompt Lab will execute
            every test case and score the resulting
            responses.
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {/* Configuration */}
      {!result && (
        <form
          onSubmit={handleRunEvaluation}
          className="grid gap-6 xl:grid-cols-[1fr_0.7fr]"
        >
          {/* Left */}
          <div className="rounded-xl border border-border bg-surface p-6">
            <div className="mb-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                Experiment configuration
              </p>

              <h2 className="mt-1 font-serif text-2xl text-ink">
                Define the evaluation
              </h2>
            </div>

            <div className="space-y-5">
              {/* Prompt */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink">
                  Prompt
                </label>

                <select
                  value={selectedPromptId}
                  onChange={(event) =>
                    setSelectedPromptId(
                      event.target.value
                    )
                  }
                  disabled={running}
                  className="w-full rounded-control border border-border bg-background px-3 py-2.5 text-sm text-ink outline-none transition-standard focus:border-brand disabled:opacity-60"
                >
                  <option value="">
                    Select a prompt
                  </option>

                  {prompts.map((prompt) => (
                    <option
                      key={prompt.id}
                      value={prompt.id}
                    >
                      {prompt.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Version */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink">
                  Prompt version
                </label>

                <select
                  value={selectedVersionId}
                  onChange={(event) =>
                    setSelectedVersionId(
                      event.target.value
                    )
                  }
                  disabled={
                    running ||
                    !selectedPromptId ||
                    loadingVersions
                  }
                  className="w-full rounded-control border border-border bg-background px-3 py-2.5 text-sm text-ink outline-none transition-standard focus:border-brand disabled:opacity-60"
                >
                  <option value="">
                    {loadingVersions
                      ? "Loading versions..."
                      : "Select a version"}
                  </option>

                  {versions.map((version) => (
                    <option
                      key={version.id}
                      value={version.id}
                    >
                      v{version.version_number}
                    </option>
                  ))}
                </select>

                {selectedVersion && (
                  <p className="mt-2 text-xs text-muted">
                    Version created{" "}
                    {formatDate(
                      selectedVersion.created_at
                    )}
                  </p>
                )}
              </div>

              {/* Dataset */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink">
                  Evaluation dataset
                </label>

                <select
                  value={selectedDatasetId}
                  onChange={(event) =>
                    setSelectedDatasetId(
                      event.target.value
                    )
                  }
                  disabled={running}
                  className="w-full rounded-control border border-border bg-background px-3 py-2.5 text-sm text-ink outline-none transition-standard focus:border-brand disabled:opacity-60"
                >
                  <option value="">
                    Select a dataset
                  </option>

                  {datasets.map((dataset) => (
                    <option
                      key={dataset.id}
                      value={dataset.id}
                    >
                      {dataset.name} ·{" "}
                      {dataset.test_case_count} test
                      cases
                    </option>
                  ))}
                </select>

                {selectedDataset &&
                  Number(
                    selectedDataset.test_case_count ||
                      0
                  ) === 0 && (
                    <p className="mt-2 text-xs text-error">
                      This dataset has no test cases.
                    </p>
                  )}
              </div>

              {/* Model */}
              <div>
                <ModelSelector
                  label="Model"
                  labelClassName="mb-1.5 block text-xs font-medium text-ink"
                  selectClassName="w-full rounded-control border border-border bg-background px-3 py-2.5 text-sm text-ink outline-none transition-standard focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                  value={model}
                  onChange={setUserModel}
                  models={installedModels}
                  loading={modelsLoading}
                  error={modelsError}
                  onRetry={retryModels}
                  disabled={running}
                  helperText="Local Ollama model"
                />
              </div>
            </div>

            {/* Run */}
            <div className="mt-7 border-t border-border pt-5">
              <button
                type="submit"
                disabled={!canRun}
                className="inline-flex w-full items-center justify-center gap-2 rounded-control bg-brand px-4 py-3 text-sm font-medium text-white transition-standard hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {running ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    {progressStatus || "Running evaluation..."}
                  </>
                ) : (
                  <>
                    <svg
                      width="14"
                      height="14"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 3l14 9-14 9V3z"
                      />
                    </svg>
                    Run Evaluation
                  </>
                )}
              </button>

              <p className="mt-3 text-center text-[11px] leading-5 text-muted">
                Every test case will be executed and
                evaluated. This may take some time for
                larger datasets.
              </p>
            </div>
          </div>

          {/* Right preview */}
          <div className="rounded-xl border border-border bg-surface p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              Run preview
            </p>

            <div className="mt-5 space-y-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted">
                  Prompt
                </p>

                <p className="mt-1 text-sm font-medium text-ink">
                  {selectedPrompt?.title ||
                    "Not selected"}
                </p>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted">
                  Version
                </p>

                <p className="mt-1 font-mono text-sm text-ink">
                  {selectedVersion
                    ? `v${selectedVersion.version_number}`
                    : "—"}
                </p>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted">
                  Dataset
                </p>

                <p className="mt-1 text-sm font-medium text-ink">
                  {selectedDataset?.name ||
                    "Not selected"}
                </p>

                {selectedDataset && (
                  <p className="mt-1 text-xs text-muted">
                    {selectedDataset.test_case_count}{" "}
                    test cases
                  </p>
                )}
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted">
                  Model
                </p>

                <p className="mt-1 font-mono text-sm text-ink">
                  {model || "—"}
                </p>
              </div>

              <div className="rounded-lg border border-dashed border-border bg-background p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-brand">
                  Evaluation flow
                </p>

                <div className="mt-3 space-y-2 text-sm text-muted">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-brand">
                      01
                    </span>
                    Execute test cases
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono text-brand">
                      02
                    </span>
                    Generate responses
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono text-brand">
                      03
                    </span>
                    Score each response
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono text-brand">
                      04
                    </span>
                    Aggregate results
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="rounded-xl border border-border bg-surface p-6">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brand">
                  Evaluation complete
                </p>

                <h2 className="mt-1 font-serif text-3xl text-ink">
                  Evaluation #{result.id}
                </h2>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
                  <span>
                    {result.prompt_title} · v{result.version_number} · {result.dataset_name}
                  </span>
                  {result.prompt_status && (
                    <span className="rounded-full bg-brand/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-brand font-semibold">
                      Prompt: {result.prompt_status}
                    </span>
                  )}
                </div>
              </div>

              <span
                className={`w-fit rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] ${statusClasses(
                  result.status
                )}`}
              >
                {result.status}
              </span>
            </div>

            {result.error_message && (
              <div className="mt-4 rounded-control border border-error/30 bg-error/10 p-3 text-xs text-error">
                {result.error_message}
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-background p-4">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted">
                  Overall score
                </p>

                <p
                  className={`mt-2 font-mono text-2xl font-semibold ${scoreClasses(
                    result.overall_score
                  )}`}
                >
                  {result.overall_score ??
                    "—"}
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-4">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted">
                  Test cases
                </p>

                <p className="mt-2 font-mono text-2xl font-semibold text-ink">
                  {result.total_cases}
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-4">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted">
                  Passed
                </p>

                <p className="mt-2 font-mono text-2xl font-semibold text-success">
                  {result.passed_cases}
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-4">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted">
                  Duration
                </p>

                <p className="mt-2 font-mono text-2xl font-semibold text-ink">
                  {formatDuration(
                    result.total_duration
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="rounded-xl border border-border bg-surface p-6">
            <div className="mb-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                Test results
              </p>

              <h2 className="mt-1 font-serif text-2xl text-ink">
                Case-by-case evaluation
              </h2>
            </div>

            <div className="space-y-4">
              {(result.results || []).map(
                (item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-border bg-background p-5"
                  >
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-ink">
                            {item.test_case_name}
                          </h3>

                          <span
                            className={`rounded-full px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] ${
                              item.status ===
                              "passed"
                                ? "bg-success/10 text-success"
                                : "bg-error/10 text-error"
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>

                        <p className="mt-1 font-mono text-[10px] text-muted">
                          Test case #{item.test_case}
                          {" · "}
                          Execution #{item.execution_id}
                        </p>
                      </div>

                      <div className="text-left md:text-right">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-muted">
                          Score
                        </p>

                        <p
                          className={`mt-1 font-mono text-2xl font-semibold ${scoreClasses(
                            item.score
                          )}`}
                        >
                          {item.score ??
                            "—"}
                        </p>
                      </div>
                    </div>

                    {item.criteria_scores &&
                      Object.keys(
                        item.criteria_scores
                      ).length > 0 && (
                        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                          {Object.entries(
                            item.criteria_scores
                          ).map(
                            ([
                              criterion,
                              value,
                            ]) => (
                              <div
                                key={criterion}
                                className="rounded-md border border-border bg-surface p-3"
                              >
                                <p className="truncate text-[10px] uppercase tracking-[0.1em] text-muted">
                                  {criterion.replace(
                                    /_/g,
                                    " "
                                  )}
                                </p>

                                <p className="mt-1 font-mono text-sm font-semibold text-ink">
                                  {value}
                                </p>
                              </div>
                            )
                          )}
                        </div>
                      )}

                    {item.feedback && (
                      <div className="mt-5 border-t border-border pt-4">
                        <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                          Feedback
                        </p>

                        <p className="text-sm leading-6 text-muted">
                          {item.feedback}
                        </p>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to={`/dashboard/evaluations/runs/${result.id}`}
              className="inline-flex items-center justify-center rounded-control border border-border bg-surface px-4 py-2.5 text-sm font-medium text-ink hover:border-ink"
            >
              Open full result
            </Link>

            <button
              type="button"
              onClick={() => setResult(null)}
              className="inline-flex items-center justify-center rounded-control bg-brand px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              Run another evaluation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}