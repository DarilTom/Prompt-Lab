import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

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
  if (nanoseconds === null || nanoseconds === undefined) {
    return "—";
  }
  const seconds = Number(nanoseconds) / 1_000_000_000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining.toFixed(1)}s`;
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

function delta(a, b) {
  const first = Number(a);
  const second = Number(b);
  if (Number.isNaN(first) || Number.isNaN(second)) {
    return null;
  }
  return second - first;
}

function formatDelta(value) {
  if (value === null || Number.isNaN(value)) {
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
  return value > 0 ? "text-success" : "text-error";
}

function caseOutcome(scoreDelta) {
  if (scoreDelta === null || Number.isNaN(scoreDelta)) {
    return { label: "No comparison", className: "bg-border text-muted" };
  }
  if (scoreDelta > 0) {
    return {
      label: `Run B higher (+${scoreDelta.toFixed(2)})`,
      className: "bg-success/10 text-success",
    };
  }
  if (scoreDelta < 0) {
    return {
      label: `Run A higher (${scoreDelta.toFixed(2)})`,
      className: "bg-error/10 text-error",
    };
  }
  return { label: "Equal score", className: "bg-border text-muted" };
}

function generateComparisonSummary(runA, runB, caseComparisons, scoreDelta) {
  if (!runA || !runB) return "";
  const diff = scoreDelta ?? 0;
  const absDiff = Math.abs(diff).toFixed(2);
  const improved = caseComparisons.filter((c) => c.scoreDelta > 0).length;
  const regressed = caseComparisons.filter((c) => c.scoreDelta < 0).length;
  const equal = caseComparisons.filter((c) => c.scoreDelta === 0).length;
  const total = caseComparisons.length;

  let overallOutcome = "had the same overall score";
  if (diff > 0) {
    overallOutcome = `scored ${absDiff} points higher overall (${runB.overall_score} vs ${runA.overall_score})`;
  } else if (diff < 0) {
    overallOutcome = `scored ${absDiff} points lower overall (${runB.overall_score} vs ${runA.overall_score})`;
  }

  const passSummary = `Pass count moved from ${runA.passed_cases}/${runA.total_cases} in Run A to ${runB.passed_cases}/${runB.total_cases} in Run B.`;
  const caseSummary = `Across ${total} test cases, Run B scored higher on ${improved}, lower on ${regressed}, and remained equal on ${equal}.`;

  return `In this observed comparison, Run B (v${runB.version_number}) ${overallOutcome} than Run A (v${runA.version_number}). ${caseSummary} ${passSummary}`;
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
  return `Run #${run.id} · ${run.prompt_title || "Untitled"} · v${run.version_number} · Score: ${run.overall_score ?? "—"}`;
}

