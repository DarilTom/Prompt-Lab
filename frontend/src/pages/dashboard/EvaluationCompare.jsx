import { useEffect, useMemo, useState } from "react";
import {
  Link,
  useSearchParams,
} from "react-router-dom";

import {
  getEvaluationRun,
  getEvaluationRuns,
} from "../../services/evaluationService";

import RegressionAnalysis from "./RegressionAnalysis";

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

function delta(a, b) {
  const first = Number(a);
  const second = Number(b);

  if (
    Number.isNaN(first) ||
    Number.isNaN(second)
  ) {
    return null;
  }

  return second - first;
}

function formatDelta(value) {
  if (value === null) {
    return "—";
  }

  if (value > 0) {
    return `+${value.toFixed(2)}`;
  }

  return value.toFixed(2);
}

function deltaClass(value) {
  if (value === null || value === 0) {
    return "text-muted";
  }

  return value > 0
    ? "text-success"
    : "text-error";
}

function regressionLabel(value) {
  if (value === null) {
    return "No comparison";
  }

  if (value > 0) {
    return "Improved";
  }

  if (value < 0) {
    return "Regression";
  }

  return "Unchanged";
}

function regressionClass(value) {
  if (value === null || value === 0) {
    return "bg-border text-muted";
  }

  return value > 0
    ? "bg-success/10 text-success"
    : "bg-error/10 text-error";
}

function LoadingState() {
  return (
    <div className="flex min-h-[420px] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-border border-t-brand" />

        <p className="mt-4 text-sm text-muted">
          Loading comparison workspace...
        </p>
      </div>
    </div>
  );
}

function RunOptionLabel(run) {
  return `Run #${run.id} · ${run.prompt_title || "Untitled"} · v${run.version_number} · ${run.overall_score ?? "—"}`;
}

