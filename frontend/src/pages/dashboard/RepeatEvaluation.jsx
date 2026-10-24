import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  createEvaluationRun,
  getEvaluationDatasets,
  getPromptsForEvaluation,
  getPromptVersionsForEvaluation,
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

function average(values) {
  if (!values.length) {
    return null;
  }
  return (
    values.reduce((sum, value) => sum + value, 0) / values.length
  );
}

function standardDeviation(values) {
  if (!values.length) {
    return null;
  }
  const mean = average(values);
  const variance =
    values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) /
    values.length;
  return Math.sqrt(variance);
}

function formatNumber(value, decimals = 2) {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(Number(value))
  ) {
    return "—";
  }
  return Number(value).toFixed(decimals);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function scoreClass(score) {
  const value = Number(score);
  if (Number.isNaN(value)) return "text-muted";
  if (value >= 70) return "text-success";
  return "text-error";
}

function consistencyRating(deviation) {
  if (deviation === null || Number.isNaN(deviation)) {
    return { label: "N/A", text: "Insufficient data", color: "text-muted" };
  }
  if (deviation < 2.0) {
    return {
      label: "Very Steady",
      text: "Minimal variation between trials",
      color: "text-success",
    };
  }
  if (deviation < 5.0) {
    return {
      label: "Consistent",
      text: "Minor variation across trials",
      color: "text-brand",
    };
  }
  return {
    label: "Variable",
    text: "Significant score fluctuations",
    color: "text-warning",
  };
}

function plainEnglishVariability(summary, runsCount) {
  if (!summary) return "";
  const dev = summary.deviation ?? 0;
  const meanStr = Number(summary.mean || 0).toFixed(1);
  const passStr = Number(summary.passRate || 0).toFixed(1);
  const minStr = Number(summary.min || 0).toFixed(1);
  const maxStr = Number(summary.max || 0).toFixed(1);
  const rangeStr = Number(summary.range || 0).toFixed(1);

  let stabilityDescription = "";
  if (dev < 2.0) {
    stabilityDescription = `Scores remained very stable across all trials, with a narrow spread of ${rangeStr} points between the lowest (${minStr}) and highest (${maxStr}) run.`;
  } else if (dev < 5.0) {
    stabilityDescription = `Scores showed minor variation across trials, ranging from ${minStr} to ${maxStr} (${rangeStr} point spread). The prompt behaves predictably.`;
  } else {
    stabilityDescription = `Scores fluctuated significantly across trials, ranging from ${minStr} to ${maxStr} (${rangeStr} point spread). Output quality on identical inputs varied notably between runs.`;
  }

  return `Tested across ${runsCount} repeated trials: the prompt achieved an average score of ${meanStr}/100 with a ${passStr}% pass rate. ${stabilityDescription}`;
}

function LoadingState() {
  return (
    <div className="flex min-h-[420px] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-border border-t-brand" />
        <p className="mt-4 text-sm text-muted">
          Loading repeatability workspace...
        </p>
      </div>
    </div>
  );
}

