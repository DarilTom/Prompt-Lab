import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createEvaluationDataset,
  createTestCase,
  deleteTestCase,
  getEvaluationDatasets,
  getEvaluationRuns,
} from "../../services/evaluationService";

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDuration(nanoseconds) {
  if (nanoseconds === null || nanoseconds === undefined) {
    return "—";
  }

  const seconds = nanoseconds / 1_000_000_000;

  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
}

function statusClasses(status) {
  switch (status) {
    case "completed":
      return "bg-success/10 text-success";
    case "failed":
      return "bg-error/10 text-error";
    case "running":
      return "bg-warning/10 text-warning";
    case "pending":
      return "bg-info/10 text-info";
    default:
      return "bg-border text-muted";
  }
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
        <svg
          width="18"
          height="18"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1.75"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 3h6M9 3v2H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2V3"
          />
          <path
            strokeLinecap="round"
            d="M8 10h8M8 14h6M8 18h4"
          />
        </svg>
      </div>

      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        Evaluation Datasets
      </p>

      <p className="mt-2 font-serif text-2xl text-ink">
        No datasets yet
      </p>

      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Create a dataset containing repeatable test cases for your prompts.
      </p>
    </div>
  );
}

export default function Evaluations() {
  const [datasets, setDatasets] = useState([]);
  const [runs, setRuns] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreateDataset, setShowCreateDataset] =
    useState(false);

  const [datasetName, setDatasetName] = useState("");
  const [datasetDescription, setDatasetDescription] =
    useState("");

  const [creatingDataset, setCreatingDataset] =
    useState(false);

  const [expandedDataset, setExpandedDataset] =
    useState(null);

  const [addingTestCase, setAddingTestCase] =
    useState(false);

  const [testCaseName, setTestCaseName] =
    useState("");

  const [testCaseInput, setTestCaseInput] =
    useState("");

  const [testCaseExpectedOutput, setTestCaseExpectedOutput] =
    useState("");

  const [testCaseExpectedBehavior, setTestCaseExpectedBehavior] =
    useState("");

  const [testCaseError, setTestCaseError] =
    useState("");

  const [deletingTestCaseId, setDeletingTestCaseId] =
    useState(null);

  async function loadData() {
    try {
      setError("");

      const [datasetData, runData] =
        await Promise.all([
          getEvaluationDatasets(),
          getEvaluationRuns(),
        ]);

      setDatasets(
        Array.isArray(datasetData)
          ? datasetData
          : []
      );

      setRuns(
        Array.isArray(runData)
          ? runData
          : []
      );
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

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo(() => {
    const totalCases = datasets.reduce(
      (sum, dataset) =>
        sum + Number(dataset.test_case_count || 0),
      0
    );

    const completedRuns = runs.filter(
      (run) => run.status === "completed"
    ).length;

    return {
      datasets: datasets.length,
      testCases: totalCases,
      runs: runs.length,
      completedRuns,
    };
  }, [datasets, runs]);

  async function handleCreateDataset(event) {
    event.preventDefault();

    if (!datasetName.trim()) {
      return;
    }

    try {
      setCreatingDataset(true);
      setError("");

      await createEvaluationDataset({
        name: datasetName.trim(),
        description: datasetDescription.trim(),
      });

      setDatasetName("");
      setDatasetDescription("");
      setShowCreateDataset(false);

      await loadData();
    } catch (err) {
      console.error(err);
      setError(
        err.message ||
          "Unable to create the dataset."
      );
    } finally {
      setCreatingDataset(false);
    }
  }

  async function handleExpandDataset(datasetId) {
    if (expandedDataset === datasetId) {
      setExpandedDataset(null);
      return;
    }

    setExpandedDataset(datasetId);
  }

  async function handleAddTestCase(event, datasetId) {
    event.preventDefault();

    if (
      !testCaseName.trim() ||
      !testCaseInput.trim()
    ) {
      setTestCaseError(
        "Test case name and input are required."
      );
      return;
    }

    try {
      setAddingTestCase(true);
      setTestCaseError("");

      await createTestCase(datasetId, {
        name: testCaseName.trim(),
        input_text: testCaseInput.trim(),
        expected_output:
          testCaseExpectedOutput.trim(),
        expected_behavior:
          testCaseExpectedBehavior.trim(),
        metadata: {},
        sort_order: 1,
      });

      setTestCaseName("");
      setTestCaseInput("");
      setTestCaseExpectedOutput("");
      setTestCaseExpectedBehavior("");

      await loadData();
    } catch (err) {
      console.error(err);
      setTestCaseError(
        err.message ||
          "Unable to create the test case."
      );
    } finally {
      setAddingTestCase(false);
    }
  }

  async function handleDeleteTestCase(testCaseId) {
    const confirmed = window.confirm(
      "Delete this test case?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingTestCaseId(testCaseId);

      await deleteTestCase(testCaseId);

      await loadData();
    } catch (err) {
      console.error(err);
      setError(
        err.message ||
          "Unable to delete the test case."
      );
    } finally {
      setDeletingTestCaseId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-border border-t-brand" />

          <p className="mt-4 text-sm text-muted">
            Loading evaluations...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brand">
            Evaluation workspace
          </p>

          <h1 className="mt-2 font-serif text-4xl tracking-tight text-ink">
            Test your prompts systematically.
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Create repeatable test datasets, inspect evaluation
            runs, and measure how prompt versions behave across
            the same cases.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/dashboard/evaluations/run"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-control bg-ink px-4 py-2.5 text-sm font-medium text-white transition-standard hover:opacity-90"
          >
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
          </Link>

          <button
            type="button"
            onClick={() =>
              setShowCreateDataset(
                (value) => !value
              )
            }
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-control border border-border bg-surface px-4 py-2.5 text-sm font-medium text-ink transition-standard hover:border-ink"
          >
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
                d="M12 5v14M5 12h14"
              />
            </svg>

            New Dataset
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {/* Create dataset */}
      {showCreateDataset && (
        <form
          onSubmit={handleCreateDataset}
          className="rounded-xl border border-border bg-surface p-5"
        >
          <div className="mb-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              New evaluation dataset
            </p>

            <h2 className="mt-1 font-serif text-2xl text-ink">
              Define a reusable test set
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-ink">
                Dataset name
              </label>

              <input
                type="text"
                value={datasetName}
                onChange={(event) =>
                  setDatasetName(
                    event.target.value
                  )
                }
                placeholder="e.g. Customer Support Evaluation"
                className="w-full rounded-control border border-border bg-background px-3 py-2.5 text-sm text-ink outline-none transition-standard placeholder:text-muted/60 focus:border-brand"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-ink">
                Description
              </label>

              <textarea
                value={datasetDescription}
                onChange={(event) =>
                  setDatasetDescription(
                    event.target.value
                  )
                }
                rows={3}
                placeholder="Describe what this dataset is intended to test."
                className="w-full resize-y rounded-control border border-border bg-background px-3 py-2.5 text-sm text-ink outline-none transition-standard placeholder:text-muted/60 focus:border-brand"
              />
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowCreateDataset(false);
                setDatasetName("");
                setDatasetDescription("");
              }}
              className="rounded-control border border-border px-4 py-2 text-sm font-medium text-ink hover:border-ink"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                creatingDataset ||
                !datasetName.trim()
              }
              className="rounded-control bg-brand px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creatingDataset
                ? "Creating..."
                : "Create Dataset"}
            </button>
          </div>
        </form>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
            Datasets
          </p>
          <p className="mt-2 font-serif text-3xl text-ink">
            {stats.datasets}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
            Test Cases
          </p>
          <p className="mt-2 font-serif text-3xl text-ink">
            {stats.testCases}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
            Evaluation Runs
          </p>
          <p className="mt-2 font-serif text-3xl text-ink">
            {stats.runs}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
            Completed
          </p>
          <p className="mt-2 font-serif text-3xl text-ink">
            {stats.completedRuns}
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        {/* Datasets */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                Test sets
              </p>

              <h2 className="mt-1 font-serif text-2xl text-ink">
                Evaluation Datasets
              </h2>
            </div>
          </div>

          {datasets.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-4">
              {datasets.map((dataset) => {
                const isExpanded =
                  expandedDataset === dataset.id;

                return (
                  <div
                    key={dataset.id}
                    className="overflow-hidden rounded-xl border border-border bg-surface"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        handleExpandDataset(
                          dataset.id
                        )
                      }
                      className="w-full p-5 text-left transition-standard hover:bg-background"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-brand">
                              Dataset #{dataset.id}
                            </span>
                          </div>

                          <h3 className="mt-1 truncate text-base font-semibold text-ink">
                            {dataset.name}
                          </h3>

                          <p className="mt-1 text-sm leading-5 text-muted">
                            {dataset.description ||
                              "No description provided."}
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="font-mono text-xl text-ink">
                            {dataset.test_case_count}
                          </p>

                          <p className="text-[11px] text-muted">
                            test cases
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                        <span className="text-[11px] text-muted">
                          Updated {formatDate(dataset.updated_at)}
                        </span>

                        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                          {isExpanded
                            ? "Hide cases"
                            : "View cases"}
                        </span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-border bg-background p-5">
                        {dataset.test_cases?.length ? (
                          <div className="space-y-3">
                            {dataset.test_cases.map(
                              (testCase) => (
                                <div
                                  key={testCase.id}
                                  className="rounded-lg border border-border bg-surface p-4"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="font-medium text-ink">
                                        {testCase.name}
                                      </p>

                                      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                                        Case #{testCase.id}
                                      </p>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDeleteTestCase(
                                          testCase.id
                                        )
                                      }
                                      disabled={
                                        deletingTestCaseId ===
                                        testCase.id
                                      }
                                      className="text-xs text-muted hover:text-error disabled:opacity-50"
                                    >
                                      {deletingTestCaseId ===
                                      testCase.id
                                        ? "Deleting..."
                                        : "Delete"}
                                    </button>
                                  </div>

                                  <div className="mt-4 grid gap-3">
                                    <div>
                                      <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                                        Input
                                      </p>
                                      <p className="rounded-md border border-border bg-background p-3 text-sm leading-6 text-ink">
                                        {testCase.input_text}
                                      </p>
                                    </div>

                                    <div>
                                      <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                                        Expected output
                                      </p>
                                      <p className="rounded-md border border-border bg-background p-3 text-sm leading-6 text-muted">
                                        {testCase.expected_output ||
                                          "Not specified."}
                                      </p>
                                    </div>

                                    <div>
                                      <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                                        Expected behavior
                                      </p>
                                      <p className="rounded-md border border-border bg-background p-3 text-sm leading-6 text-muted">
                                        {testCase.expected_behavior ||
                                          "Not specified."}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-muted">
                            This dataset has no test cases yet.
                          </p>
                        )}

                        {/* Add test case */}
                        <form
                          onSubmit={(event) =>
                            handleAddTestCase(
                              event,
                              dataset.id
                            )
                          }
                          className="mt-5 rounded-lg border border-border bg-surface p-4"
                        >
                          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-brand">
                            Add test case
                          </p>

                          <div className="mt-4 grid gap-3">
                            <input
                              type="text"
                              value={testCaseName}
                              onChange={(event) =>
                                setTestCaseName(
                                  event.target.value
                                )
                              }
                              placeholder="Test case name"
                              className="rounded-control border border-border bg-background px-3 py-2.5 text-sm text-ink outline-none focus:border-brand"
                            />

                            <textarea
                              value={testCaseInput}
                              onChange={(event) =>
                                setTestCaseInput(
                                  event.target.value
                                )
                              }
                              rows={3}
                              placeholder="Test input"
                              className="resize-y rounded-control border border-border bg-background px-3 py-2.5 text-sm text-ink outline-none focus:border-brand"
                            />

                            <textarea
                              value={testCaseExpectedOutput}
                              onChange={(event) =>
                                setTestCaseExpectedOutput(
                                  event.target.value
                                )
                              }
                              rows={3}
                              placeholder="Expected output"
                              className="resize-y rounded-control border border-border bg-background px-3 py-2.5 text-sm text-ink outline-none focus:border-brand"
                            />

                            <textarea
                              value={testCaseExpectedBehavior}
                              onChange={(event) =>
                                setTestCaseExpectedBehavior(
                                  event.target.value
                                )
                              }
                              rows={2}
                              placeholder="Expected behavior"
                              className="resize-y rounded-control border border-border bg-background px-3 py-2.5 text-sm text-ink outline-none focus:border-brand"
                            />
                          </div>

                          {testCaseError && (
                            <p className="mt-3 text-xs text-error">
                              {testCaseError}
                            </p>
                          )}

                          <div className="mt-4 flex justify-end">
                            <button
                              type="submit"
                              disabled={addingTestCase}
                              className="rounded-control bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                            >
                              {addingTestCase
                                ? "Adding..."
                                : "Add Test Case"}
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent runs */}
        <section>
          <div className="mb-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              Experiment history
            </p>

            <h2 className="mt-1 font-serif text-2xl text-ink">
              Recent Evaluation Runs
            </h2>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            {runs.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted">
                No evaluation runs yet.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {runs.slice(0, 6).map((run) => (
                  <div
                    key={run.id}
                    className="p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">
                          {run.prompt_title ||
                            "Untitled prompt"}
                        </p>

                        <p className="mt-1 font-mono text-[10px] text-muted">
                          Run #{run.id} · v
                          {run.version_number}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] ${statusClasses(
                          run.status
                        )}`}
                      >
                        {run.status}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted">
                          Score
                        </p>
                        <p className="mt-1 font-mono text-sm text-ink">
                          {run.overall_score ?? "—"}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted">
                          Passed
                        </p>
                        <p className="mt-1 font-mono text-sm text-success">
                          {run.passed_cases}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted">
                          Duration
                        </p>
                        <p className="mt-1 font-mono text-sm text-ink">
                          {formatDuration(
                            run.total_duration
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                      <span className="text-[11px] text-muted">
                        {run.dataset_name}
                      </span>

                      <span className="font-mono text-[10px] text-muted">
                        {formatDate(run.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}