export default function EvaluationCompare() {
  const [searchParams] = useSearchParams();

  const [runs, setRuns] = useState([]);

  const [runAId, setRunAId] = useState(
    searchParams.get("a") || ""
  );

  const [runBId, setRunBId] = useState(
    searchParams.get("b") || ""
  );

  const [runA, setRunA] = useState(null);
  const [runB, setRunB] = useState(null);

  const [loadingRuns, setLoadingRuns] =
    useState(true);

  const [loadingComparison, setLoadingComparison] =
    useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    async function loadRuns() {
      try {
        setLoadingRuns(true);
        setError("");

        const data = await getEvaluationRuns();

        const completedRuns = unwrapList(data).filter(
          (run) =>
            run.status === "completed"
        );

        setRuns(completedRuns);

        // Automatically choose the two newest completed
        // runs when no selections were supplied.
        if (
          !runAId &&
          !runBId &&
          completedRuns.length >= 2
        ) {
          setRunAId(
            String(completedRuns[1].id)
          );

          setRunBId(
            String(completedRuns[0].id)
          );
        }
      } catch (err) {
        console.error(err);

        setError(
          err.message ||
            "Unable to load evaluation runs."
        );
      } finally {
        setLoadingRuns(false);
      }
    }

    loadRuns();
  }, []);

  useEffect(() => {
    if (!runAId || !runBId) {
      setRunA(null);
      setRunB(null);
      return;
    }

    if (runAId === runBId) {
      setError(
        "Please select two different evaluation runs."
      );
      setRunA(null);
      setRunB(null);
      return;
    }

    async function loadComparison() {
      try {
        setLoadingComparison(true);
        setError("");

        const [first, second] =
          await Promise.all([
            getEvaluationRun(runAId),
            getEvaluationRun(runBId),
          ]);

        if (
          String(first.dataset) !==
          String(second.dataset)
        ) {
          setRunA(null);
          setRunB(null);

          setError(
            "These runs use different datasets. Select two runs from the same dataset."
          );

          return;
        }

        setRunA(first);
        setRunB(second);
      } catch (err) {
        console.error(err);

        setRunA(null);
        setRunB(null);

        setError(
          err.message ||
            "Unable to load the selected runs."
        );
      } finally {
        setLoadingComparison(false);
      }
    }

    loadComparison();
  }, [runAId, runBId]);

  const scoreDelta = useMemo(() => {
    if (!runA || !runB) {
      return null;
    }

    return delta(
      runA.overall_score,
      runB.overall_score
    );
  }, [runA, runB]);

  const passedDelta = useMemo(() => {
    if (!runA || !runB) {
      return null;
    }

    return Number(runB.passed_cases) -
      Number(runA.passed_cases);
  }, [runA, runB]);

  const failedDelta = useMemo(() => {
    if (!runA || !runB) {
      return null;
    }

    return Number(runB.failed_cases) -
      Number(runA.failed_cases);
  }, [runA, runB]);

  const caseComparisons = useMemo(() => {
    if (!runA || !runB) {
      return [];
    }

    const firstResults =
      runA.results || [];

    const secondResults =
      runB.results || [];

    const secondByTestCase = new Map(
      secondResults.map((result) => [
        String(result.test_case),
        result,
      ])
    );

    return firstResults.map((firstResult) => {
      const secondResult =
        secondByTestCase.get(
          String(firstResult.test_case)
        );

      return {
        first: firstResult,
        second: secondResult || null,
        scoreDelta: secondResult
          ? delta(
              firstResult.score,
              secondResult.score
            )
          : null,
      };
    });
  }, [runA, runB]);

  const improvedCases = caseComparisons.filter(
    (item) => item.scoreDelta > 0
  );

  const regressionCases = caseComparisons.filter(
    (item) => item.scoreDelta < 0
  );

  const criterionComparisons = useMemo(() => {
    if (!runA || !runB) {
      return [];
    }

    const firstCriteria = {};

    const secondCriteria = {};

    (runA.results || []).forEach(
      (result) => {
        Object.entries(
          result.criteria_scores || {}
        ).forEach(
          ([criterion, value]) => {
            if (
              !firstCriteria[criterion]
            ) {
              firstCriteria[criterion] = [];
            }

            firstCriteria[criterion].push(
              Number(value)
            );
          }
        );
      }
    );

    (runB.results || []).forEach(
      (result) => {
        Object.entries(
          result.criteria_scores || {}
        ).forEach(
          ([criterion, value]) => {
            if (
              !secondCriteria[criterion]
            ) {
              secondCriteria[criterion] = [];
            }

            secondCriteria[criterion].push(
              Number(value)
            );
          }
        );
      }
    );

    const criteria = Array.from(
      new Set([
        ...Object.keys(firstCriteria),
        ...Object.keys(secondCriteria),
      ])
    );

    return criteria.map((criterion) => {
      const firstValues =
        firstCriteria[criterion] || [];

      const secondValues =
        secondCriteria[criterion] || [];

      const firstAverage =
        firstValues.length
          ? firstValues.reduce(
              (sum, value) =>
                sum + value,
              0
            ) / firstValues.length
          : null;

      const secondAverage =
        secondValues.length
          ? secondValues.reduce(
              (sum, value) =>
                sum + value,
              0
            ) / secondValues.length
          : null;

      return {
        criterion,
        firstAverage,
        secondAverage,
        delta:
          firstAverage !== null &&
          secondAverage !== null
            ? secondAverage - firstAverage
            : null,
      };
    });
  }, [runA, runB]);

  if (loadingRuns) {
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
            Evaluation comparison
          </p>

          <h1 className="mt-2 font-serif text-4xl tracking-tight text-ink">
            Compare prompt experiments.
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Compare two completed evaluations on
            the same test dataset to inspect score
            changes, criterion changes, and regressions.
          </p>
        </div>
      </div>

      {/* Selectors */}
      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink">
              Run A — baseline
            </label>

            <select
              value={runAId}
              onChange={(event) =>
                setRunAId(event.target.value)
              }
              className="w-full rounded-control border border-border bg-background px-3 py-2.5 text-sm text-ink outline-none focus:border-brand"
            >
              <option value="">
                Select baseline run
              </option>

              {runs.map((run) => (
                <option
                  key={run.id}
                  value={run.id}
                >
                  {RunOptionLabel(run)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink">
              Run B — comparison
            </label>

            <select
              value={runBId}
              onChange={(event) =>
                setRunBId(event.target.value)
              }
              className="w-full rounded-control border border-border bg-background px-3 py-2.5 text-sm text-ink outline-none focus:border-brand"
            >
              <option value="">
                Select comparison run
              </option>

              {runs.map((run) => (
                <option
                  key={run.id}
                  value={run.id}
                >
                  {RunOptionLabel(run)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {runA && runB && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
            <span className="rounded-full bg-background px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
              Dataset: {runA.dataset_name}
            </span>

            <span className="rounded-full bg-background px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
              {runA.total_cases} test cases
            </span>

            <span className="rounded-full bg-background px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
              {runA.model}
            </span>
          </div>
        )}
      </section>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {loadingComparison && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-border border-t-brand" />
            <p className="mt-3 text-sm text-muted">
              Loading comparison...
            </p>
          </div>
        </div>
      )}

      {runA && runB && !loadingComparison && (
        <>
          {/* Summary */}
          <section>
            <div className="mb-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                Run summary
              </p>

              <h2 className="mt-1 font-serif text-3xl text-ink">
                Baseline vs comparison
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-border bg-surface p-5">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                    Overall score
                  </p>

                  <span
                    className={`font-mono text-[10px] font-semibold ${deltaClass(
                      scoreDelta
                    )}`}
                  >
                    {formatDelta(scoreDelta)}
                  </span>
                </div>

                <div className="mt-4 flex items-end gap-3">
                  <div>
                    <p className="font-mono text-3xl text-ink">
                      {runA.overall_score ??
                        "—"}
                    </p>

                    <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-muted">
                      Run A
                    </p>
                  </div>

                  <span className="mb-5 text-muted">
                    →
                  </span>

                  <div>
                    <p className="font-mono text-3xl text-ink">
                      {runB.overall_score ??
                        "—"}
                    </p>

                    <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-muted">
                      Run B
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface p-5">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                    Passed cases
                  </p>

                  <span
                    className={`font-mono text-[10px] font-semibold ${deltaClass(
                      passedDelta
                    )}`}
                  >
                    {passedDelta > 0
                      ? `+${passedDelta}`
                      : passedDelta}
                  </span>
                </div>

                <div className="mt-4 flex items-end gap-3">
                  <div>
                    <p className="font-mono text-3xl text-ink">
                      {runA.passed_cases}
                    </p>

                    <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-muted">
                      Run A
                    </p>
                  </div>

                  <span className="mb-5 text-muted">
                    →
                  </span>

                  <div>
                    <p className="font-mono text-3xl text-ink">
                      {runB.passed_cases}
                    </p>

                    <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-muted">
                      Run B
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  Duration
                </p>

                <div className="mt-4 flex items-end gap-3">
                  <div>
                    <p className="font-mono text-2xl text-ink">
                      {formatDuration(
                        runA.total_duration
                      )}
                    </p>

                    <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-muted">
                      Run A
                    </p>
                  </div>

                  <span className="mb-4 text-muted">
                    →
                  </span>

                  <div>
                    <p className="font-mono text-2xl text-ink">
                      {formatDuration(
                        runB.total_duration
                      )}
                    </p>

                    <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-muted">
                      Run B
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Run identity */}
          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-brand">
                Run A
              </p>

              <h3 className="mt-2 font-serif text-2xl text-ink">
                {runA.prompt_title}
              </h3>

              <div className="mt-3 space-y-1 text-xs text-muted">
                <p>
                  Version:{" "}
                  <span className="font-mono text-ink">
                    v{runA.version_number}
                  </span>
                </p>

                <p>
                  Run ID:{" "}
                  <span className="font-mono text-ink">
                    #{runA.id}
                  </span>
                </p>

                <p>
                  Completed:{" "}
                  {formatDate(
                    runA.completed_at
                  )}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-brand">
                Run B
              </p>

              <h3 className="mt-2 font-serif text-2xl text-ink">
                {runB.prompt_title}
              </h3>

              <div className="mt-3 space-y-1 text-xs text-muted">
                <p>
                  Version:{" "}
                  <span className="font-mono text-ink">
                    v{runB.version_number}
                  </span>
                </p>

                <p>
                  Run ID:{" "}
                  <span className="font-mono text-ink">
                    #{runB.id}
                  </span>
                </p>

                <p>
                  Completed:{" "}
                  {formatDate(
                    runB.completed_at
                  )}
                </p>
              </div>
            </div>
          </section>

          {/* Criterion comparison */}
          <section>
            <div className="mb-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                Criterion analysis
              </p>

              <h2 className="mt-1 font-serif text-3xl text-ink">
                Where did the score change?
              </h2>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-surface">
              <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] border-b border-border bg-background px-5 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  Criterion
                </p>

                <p className="text-right font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  Run A
                </p>

                <p className="text-right font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  Run B
                </p>

                <p className="text-right font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  Change
                </p>
              </div>

              {criterionComparisons.map(
                (item) => (
                  <div
                    key={item.criterion}
                    className="grid grid-cols-[1.5fr_1fr_1fr_1fr] border-b border-border px-5 py-4 last:border-b-0"
                  >
                    <p className="text-sm text-ink">
                      {item.criterion.replace(
                        /_/g,
                        " "
                      )}
                    </p>

                    <p className="text-right font-mono text-sm text-ink">
                      {item.firstAverage !==
                      null
                        ? item.firstAverage.toFixed(
                            2
                          )
                        : "—"}
                    </p>

                    <p className="text-right font-mono text-sm text-ink">
                      {item.secondAverage !==
                      null
                        ? item.secondAverage.toFixed(
                            2
                          )
                        : "—"}
                    </p>

                    <p
                      className={`text-right font-mono text-sm font-semibold ${deltaClass(
                        item.delta
                      )}`}
                    >
                      {formatDelta(
                        item.delta
                      )}
                    </p>
                  </div>
                )
              )}
            </div>
          </section>

          {/* Case comparison */}
          <section>
            <div className="mb-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                Test case analysis
              </p>

              <h2 className="mt-1 font-serif text-3xl text-ink">
                Case-by-case comparison
              </h2>

              <p className="mt-2 text-sm text-muted">
                Positive changes are shown as improvements;
                negative changes are flagged as regressions.
              </p>
            </div>

            <div className="space-y-4">
              {caseComparisons.map(
                (item) => (
                  <article
                    key={item.first.test_case}
                    className="rounded-xl border border-border bg-surface"
                  >
                    <div className="flex flex-col justify-between gap-3 border-b border-border p-5 md:flex-row md:items-center">
                      <div>
                        <h3 className="text-sm font-semibold text-ink">
                          {item.first.test_case_name}
                        </h3>

                        <p className="mt-1 font-mono text-[10px] text-muted">
                          Test case #
                          {item.first.test_case}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] ${regressionClass(
                            item.scoreDelta
                          )}`}
                        >
                          {regressionLabel(
                            item.scoreDelta
                          )}
                        </span>

                        <span
                          className={`font-mono text-lg font-semibold ${deltaClass(
                            item.scoreDelta
                          )}`}
                        >
                          {formatDelta(
                            item.scoreDelta
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-4 p-5 md:grid-cols-2">
                      {/* Run A */}
                      <div className="rounded-lg border border-border bg-background p-4">
                        <div className="flex items-center justify-between">
                          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                            Run A · v
                            {runA.version_number}
                          </p>

                          <p className="font-mono text-xl text-ink">
                            {item.first.score ??
                              "—"}
                          </p>
                        </div>

                        {item.first.execution_output && (
                          <div className="mt-4">
                            <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                              Response
                            </p>

                            <p className="whitespace-pre-wrap text-sm leading-6 text-muted">
                              {
                                item.first
                                  .execution_output
                              }
                            </p>
                          </div>
                        )}

                        {item.first.feedback && (
                          <div className="mt-4 border-t border-border pt-3">
                            <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                              Feedback
                            </p>

                            <p className="text-xs leading-5 text-muted">
                              {item.first.feedback}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Run B */}
                      <div className="rounded-lg border border-border bg-background p-4">
                        <div className="flex items-center justify-between">
                          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                            Run B · v
                            {runB.version_number}
                          </p>

                          <p className="font-mono text-xl text-ink">
                            {item.second?.score ??
                              "—"}
                          </p>
                        </div>

                        {item.second?.execution_output && (
                          <div className="mt-4">
                            <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                              Response
                            </p>

                            <p className="whitespace-pre-wrap text-sm leading-6 text-muted">
                              {
                                item.second
                                  .execution_output
                              }
                            </p>
                          </div>
                        )}

                        {item.second?.feedback && (
                          <div className="mt-4 border-t border-border pt-3">
                            <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                              Feedback
                            </p>

                            <p className="text-xs leading-5 text-muted">
                              {item.second.feedback}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                )
              )}
            </div>
          </section>

         <RegressionAnalysis
  runA={runA}
  runB={runB}
/>

          <div className="border-t border-border pt-6">
            <Link
              to="/dashboard/evaluations/run"
              className="inline-flex items-center justify-center gap-2 rounded-control bg-brand px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              Run another evaluation
            </Link>
          </div>
        </>
      )}
    </div>
  );
}