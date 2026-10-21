import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  createEvaluationRun,
  getEvaluationDatasets,
  getPromptsForEvaluation,
  getPromptVersionsForEvaluation,
} from "../../services/evaluationService";

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
    values.reduce(
      (sum, value) => sum + value,
      0
    ) / values.length
  );
}

function standardDeviation(values) {
  if (!values.length) {
    return null;
  }

  const mean = average(values);

  const variance =
    values.reduce(
      (sum, value) =>
        sum + Math.pow(value - mean, 2),
      0
    ) / values.length;

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

function scoreClass(score) {
  const value = Number(score);

  if (Number.isNaN(value)) {
    return "text-muted";
  }

  if (value >= 70) {
    return "text-success";
  }

  return "text-error";
}

function LoadingState() {
  return (
    <div className="flex min-h-[420px] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-border border-t-brand" />

        <p className="mt-4 text-sm text-muted">
          Loading repeat evaluation workspace...
        </p>
      </div>
    </div>
  );
}

export default function RepeatEvaluation() {
  const [prompts, setPrompts] = useState([]);
  const [versions, setVersions] = useState([]);
  const [datasets, setDatasets] = useState([]);

  const [selectedPromptId, setSelectedPromptId] =
    useState("");

  const [selectedVersionId, setSelectedVersionId] =
    useState("");

  const [selectedDatasetId, setSelectedDatasetId] =
    useState("");

  const [model, setModel] =
    useState("gemma3:4b");

  const [repeatCount, setRepeatCount] =
    useState("3");

  const [loading, setLoading] = useState(true);
  const [loadingVersions, setLoadingVersions] =
    useState(false);

  const [running, setRunning] = useState(false);
  const [currentRepeat, setCurrentRepeat] =
    useState(0);

  const [runs, setRuns] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        setError("");

        const [
          promptsData,
          datasetsData,
        ] = await Promise.all([
          getPromptsForEvaluation(),
          getEvaluationDatasets(),
        ]);

        setPrompts(unwrapList(promptsData));
        setDatasets(unwrapList(datasetsData));
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

  const numericRepeatCount =
    Number(repeatCount);

  const canRun =
    Boolean(
      selectedPromptId &&
      selectedVersionId &&
      selectedDatasetId &&
      model &&
      selectedDataset &&
      Number(
        selectedDataset.test_case_count || 0
      ) > 0 &&
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

    const min = Math.min(
      ...overallScores
    );

    const max = Math.max(
      ...overallScores
    );

    const deviation =
      standardDeviation(overallScores);

    const passedRuns = runs.filter(
      (run) =>
        run.status === "completed" &&
        Number(run.failed_cases) === 0
    ).length;

    const passRate =
      (passedRuns / runs.length) * 100;

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
      (run.results || []).forEach(
        (result) => {
          const key = String(
            result.test_case
          );

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

          const score = Number(
            result.score
          );

          if (!Number.isNaN(score)) {
            entry.scores.push(score);
          }

          entry.totalCount += 1;

          if (result.status === "passed") {
            entry.passCount += 1;
          }
        }
      );
    });

    return Array.from(
      byCase.values()
    ).map((entry) => {
      const mean = average(entry.scores);

      const deviation =
        standardDeviation(entry.scores);

      const min = entry.scores.length
        ? Math.min(...entry.scores)
        : null;

      const max = entry.scores.length
        ? Math.max(...entry.scores)
        : null;

      return {
        ...entry,
        mean,
        deviation,
        min,
        max,
        passRate:
          entry.totalCount > 0
            ? (entry.passCount /
                entry.totalCount) *
              100
            : null,
      };
    });
  }, [runs]);

  async function handleRunRepeats(event) {
    event.preventDefault();

    if (!canRun) {
      return;
    }

    try {
      setRunning(true);
      setError("");
      setRuns([]);
      setCurrentRepeat(0);

      const completedRuns = [];

      for (
        let index = 1;
        index <= numericRepeatCount;
        index += 1
      ) {
        setCurrentRepeat(index);

        const result =
          await createEvaluationRun({
            prompt_version:
              Number(selectedVersionId),

            dataset:
              Number(selectedDatasetId),

            model: model.trim(),
          });

        completedRuns.push(result);
        setRuns([...completedRuns]);

        if (result.status !== "completed") {
          setError(
            `Repeat ${index} completed with status "${result.status}".`
          );
        }
      }
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Unable to complete the repeat evaluation."
      );
    } finally {
      setRunning(false);
      setCurrentRepeat(0);
    }
  }

  function resetResults() {
    setRuns([]);
    setError("");
  }

  if (loading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-8 pb-12">
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
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brand">
            Repeatability study
          </p>

          <h1 className="mt-2 font-serif text-4xl tracking-tight text-ink">
            Measure prompt consistency.
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Run the same prompt version against the same
            test dataset multiple times and measure score
            stability across the repeated trials.
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
      <form
        onSubmit={handleRunRepeats}
        className="grid gap-6 xl:grid-cols-[1fr_0.65fr]"
      >
        <section className="rounded-xl border border-border bg-surface p-6">
          <div className="mb-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              Repeat experiment
            </p>

            <h2 className="mt-1 font-serif text-2xl text-ink">
              Configure the study
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
                className="w-full rounded-control border border-border bg-background px-3 py-2.5 text-sm text-ink outline-none focus:border-brand disabled:opacity-60"
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
                className="w-full rounded-control border border-border bg-background px-3 py-2.5 text-sm text-ink outline-none focus:border-brand disabled:opacity-60"
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
                className="w-full rounded-control border border-border bg-background px-3 py-2.5 text-sm text-ink outline-none focus:border-brand disabled:opacity-60"
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
                    {dataset.test_case_count} cases
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
              <label className="mb-1.5 block text-xs font-medium text-ink">
                Model
              </label>

              <select
                value={model}
                onChange={(event) =>
                  setModel(event.target.value)
                }
                disabled={running}
                className="w-full rounded-control border border-border bg-background px-3 py-2.5 text-sm text-ink outline-none focus:border-brand disabled:opacity-60"
              >
                <option value="gemma3:4b">
                  Gemma 3 4B
                </option>
              </select>
            </div>

            {/* Repeats */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink">
                Number of repeats
              </label>

              <select
                value={repeatCount}
                onChange={(event) =>
                  setRepeatCount(
                    event.target.value
                  )
                }
                disabled={running}
                className="w-full rounded-control border border-border bg-background px-3 py-2.5 text-sm text-ink outline-none focus:border-brand disabled:opacity-60"
              >
                <option value="2">
                  2 repeats
                </option>

                <option value="3">
                  3 repeats
                </option>

                <option value="4">
                  4 repeats
                </option>

                <option value="5">
                  5 repeats
                </option>
              </select>

              <p className="mt-2 text-xs leading-5 text-muted">
                Each repeat is stored as a separate
                evaluation run.
              </p>
            </div>
          </div>

          <div className="mt-7 border-t border-border pt-5">
            <button
              type="submit"
              disabled={!canRun}
              className="inline-flex w-full items-center justify-center gap-2 rounded-control bg-brand px-4 py-3 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {running ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Running {currentRepeat} of{" "}
                  {numericRepeatCount}...
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

                  Start Repeat Study
                </>
              )}
            </button>
          </div>
        </section>

        {/* Preview */}
        <section className="rounded-xl border border-border bg-surface p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            Study design
          </p>

          <div className="mt-5 space-y-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.13em] text-muted">
                Prompt
              </p>

              <p className="mt-1 text-sm font-medium text-ink">
                {selectedPrompt?.title ||
                  "Not selected"}
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.13em] text-muted">
                Version
              </p>

              <p className="mt-1 font-mono text-sm text-ink">
                {selectedVersion
                  ? `v${selectedVersion.version_number}`
                  : "—"}
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.13em] text-muted">
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

            <div className="rounded-lg border border-dashed border-border bg-background p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-brand">
                What gets measured
              </p>

              <div className="mt-3 space-y-2 text-sm text-muted">
                <p>
                  Mean score across repeated runs
                </p>

                <p>
                  Score range and standard deviation
                </p>

                <p>
                  Overall pass rate
                </p>

                <p>
                  Per-test-case consistency
                </p>
              </div>
            </div>
          </div>
        </section>
      </form>

      {/* Results */}
      {runs.length > 0 && (
        <>
          <section>
            <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                  Repeat study
                </p>

                <h2 className="mt-1 font-serif text-3xl text-ink">
                  Consistency results
                </h2>
              </div>

              <button
                type="button"
                onClick={resetResults}
                disabled={running}
                className="w-fit rounded-control border border-border bg-surface px-4 py-2 text-sm font-medium text-ink hover:border-ink"
              >
                Clear study
              </button>
            </div>

            {summary && (
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                <div className="rounded-xl border border-border bg-surface p-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                    Mean score
                  </p>

                  <p
                    className={`mt-2 font-mono text-2xl font-semibold ${scoreClass(
                      summary.mean
                    )}`}
                  >
                    {formatNumber(
                      summary.mean
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-surface p-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                    Minimum
                  </p>

                  <p className="mt-2 font-mono text-2xl text-ink">
                    {formatNumber(
                      summary.min
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-surface p-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                    Maximum
                  </p>

                  <p className="mt-2 font-mono text-2xl text-ink">
                    {formatNumber(
                      summary.max
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-surface p-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                    Range
                  </p>

                  <p className="mt-2 font-mono text-2xl text-ink">
                    {formatNumber(
                      summary.range
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-surface p-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                    Std deviation
                  </p>

                  <p className="mt-2 font-mono text-2xl text-ink">
                    {formatNumber(
                      summary.deviation
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-surface p-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                    Pass rate
                  </p>

                  <p className="mt-2 font-mono text-2xl text-success">
                    {formatNumber(
                      summary.passRate,
                      1
                    )}
                    %
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Individual runs */}
          <section className="rounded-xl border border-border bg-surface">
            <div className="border-b border-border p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
                Individual trials
              </p>

              <h3 className="mt-1 font-serif text-2xl text-ink">
                Run distribution
              </h3>
            </div>

            <div className="divide-y divide-border">
              {runs.map((run, index) => (
                <div
                  key={run.id}
                  className="grid gap-3 px-5 py-4 md:grid-cols-[0.6fr_1.5fr_0.8fr_0.8fr_0.8fr] md:items-center"
                >
                  <p className="font-mono text-xs text-muted">
                    Trial {index + 1}
                  </p>

                  <div>
                    <p className="text-sm font-medium text-ink">
                      Evaluation #{run.id}
                    </p>

                    <p className="mt-1 text-xs text-muted">
                      {formatDate(
                        run.created_at
                      )}
                    </p>
                  </div>

                  <p
                    className={`font-mono text-lg font-semibold ${scoreClass(
                      run.overall_score
                    )}`}
                  >
                    {run.overall_score}
                  </p>

                  <p className="font-mono text-sm text-success">
                    {run.passed_cases}/
                    {run.total_cases} passed
                  </p>

                  <p className="font-mono text-sm text-muted">
                    {run.status}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Per-case */}
          <section className="rounded-xl border border-border bg-surface">
            <div className="border-b border-border p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
                Case stability
              </p>

              <h3 className="mt-1 font-serif text-2xl text-ink">
                Test-case consistency
              </h3>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr] border-b border-border bg-background px-5 py-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                    Test case
                  </p>

                  <p className="text-right font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                    Mean
                  </p>

                  <p className="text-right font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                    Min
                  </p>

                  <p className="text-right font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                    Max
                  </p>

                  <p className="text-right font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                    Std Dev
                  </p>

                  <p className="text-right font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                    Pass Rate
                  </p>
                </div>

                {caseStats.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr] border-b border-border px-5 py-4 last:border-b-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {item.name}
                      </p>

                      <p className="mt-1 font-mono text-[9px] text-muted">
                        Case #{item.id}
                      </p>
                    </div>

                    <p className="text-right font-mono text-sm text-ink">
                      {formatNumber(
                        item.mean
                      )}
                    </p>

                    <p className="text-right font-mono text-sm text-ink">
                      {formatNumber(
                        item.min
                      )}
                    </p>

                    <p className="text-right font-mono text-sm text-ink">
                      {formatNumber(
                        item.max
                      )}
                    </p>

                    <p className="text-right font-mono text-sm text-ink">
                      {formatNumber(
                        item.deviation
                      )}
                    </p>

                    <p className="text-right font-mono text-sm text-success">
                      {formatNumber(
                        item.passRate,
                        1
                      )}
                      %
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}