export default function RepeatEvaluation() {
  const [prompts, setPrompts] = useState([]);
  const [datasets, setDatasets] = useState([]);

  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [versions, setVersions] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState("");

  const [selectedDatasetId, setSelectedDatasetId] = useState("");
  const [repeatCount, setRepeatCount] = useState(3);

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

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [running, setRunning] = useState(false);
  const [currentRepeat, setCurrentRepeat] = useState(0);

  const [error, setError] = useState("");
  const [runs, setRuns] = useState([]);

  useEffect(() => {
    async function loadInitial() {
      try {
        setLoadingInitial(true);
        setError("");

        const [promptsData, datasetsData] = await Promise.all([
          getPromptsForEvaluation(),
          getEvaluationDatasets(),
        ]);

        const promptList = unwrapList(promptsData);
        const datasetList = unwrapList(datasetsData);

        setPrompts(promptList);
        setDatasets(datasetList);

        if (promptList.length > 0) {
          setSelectedPromptId(String(promptList[0].id));
        }

        if (datasetList.length > 0) {
          setSelectedDatasetId(String(datasetList[0].id));
        }
      } catch (err) {
        console.error(err);
        setError(err.message || "Unable to load initial repeatability options.");
      } finally {
        setLoadingInitial(false);
      }
    }

    loadInitial();
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

        const data = await getPromptVersionsForEvaluation(selectedPromptId);
        const versionList = unwrapList(data);

        setVersions(versionList);

        if (versionList.length > 0) {
          setSelectedVersionId(String(versionList[0].id));
        } else {
          setSelectedVersionId("");
        }
      } catch (err) {
        console.error(err);
        setVersions([]);
        setSelectedVersionId("");
        setError(err.message || "Unable to load prompt versions.");
      } finally {
        setLoadingVersions(false);
      }
    }

    loadVersions();
  }, [selectedPromptId]);

  const selectedPrompt = useMemo(() => {
    return prompts.find(
      (prompt) => String(prompt.id) === String(selectedPromptId)
    );
  }, [prompts, selectedPromptId]);

  const selectedVersion = useMemo(() => {
    return versions.find(
      (version) => String(version.id) === String(selectedVersionId)
    );
  }, [versions, selectedVersionId]);

  const selectedDataset = useMemo(() => {
    return datasets.find(
      (dataset) => String(dataset.id) === String(selectedDatasetId)
    );
  }, [datasets, selectedDatasetId]);

  const numericRepeatCount = Number(repeatCount);

  const canRun = Boolean(
    selectedPromptId &&
    selectedVersionId &&
    selectedDatasetId &&
    model &&
    installedModels.length > 0 &&
    !modelsLoading &&
    !modelsError &&
    selectedDataset &&
    Number(selectedDataset.test_case_count || 0) > 0 &&
    numericRepeatCount >= 2 &&
    numericRepeatCount <= 5 &&
    !running
  );

  const overallScores = useMemo(() => {
    return runs
      .map((run) => Number(run.overall_score))
      .filter((value) => !Number.isNaN(value));
  }, [runs]);

  const summary = useMemo(() => {
    if (!overallScores.length) {
      return null;
    }

    const mean = average(overallScores);
    const min = Math.min(...overallScores);
    const max = Math.max(...overallScores);
    const deviation = standardDeviation(overallScores);

    const passedRuns = runs.filter(
      (run) =>
        run.status === "completed" && Number(run.failed_cases) === 0
    ).length;

    const passRate = (passedRuns / runs.length) * 100;

    return {
      mean,
      min,
      max,
      range: max - min,
      deviation,
      passedRuns,
      passRate,
    };
  }, [runs, overallScores]);

  const caseStats = useMemo(() => {
    const byCase = new Map();

    runs.forEach((run) => {
      (run.results || []).forEach((result) => {
        const key = String(result.test_case);

        if (!byCase.has(key)) {
          byCase.set(key, {
            id: result.test_case,
            name: result.test_case_name,
            scores: [],
            passCount: 0,
            totalCount: 0,
          });
        }

        const entry = byCase.get(key);
        const score = Number(result.score);

        if (!Number.isNaN(score)) {
          entry.scores.push(score);
        }

        entry.totalCount += 1;

        if (result.status === "passed") {
          entry.passCount += 1;
        }
      });
    });

    return Array.from(byCase.values()).map((entry) => {
      const mean = average(entry.scores);
      const deviation = standardDeviation(entry.scores);
      const min = entry.scores.length ? Math.min(...entry.scores) : null;
      const max = entry.scores.length ? Math.max(...entry.scores) : null;
      const passRate = entry.totalCount
        ? (entry.passCount / entry.totalCount) * 100
        : null;

      return {
        id: entry.id,
        name: entry.name,
        mean,
        deviation,
        min,
        max,
        passRate,
      };
    });
  }, [runs]);

  async function handleRunRepeats(event) {
    event.preventDefault();

    if (!canRun) return;

    try {
      setRunning(true);
      setError("");
      setRuns([]);
      setCurrentRepeat(0);

      const createdRuns = [];

      for (let index = 0; index < numericRepeatCount; index += 1) {
        setCurrentRepeat(index + 1);

        const newRun = await createEvaluationRun({
          prompt: Number(selectedPromptId),
          prompt_version: Number(selectedVersionId),
          dataset: Number(selectedDatasetId),
          model,
        });

        createdRuns.push(newRun);
        setRuns([...createdRuns]);
      }
    } catch (err) {
      console.error(err);
      setError(
        err.message ||
          "An error occurred while running the repeatability study."
      );
    } finally {
      setRunning(false);
      setCurrentRepeat(0);
    }
  }

  function resetResults() {
    setRuns([]);
    setError("");
    setCurrentRepeat(0);
  }

  if (loadingInitial) {
    return <LoadingState />;
  }

  const rating = summary ? consistencyRating(summary.deviation) : null;

  return (
    <div className="space-y-8 pb-12 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <Link
          to="/dashboard/evaluations"
          className="inline-flex w-fit items-center gap-2 text-xs font-medium text-muted hover:text-ink"
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
          <h1 className="font-serif text-3xl sm:text-4xl tracking-tight text-ink">
            Prompt Repeatability Study
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
            Run the same prompt version against your test cases multiple times to observe whether its answers and scores remain consistent.
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
      <form onSubmit={handleRunRepeats} className="space-y-6">
        <section className="rounded-xl border border-border bg-surface p-6 shadow-subtle">
          <div className="mb-6">
            <h2 className="font-serif text-2xl text-ink">
              Configure Repeat Study
            </h2>
            <p className="text-xs text-muted mt-1">
              Select the prompt version, test dataset, and number of trials to run.
            </p>
          </div>

          <div className="space-y-5">
            {/* Prompt */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink">
                Prompt
              </label>
              <select
                value={selectedPromptId}
                onChange={(e) => setSelectedPromptId(e.target.value)}
                disabled={running}
                className="w-full rounded-control border border-border bg-background px-3 py-2.5 text-sm text-ink outline-none focus:border-brand disabled:opacity-60"
              >
                <option value="">Select a prompt</option>
                {prompts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
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
                onChange={(e) => setSelectedVersionId(e.target.value)}
                disabled={running || !selectedPromptId || loadingVersions}
                className="w-full rounded-control border border-border bg-background px-3 py-2.5 text-sm text-ink outline-none focus:border-brand disabled:opacity-60"
              >
                <option value="">
                  {loadingVersions ? "Loading versions..." : "Select a version"}
                </option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version_number}
                  </option>
                ))}
              </select>
            </div>

            {/* Dataset */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink">
                Evaluation dataset
              </label>
              <select
                value={selectedDatasetId}
                onChange={(e) => setSelectedDatasetId(e.target.value)}
                disabled={running}
                className="w-full rounded-control border border-border bg-background px-3 py-2.5 text-sm text-ink outline-none focus:border-brand disabled:opacity-60"
              >
                <option value="">Select a dataset</option>
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} · {d.test_case_count} cases
                  </option>
                ))}
              </select>
              {selectedDataset && Number(selectedDataset.test_case_count || 0) === 0 && (
                <p className="mt-2 text-xs text-error">
                  This dataset has no test cases.
                </p>
              )}
            </div>

            {/* Model & Repeat Count */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <ModelSelector
                  label="Model"
                  labelClassName="mb-1.5 block text-xs font-medium text-ink"
                  selectClassName="w-full rounded-control border border-border bg-background px-3 py-2.5 text-sm text-ink outline-none focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
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

              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink">
                  Number of repeat runs (2–5)
                </label>
                <input
                  type="number"
                  min="2"
                  max="5"
                  value={repeatCount}
                  onChange={(e) => setRepeatCount(e.target.value)}
                  disabled={running}
                  className="w-full rounded-control border border-border bg-background px-3 py-2.5 font-mono text-sm text-ink outline-none focus:border-brand disabled:opacity-60"
                />
              </div>
            </div>
          </div>

          <div className="mt-7 border-t border-border pt-5">
            <button
              type="submit"
              disabled={!canRun}
              className="inline-flex w-full items-center justify-center gap-2 rounded-control bg-brand px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {running ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Running trial {currentRepeat} of {numericRepeatCount}...
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
                      d="M4 12a8 8 0 018-8M4 12a8 8 0 018 8M4 12h16"
                    />
                  </svg>
                  Start Repeatability Study
                </>
              )}
            </button>
          </div>
        </section>
      </form>

      {/* Results */}
      {runs.length > 0 && (
        <div className="space-y-6">
          <section className="space-y-4">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                <h2 className="font-serif text-3xl text-ink">
                  Consistency Results
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Summary across {runs.length} completed repeat trial{runs.length === 1 ? "" : "s"}.
                </p>
              </div>

              <button
                type="button"
                onClick={resetResults}
                disabled={running}
                className="w-fit rounded-control border border-border bg-surface px-4 py-2 text-xs font-semibold text-ink hover:border-ink"
              >
                Clear study
              </button>
            </div>

            {/* Prominent High-Level Consistency Cards */}
            {summary && (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-border bg-surface p-5 shadow-subtle">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                    Average Score
                  </p>
                  <p
                    className={`mt-2 font-mono text-3xl font-semibold ${scoreClass(
                      summary.mean
                    )}`}
                  >
                    {formatNumber(summary.mean, 1)}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Mean score across {runs.length} trials
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-surface p-5 shadow-subtle">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                    Overall Pass Rate
                  </p>
                  <p className="mt-2 font-mono text-3xl font-semibold text-success">
                    {formatNumber(summary.passRate, 1)}%
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {summary.passedRuns} of {runs.length} trials passed all tests
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-surface p-5 shadow-subtle">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                    Consistency Rating
                  </p>
                  <p className={`mt-2 font-serif text-2xl font-semibold ${rating?.color}`}>
                    {rating?.label}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {rating?.text}
                  </p>
                </div>
              </div>
            )}

            {/* Plain-English Variability Explanation Banner */}
            {summary && (
              <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 text-sm leading-6 text-ink">
                <p>{plainEnglishVariability(summary, runs.length)}</p>
              </div>
            )}
          </section>

          {/* Expandable Detailed Statistics Section */}
          <details className="rounded-xl border border-border bg-surface shadow-subtle group">
            <summary className="flex cursor-pointer list-none items-center justify-between p-5 text-sm font-semibold text-ink hover:text-brand">
              <div className="flex items-center gap-2">
                <svg
                  width="14"
                  height="14"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="transition-transform group-open:rotate-90"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 18l6-6-6-6"
                  />
                </svg>
                <span>Detailed statistics &amp; per-case breakdown</span>
              </div>
              <span className="font-mono text-xs text-muted">Click to expand</span>
            </summary>

            <div className="border-t border-border p-6 space-y-8">
              {/* Technical Range & Standard Deviation Metrics */}
              {summary && (
                <div>
                  <h4 className="text-sm font-semibold text-ink mb-3">
                    Statistical spread metrics
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border border-border bg-background p-3.5">
                      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                        Lowest Score
                      </p>
                      <p className="mt-1.5 font-mono text-xl font-semibold text-ink">
                        {formatNumber(summary.min, 1)}
                      </p>
                    </div>

                    <div className="rounded-lg border border-border bg-background p-3.5">
                      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                        Highest Score
                      </p>
                      <p className="mt-1.5 font-mono text-xl font-semibold text-ink">
                        {formatNumber(summary.max, 1)}
                      </p>
                    </div>

                    <div className="rounded-lg border border-border bg-background p-3.5">
                      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                        Score Range (Spread)
                      </p>
                      <p className="mt-1.5 font-mono text-xl font-semibold text-ink">
                        {formatNumber(summary.range, 1)} pts
                      </p>
                    </div>

                    <div className="rounded-lg border border-border bg-background p-3.5">
                      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                        Std Deviation
                      </p>
                      <p className="mt-1.5 font-mono text-xl font-semibold text-ink">
                        {formatNumber(summary.deviation, 2)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Individual Trials Table */}
              <div>
                <h4 className="text-sm font-semibold text-ink mb-2">
                  Individual trial runs
                </h4>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <div className="min-w-[540px]">
                    <div className="grid grid-cols-[0.5fr_1.6fr_0.8fr_0.8fr_0.6fr] border-b border-border bg-background px-5 py-3">
                      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">Trial</p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">Run ID</p>
                      <p className="text-right font-mono text-[10px] uppercase tracking-[0.1em] text-muted">Score</p>
                      <p className="text-right font-mono text-[10px] uppercase tracking-[0.1em] text-muted">Passed</p>
                      <p className="text-right font-mono text-[10px] uppercase tracking-[0.1em] text-muted">Status</p>
                    </div>

                    {runs.map((run, index) => (
                      <div
                        key={run.id}
                        className="grid grid-cols-[0.5fr_1.6fr_0.8fr_0.8fr_0.6fr] border-b border-border px-5 py-3 last:border-b-0"
                      >
                        <p className="font-mono text-xs text-muted self-center">
                          Trial {index + 1}
                        </p>

                        <div className="self-center">
                          <p className="text-sm font-medium text-ink">
                            Evaluation #{run.id}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px] text-muted">
                            {formatDate(run.created_at)}
                          </p>
                        </div>

                        <p
                          className={`self-center text-right font-mono text-sm font-semibold ${scoreClass(
                            run.overall_score
                          )}`}
                        >
                          {run.overall_score}
                        </p>

                        <p className="self-center text-right font-mono text-sm text-success">
                          {run.passed_cases}/{run.total_cases}
                        </p>

                        <p className="self-center text-right font-mono text-xs text-muted">
                          {run.status}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Case-by-Case Consistency Table */}
              <div>
                <h4 className="text-sm font-semibold text-ink mb-1">
                  Per-case variability
                </h4>
                <p className="text-xs text-muted mb-3">
                  Score consistency for each test case across the repeated executions.
                </p>

                <div className="overflow-x-auto rounded-lg border border-border">
                  <div className="min-w-[560px]">
                    <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr] border-b border-border bg-background px-5 py-3">
                      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">Test Case</p>
                      <p className="text-right font-mono text-[10px] uppercase tracking-[0.1em] text-muted">Mean</p>
                      <p className="text-right font-mono text-[10px] uppercase tracking-[0.1em] text-muted">Min</p>
                      <p className="text-right font-mono text-[10px] uppercase tracking-[0.1em] text-muted">Max</p>
                      <p className="text-right font-mono text-[10px] uppercase tracking-[0.1em] text-muted">Std Dev</p>
                      <p className="text-right font-mono text-[10px] uppercase tracking-[0.1em] text-muted">Pass Rate</p>
                    </div>

                    {caseStats.map((item) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr] border-b border-border px-5 py-3.5 last:border-b-0"
                      >
                        <div>
                          <p className="text-sm font-medium text-ink">
                            {item.name || `Case #${item.id}`}
                          </p>
                          <p className="mt-0.5 font-mono text-[9px] text-muted">
                            Case #{item.id}
                          </p>
                        </div>

                        <p className="text-right font-mono text-sm text-ink self-center">
                          {formatNumber(item.mean, 1)}
                        </p>

                        <p className="text-right font-mono text-sm text-ink self-center">
                          {formatNumber(item.min, 1)}
                        </p>

                        <p className="text-right font-mono text-sm text-ink self-center">
                          {formatNumber(item.max, 1)}
                        </p>

                        <p className="text-right font-mono text-sm text-ink self-center">
                          {formatNumber(item.deviation, 2)}
                        </p>

                        <p className="text-right font-mono text-sm text-success self-center">
                          {formatNumber(item.passRate, 0)}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