export default function EvaluationCompare() {
  const [searchParams] = useSearchParams();

  const [runs, setRuns] = useState([]);
  const [runAId, setRunAId] = useState(searchParams.get("a") || "");
  const [runBId, setRunBId] = useState(searchParams.get("b") || "");
  const [runA, setRunA] = useState(null);
  const [runB, setRunB] = useState(null);

  const [loadingRuns, setLoadingRuns] = useState(true);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadRuns() {
      try {
        setLoadingRuns(true);
        setError("");

        const data = await getEvaluationRuns();
        const completedRuns = unwrapList(data).filter(
          (run) => run.status === "completed"
        );

        setRuns(completedRuns);

        if (!runAId && !runBId && completedRuns.length >= 2) {
          setRunAId(String(completedRuns[1].id));
          setRunBId(String(completedRuns[0].id));
        }
      } catch (err) {
        console.error(err);
        setError(err.message || "Unable to load evaluation runs.");
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
      setError("Please select two different evaluation runs.");
      setRunA(null);
      setRunB(null);
      return;
    }

    async function loadComparison() {
      try {
        setLoadingComparison(true);
        setError("");

        const [first, second] = await Promise.all([
          getEvaluationRun(runAId),
          getEvaluationRun(runBId),
        ]);

        if (String(first.dataset) !== String(second.dataset)) {
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
        setError(err.message || "Unable to load the selected runs.");
      } finally {
        setLoadingComparison(false);
      }
    }

    loadComparison();
  }, [runAId, runBId]);

  const scoreDelta = useMemo(() => {
    if (!runA || !runB) return null;
    return delta(runA.overall_score, runB.overall_score);
  }, [runA, runB]);

  const passedDelta = useMemo(() => {
    if (!runA || !runB) return null;
    return Number(runB.passed_cases) - Number(runA.passed_cases);
  }, [runA, runB]);

  const caseComparisons = useMemo(() => {
    if (!runA || !runB) return [];

    const firstResults = runA.results || [];
    const secondResults = runB.results || [];

    const secondByTestCase = new Map(
      secondResults.map((result) => [String(result.test_case), result])
    );

    return firstResults.map((firstResult) => {
      const secondResult = secondByTestCase.get(String(firstResult.test_case));

      return {
        first: firstResult,
        second: secondResult || null,
        scoreDelta: secondResult
          ? delta(firstResult.score, secondResult.score)
          : null,
      };
    });
  }, [runA, runB]);

  const criterionComparisons = useMemo(() => {
    if (!runA || !runB) return [];

    const firstCriteria = {};
    const secondCriteria = {};

    (runA.results || []).forEach((result) => {
      Object.entries(result.criteria_scores || {}).forEach(
        ([criterion, value]) => {
          if (!firstCriteria[criterion]) {
            firstCriteria[criterion] = [];
          }
          firstCriteria[criterion].push(Number(value));
        }
      );
    });

    (runB.results || []).forEach((result) => {
      Object.entries(result.criteria_scores || {}).forEach(
        ([criterion, value]) => {
          if (!secondCriteria[criterion]) {
            secondCriteria[criterion] = [];
          }
          secondCriteria[criterion].push(Number(value));
        }
      );
    });

    const criteria = Array.from(
      new Set([
        ...Object.keys(firstCriteria),
        ...Object.keys(secondCriteria),
      ])
    );

    return criteria.map((criterion) => {
      const firstValues = firstCriteria[criterion] || [];
      const secondValues = secondCriteria[criterion] || [];

      const firstAverage = firstValues.length
        ? firstValues.reduce((sum, value) => sum + value, 0) / firstValues.length
        : null;

      const secondAverage = secondValues.length
        ? secondValues.reduce((sum, value) => sum + value, 0) / secondValues.length
        : null;

      return {
        criterion,
        firstAverage,
        secondAverage,
        delta:
          firstAverage !== null && secondAverage !== null
            ? secondAverage - firstAverage
            : null,
      };
    });
  }, [runA, runB]);

  const summaryText = useMemo(() => {
    return generateComparisonSummary(runA, runB, caseComparisons, scoreDelta);
  }, [runA, runB, caseComparisons, scoreDelta]);

  if (loadingRuns) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-8 pb-12 max-w-5xl">
      {/* Back button & Title */}
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
            Compare Evaluations
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
            Select two completed evaluation runs on the same dataset to see how prompt revisions compare case-by-case.
          </p>
        </div>
      </div>

      {/* 1. Selectors & Compact Run Summary */}
      <section className="rounded-xl border border-border bg-surface p-6 shadow-subtle">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink">
              Run A — Baseline
            </label>
            <select
              value={runAId}
              onChange={(e) => setRunAId(e.target.value)}
              className="w-full rounded-control border border-border bg-background px-3 py-2.5 text-sm text-ink outline-none focus:border-brand"
            >
              <option value="">Select baseline run</option>
              {runs.map((run) => (
                <option key={run.id} value={run.id}>
                  {RunOptionLabel(run)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink">
              Run B — Comparison
            </label>
            <select
              value={runBId}
              onChange={(e) => setRunBId(e.target.value)}
              className="w-full rounded-control border border-border bg-background px-3 py-2.5 text-sm text-ink outline-none focus:border-brand"
            >
              <option value="">Select comparison run</option>
              {runs.map((run) => (
                <option key={run.id} value={run.id}>
                  {RunOptionLabel(run)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {runA && runB && (
          <div className="mt-5 border-t border-border pt-4">
            <div className="mb-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-background px-3 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                Dataset: {runA.dataset_name}
              </span>
              <span className="rounded-full bg-background px-3 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                {runA.total_cases} test cases
              </span>
              <span className="rounded-full bg-background px-3 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                {runA.model}
              </span>
            </div>

            {/* Compact summary cards for Run A and Run B */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-background p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-brand">
                    Run A (Baseline)
                  </span>
                  <span className="font-mono text-xs text-muted">#{runA.id}</span>
                </div>
                <p className="mt-1 font-medium text-ink truncate text-sm">
                  {runA.prompt_title}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded bg-surface px-2 py-0.5 font-mono text-xs border border-border text-ink">
                    v{runA.version_number}
                  </span>
                  <span className="rounded bg-surface px-2 py-0.5 font-mono text-xs font-semibold border border-border text-ink">
                    Score: {runA.overall_score ?? "—"}
                  </span>
                  <span className="rounded bg-surface px-2 py-0.5 font-mono text-xs font-semibold border border-border text-success">
                    {runA.passed_cases}/{runA.total_cases} passed
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-background p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-brand">
                    Run B (Comparison)
                  </span>
                  <span className="font-mono text-xs text-muted">#{runB.id}</span>
                </div>
                <p className="mt-1 font-medium text-ink truncate text-sm">
                  {runB.prompt_title}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded bg-surface px-2 py-0.5 font-mono text-xs border border-border text-ink">
                    v{runB.version_number}
                  </span>
                  <span className="rounded bg-surface px-2 py-0.5 font-mono text-xs font-semibold border border-border text-ink">
                    Score: {runB.overall_score ?? "—"}
                  </span>
                  <span className="rounded bg-surface px-2 py-0.5 font-mono text-xs font-semibold border border-border text-success">
                    {runB.passed_cases}/{runB.total_cases} passed
                  </span>
                </div>
              </div>
            </div>
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
              Loading comparison data...
            </p>
          </div>
        </div>
      )}

      {runA && runB && !loadingComparison && (
        <>
          {/* 2. Plain-English Summary Banner */}
          <div className="rounded-xl border border-brand/20 bg-brand/5 p-5">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand/10 font-mono text-xs font-bold text-brand">
                ℹ
              </span>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-brand">
                Observed Comparison Summary
              </p>
            </div>
            <p className="mt-2 text-sm leading-6 text-ink">
              {summaryText}
            </p>
          </div>

          {/* 3. Simple Test Case Comparison */}
          <section className="space-y-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-serif text-2xl text-ink">
                  Test Case Results
                </h2>
                <p className="text-xs text-muted">
                  Click any test case to compare the generated model responses and evaluator feedback.
                </p>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs text-muted">
                <span className="inline-block h-2 w-2 rounded-full bg-success" /> Run B higher
                <span className="ml-2 inline-block h-2 w-2 rounded-full bg-error" /> Run A higher
              </div>
            </div>

            <div className="space-y-3">
              {caseComparisons.map((item) => {
                const outcome = caseOutcome(item.scoreDelta);
                return (
                  <details
                    key={item.first.test_case}
                    className="group rounded-xl border border-border bg-surface transition-colors open:ring-1 open:ring-border"
                  >
                    <summary className="flex cursor-pointer list-none flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center hover:bg-background/50">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <svg
                            width="14"
                            height="14"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="shrink-0 text-muted transition-transform group-open:rotate-90"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M9 18l6-6-6-6"
                            />
                          </svg>
                          <h3 className="truncate text-sm font-medium text-ink">
                            {item.first.test_case_name || `Case #${item.first.test_case}`}
                          </h3>
                        </div>
                        <p className="ml-5 mt-0.5 font-mono text-[10px] text-muted">
                          Test case #{item.first.test_case}
                        </p>
                      </div>

                      <div className="ml-5 flex items-center gap-4 sm:ml-0">
                        {/* Score comparison pill */}
                        <div className="flex items-center gap-2 font-mono text-xs">
                          <span className="text-muted">A:</span>
                          <span className="font-semibold text-ink">
                            {item.first.score ?? "—"}
                          </span>
                          <span className="text-muted">vs</span>
                          <span className="text-muted">B:</span>
                          <span className="font-semibold text-ink">
                            {item.second?.score ?? "—"}
                          </span>
                        </div>

                        {/* Outcome badge */}
                        <span
                          className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-medium ${outcome.className}`}
                        >
                          {outcome.label}
                        </span>
                      </div>
                    </summary>

                    {/* Expanded details: Response and feedback side by side */}
                    <div className="border-t border-border p-5">
                      <div className="grid gap-4 md:grid-cols-2">
                        {/* Run A Output */}
                        <div className="rounded-lg border border-border bg-background p-4">
                          <div className="flex items-center justify-between border-b border-border pb-2">
                            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                              Run A (v{runA.version_number}) Output
                            </span>
                            <span className="font-mono text-xs font-semibold text-ink">
                              Score: {item.first.score ?? "—"}
                            </span>
                          </div>

                          <div className="mt-3">
                            <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                              Response
                            </p>
                            <p className="whitespace-pre-wrap text-xs leading-6 text-ink">
                              {item.first.execution_output || "No response recorded."}
                            </p>
                          </div>

                          {item.first.feedback && (
                            <div className="mt-3 border-t border-border pt-2.5">
                              <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                                Evaluator Feedback
                              </p>
                              <p className="text-xs leading-5 text-muted">
                                {item.first.feedback}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Run B Output */}
                        <div className="rounded-lg border border-border bg-background p-4">
                          <div className="flex items-center justify-between border-b border-border pb-2">
                            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                              Run B (v{runB.version_number}) Output
                            </span>
                            <span className="font-mono text-xs font-semibold text-ink">
                              Score: {item.second?.score ?? "—"}
                            </span>
                          </div>

                          <div className="mt-3">
                            <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                              Response
                            </p>
                            <p className="whitespace-pre-wrap text-xs leading-6 text-ink">
                              {item.second?.execution_output || "No response recorded."}
                            </p>
                          </div>

                          {item.second?.feedback && (
                            <div className="mt-3 border-t border-border pt-2.5">
                              <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                                Evaluator Feedback
                              </p>
                              <p className="text-xs leading-5 text-muted">
                                {item.second.feedback}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          </section>

          {/* 4. Collapsible "Detailed Analysis" Section */}
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
                <span>Detailed analysis (Criteria breakdown, regression map &amp; metrics)</span>
              </div>
              <span className="font-mono text-xs text-muted">
                Click to expand
              </span>
            </summary>

            <div className="border-t border-border p-6 space-y-8">
              {/* Score by Criterion */}
              <div>
                <h4 className="text-sm font-semibold text-ink mb-2">
                  Criterion-by-criterion breakdown
                </h4>
                <p className="text-xs text-muted mb-4">
                  Average score change across all test cases for each evaluation criterion.
                </p>

                <div className="overflow-hidden rounded-lg border border-border bg-background">
                  <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] border-b border-border bg-surface px-5 py-3">
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

                  {criterionComparisons.map((item) => (
                    <div
                      key={item.criterion}
                      className="grid grid-cols-[1.5fr_1fr_1fr_1fr] border-b border-border px-5 py-3.5 last:border-b-0"
                    >
                      <p className="text-sm text-ink capitalize">
                        {item.criterion.replace(/_/g, " ")}
                      </p>
                      <p className="text-right font-mono text-sm text-ink">
                        {item.firstAverage !== null
                          ? item.firstAverage.toFixed(2)
                          : "—"}
                      </p>
                      <p className="text-right font-mono text-sm text-ink">
                        {item.secondAverage !== null
                          ? item.secondAverage.toFixed(2)
                          : "—"}
                      </p>
                      <p
                        className={`text-right font-mono text-sm font-semibold ${deltaClass(
                          item.delta
                        )}`}
                      >
                        {formatDelta(item.delta)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Technical Execution Metrics */}
              <div>
                <h4 className="text-sm font-semibold text-ink mb-3">
                  Execution metrics
                </h4>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border border-border bg-background p-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                      Overall score
                    </p>
                    <p className="mt-2 font-mono text-xl text-ink">
                      {runA.overall_score ?? "—"} → {runB.overall_score ?? "—"}
                    </p>
                    <p className={`mt-1 font-mono text-xs font-semibold ${deltaClass(scoreDelta)}`}>
                      {formatDelta(scoreDelta)} change
                    </p>
                  </div>

                  <div className="rounded-lg border border-border bg-background p-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                      Passed cases
                    </p>
                    <p className="mt-2 font-mono text-xl text-ink">
                      {runA.passed_cases} → {runB.passed_cases}
                    </p>
                    <p className={`mt-1 font-mono text-xs font-semibold ${deltaClass(passedDelta)}`}>
                      {passedDelta > 0 ? `+${passedDelta}` : passedDelta} passed
                    </p>
                  </div>

                  <div className="rounded-lg border border-border bg-background p-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                      Duration
                    </p>
                    <p className="mt-2 font-mono text-base text-ink">
                      {formatDuration(runA.total_duration)} → {formatDuration(runB.total_duration)}
                    </p>
                    <p className="mt-1 font-mono text-xs text-muted">
                      Ollama inference time
                    </p>
                  </div>
                </div>
              </div>

              {/* Advanced Regression Analysis Component */}
              <div>
                <h4 className="text-sm font-semibold text-ink mb-3">
                  Regression thresholds &amp; classification
                </h4>
                <RegressionAnalysis runA={runA} runB={runB} />
              </div>
            </div>
          </details>

          {/* Action button */}
          <div className="border-t border-border pt-4">
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
