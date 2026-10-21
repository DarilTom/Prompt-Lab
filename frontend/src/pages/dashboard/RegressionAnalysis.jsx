import { useMemo, useState } from "react";

function classifyChange(change, threshold) {
  if (change === null) {
    return "unknown";
  }

  if (change >= threshold) {
    return "improvement";
  }

  if (change <= -threshold) {
    return "regression";
  }

  return "neutral";
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

function deltaClass(change, threshold) {
  const classification = classifyChange(
    change,
    threshold
  );

  if (classification === "improvement") {
    return "text-success";
  }

  if (classification === "regression") {
    return "text-error";
  }

  return "text-muted";
}

function badgeClass(change, threshold) {
  const classification = classifyChange(
    change,
    threshold
  );

  if (classification === "improvement") {
    return "bg-success/10 text-success";
  }

  if (classification === "regression") {
    return "bg-error/10 text-error";
  }

  return "bg-border text-muted";
}

function classificationLabel(change, threshold) {
  const classification = classifyChange(
    change,
    threshold
  );

  if (classification === "improvement") {
    return "Improvement";
  }

  if (classification === "regression") {
    return "Regression";
  }

  if (classification === "neutral") {
    return "No material change";
  }

  return "Unavailable";
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

export default function RegressionAnalysis({
  runA,
  runB,
}) {
  const [threshold, setThreshold] =
    useState(5);

  const analysis = useMemo(() => {
    if (!runA || !runB) {
      return null;
    }

    const firstResults = runA.results || [];
    const secondResults = runB.results || [];

    const secondByCase = new Map(
      secondResults.map((result) => [
        String(result.test_case),
        result,
      ])
    );

    const cases = firstResults
      .map((first) => {
        const second =
          secondByCase.get(
            String(first.test_case)
          );

        if (!second) {
          return {
            testCase: first.test_case,
            name: first.test_case_name,
            first,
            second: null,
            change: null,
            classification: "unknown",
          };
        }

        const firstScore = Number(
          first.score
        );

        const secondScore = Number(
          second.score
        );

        if (
          Number.isNaN(firstScore) ||
          Number.isNaN(secondScore)
        ) {
          return {
            testCase: first.test_case,
            name: first.test_case_name,
            first,
            second,
            change: null,
            classification: "unknown",
          };
        }

        const change =
          secondScore - firstScore;

        return {
          testCase: first.test_case,
          name: first.test_case_name,
          first,
          second,
          change,
          classification: classifyChange(
            change,
            threshold
          ),
        };
      })
      .sort((a, b) => {
        // Regressions first, then neutral, then improvements.
        const order = {
          regression: 0,
          unknown: 1,
          neutral: 2,
          improvement: 3,
        };

        return (
          order[a.classification] -
          order[b.classification]
        );
      });

    const improvementCount =
      cases.filter(
        (item) =>
          item.classification ===
          "improvement"
      ).length;

    const regressionCount =
      cases.filter(
        (item) =>
          item.classification ===
          "regression"
      ).length;

    const neutralCount =
      cases.filter(
        (item) =>
          item.classification ===
          "neutral"
      ).length;

    const unknownCount =
      cases.filter(
        (item) =>
          item.classification ===
          "unknown"
      ).length;

    const criterionMap = new Map();

    function collectCriteria(results, side) {
      results.forEach((result) => {
        Object.entries(
          result.criteria_scores || {}
        ).forEach(
          ([criterion, rawValue]) => {
            const value = Number(rawValue);

            if (Number.isNaN(value)) {
              return;
            }

            if (!criterionMap.has(criterion)) {
              criterionMap.set(
                criterion,
                {
                  a: [],
                  b: [],
                }
              );
            }

            criterionMap.get(criterion)[side].push(
              value
            );
          }
        );
      });
    }

    collectCriteria(firstResults, "a");
    collectCriteria(secondResults, "b");

    const criteria = Array.from(
      criterionMap.entries()
    ).map(
      ([criterion, values]) => {
        const firstAverage =
          average(values.a);

        const secondAverage =
          average(values.b);

        const change =
          firstAverage !== null &&
          secondAverage !== null
            ? secondAverage - firstAverage
            : null;

        return {
          criterion,
          firstAverage,
          secondAverage,
          change,
          classification:
            change === null
              ? "unknown"
              : classifyChange(
                  change,
                  threshold
                ),
        };
      }
    );

    const overallChange =
      Number(runB.overall_score) -
      Number(runA.overall_score);

    const passedChange =
      Number(runB.passed_cases) -
      Number(runA.passed_cases);

    const failedChange =
      Number(runB.failed_cases) -
      Number(runA.failed_cases);

    return {
      cases,
      criteria,
      improvementCount,
      regressionCount,
      neutralCount,
      unknownCount,
      overallChange,
      passedChange,
      failedChange,
    };
  }, [runA, runB, threshold]);

  if (!analysis) {
    return null;
  }

  const {
    cases,
    criteria,
    improvementCount,
    regressionCount,
    neutralCount,
    unknownCount,
    overallChange,
    passedChange,
    failedChange,
  } = analysis;

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            Regression analysis
          </p>

          <h2 className="mt-1 font-serif text-3xl text-ink">
            Detect meaningful changes.
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Changes smaller than the selected threshold are
            treated as no material change. Larger decreases
            are flagged as regressions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="regression-threshold"
            className="text-xs text-muted"
          >
            Threshold
          </label>

          <input
            id="regression-threshold"
            type="number"
            min="1"
            max="50"
            step="0.5"
            value={threshold}
            onChange={(event) => {
              const value =
                Number(event.target.value);

              if (
                Number.isFinite(value) &&
                value >= 1 &&
                value <= 50
              ) {
                setThreshold(value);
              }
            }}
            className="w-20 rounded-control border border-border bg-surface px-3 py-2 font-mono text-sm text-ink outline-none focus:border-brand"
          />

          <span className="font-mono text-[10px] text-muted">
            points
          </span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-muted">
            Improvements
          </p>

          <p className="mt-2 font-mono text-3xl text-success">
            {improvementCount}
          </p>

          <p className="mt-1 text-xs text-muted">
            Cases at or above +{threshold} points
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-muted">
            Regressions
          </p>

          <p className="mt-2 font-mono text-3xl text-error">
            {regressionCount}
          </p>

          <p className="mt-1 text-xs text-muted">
            Cases at or below -{threshold} points
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-muted">
            No material change
          </p>

          <p className="mt-2 font-mono text-3xl text-muted">
            {neutralCount}
          </p>

          <p className="mt-1 text-xs text-muted">
            Changes smaller than the threshold
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-muted">
            Overall change
          </p>

          <p
            className={`mt-2 font-mono text-3xl ${deltaClass(
              overallChange,
              threshold
            )}`}
          >
            {formatDelta(overallChange)}
          </p>

          <p className="mt-1 text-xs text-muted">
            Run B score minus Run A score
          </p>
        </div>
      </div>

      {/* Run-level changes */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="mb-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
            Run-level signal
          </p>

          <h3 className="mt-1 font-serif text-2xl text-ink">
            Outcome changes
          </h3>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted">
              Overall score
            </p>

            <div className="mt-2 flex items-center justify-between gap-4">
              <span className="font-mono text-sm text-ink">
                {runA.overall_score}
                {" → "}
                {runB.overall_score}
              </span>

              <span
                className={`font-mono text-sm font-semibold ${deltaClass(
                  overallChange,
                  threshold
                )}`}
              >
                {formatDelta(overallChange)}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted">
              Passed cases
            </p>

            <div className="mt-2 flex items-center justify-between gap-4">
              <span className="font-mono text-sm text-ink">
                {runA.passed_cases}
                {" → "}
                {runB.passed_cases}
              </span>

              <span
                className={`font-mono text-sm font-semibold ${
                  passedChange > 0
                    ? "text-success"
                    : passedChange < 0
                      ? "text-error"
                      : "text-muted"
                }`}
              >
                {passedChange > 0
                  ? `+${passedChange}`
                  : passedChange}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted">
              Failed cases
            </p>

            <div className="mt-2 flex items-center justify-between gap-4">
              <span className="font-mono text-sm text-ink">
                {runA.failed_cases}
                {" → "}
                {runB.failed_cases}
              </span>

              <span
                className={`font-mono text-sm font-semibold ${
                  failedChange > 0
                    ? "text-error"
                    : failedChange < 0
                      ? "text-success"
                      : "text-muted"
                }`}
              >
                {failedChange > 0
                  ? `+${failedChange}`
                  : failedChange}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Criterion analysis */}
      <div className="rounded-xl border border-border bg-surface">
        <div className="border-b border-border p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
            Criterion analysis
          </p>

          <h3 className="mt-1 font-serif text-2xl text-ink">
            Evaluation criteria
          </h3>
        </div>

        <div className="divide-y divide-border">
          {criteria.map((item) => (
            <div
              key={item.criterion}
              className="grid gap-3 px-5 py-4 md:grid-cols-[1.6fr_1fr_1fr_1fr_auto] md:items-center"
            >
              <p className="text-sm capitalize text-ink">
                {item.criterion.replace(
                  /_/g,
                  " "
                )}
              </p>

              <p className="font-mono text-sm text-muted md:text-right">
                A:{" "}
                {item.firstAverage !== null
                  ? item.firstAverage.toFixed(2)
                  : "—"}
              </p>

              <p className="font-mono text-sm text-muted md:text-right">
                B:{" "}
                {item.secondAverage !== null
                  ? item.secondAverage.toFixed(2)
                  : "—"}
              </p>

              <p
                className={`font-mono text-sm font-semibold md:text-right ${deltaClass(
                  item.change,
                  threshold
                )}`}
              >
                {formatDelta(item.change)}
              </p>

              <span
                className={`w-fit rounded-full px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] ${badgeClass(
                  item.change,
                  threshold
                )}`}
              >
                {classificationLabel(
                  item.change,
                  threshold
                )}
              </span>
            </div>
          ))}

          {criteria.length === 0 && (
            <div className="p-6 text-center text-sm text-muted">
              No criterion data is available for these runs.
            </div>
          )}
        </div>
      </div>

      {/* Case analysis */}
      <div className="rounded-xl border border-border bg-surface">
        <div className="border-b border-border p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
            Test-case analysis
          </p>

          <h3 className="mt-1 font-serif text-2xl text-ink">
            Regression map
          </h3>

          <p className="mt-2 text-sm text-muted">
            Cases are ordered with detected regressions first.
          </p>
        </div>

        <div className="divide-y divide-border">
          {cases.map((item) => (
            <div
              key={item.testCase}
              className="grid gap-4 px-5 py-4 md:grid-cols-[1.4fr_0.8fr_0.8fr_0.7fr_auto] md:items-center"
            >
              <div>
                <p className="text-sm font-medium text-ink">
                  {item.name}
                </p>

                <p className="mt-1 font-mono text-[10px] text-muted">
                  Test case #{item.testCase}
                </p>
              </div>

              <p className="font-mono text-sm text-muted md:text-right">
                A:{" "}
                {item.first?.score ?? "—"}
              </p>

              <p className="font-mono text-sm text-muted md:text-right">
                B:{" "}
                {item.second?.score ?? "—"}
              </p>

              <p
                className={`font-mono text-sm font-semibold md:text-right ${deltaClass(
                  item.change,
                  threshold
                )}`}
              >
                {formatDelta(item.change)}
              </p>

              <span
                className={`w-fit rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] ${badgeClass(
                  item.change,
                  threshold
                )}`}
              >
                {classificationLabel(
                  item.change,
                  threshold
                )}
              </span>
            </div>
          ))}

          {cases.length === 0 && (
            <div className="p-6 text-center text-sm text-muted">
              No test-case results are available.
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="rounded-lg border border-border bg-background p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
          Analysis rule
        </p>

        <p className="mt-2 text-xs leading-5 text-muted">
          Run B is classified as an improvement when its score
          increases by at least {threshold} points, a regression
          when it decreases by at least {threshold} points, and
          a no-material-change result for smaller movements.
        </p>

        {unknownCount > 0 && (
          <p className="mt-2 text-xs text-warning">
            {unknownCount} result
            {unknownCount === 1
              ? ""
              : "s"} could not be classified because
            comparison data was unavailable.
          </p>
        )}
      </div>
    </section>
  );
}