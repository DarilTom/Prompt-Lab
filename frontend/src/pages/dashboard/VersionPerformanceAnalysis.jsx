
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getEvaluationRuns } from "../../services/evaluationService";

const REQUIRED_CRITERIA = [
  "relevance",
  "expected_output_alignment",
  "expected_behavior",
  "overall_quality",
];

function unwrapList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function average(values) {
  if (!values.length) return null;

  return (
    values.reduce((sum, value) => sum + value, 0) /
    values.length
  );
}

// Population standard deviation.
// At least two observations are needed to report variability.
function standardDeviation(values) {
  if (values.length < 2) return null;

  const mean = average(values);

  const variance =
    values.reduce(
      (sum, value) => sum + (value - mean) ** 2,
      0
    ) / values.length;

  return Math.sqrt(variance);
}

function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined) return "—";

  const number = Number(value);

  return Number.isFinite(number)
    ? number.toFixed(decimals)
    : "—";
}

function formatDelta(value) {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return value > 0
    ? `+${value.toFixed(2)}`
    : value.toFixed(2);
}

function formatDuration(nanoseconds) {
  if (nanoseconds === null || nanoseconds === undefined) {
    return "—";
  }

  const seconds = Number(nanoseconds) / 1_000_000_000;

  if (!Number.isFinite(seconds)) return "—";

  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  return `${Math.floor(seconds / 60)}m ${(seconds % 60).toFixed(1)}s`;
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

function scoreColor(value) {
  if (value === null) return "text-muted";

  return value >= 70
    ? "text-success"
    : "text-error";
}

function changeClass(value, threshold) {
  if (value === null) return "text-muted";
  if (value >= threshold) return "text-success";
  if (value <= -threshold) return "text-error";

  return "text-muted";
}

function changeLabel(value, threshold) {
  if (value === null) return "Unavailable";
  if (value >= threshold) return "Improvement";
  if (value <= -threshold) return "Regression";

  return "No material change";
}

function changeBadge(value, threshold) {
  if (value === null) {
    return "bg-border text-muted";
  }

  if (value >= threshold) {
    return "bg-success/10 text-success";
  }

  if (value <= -threshold) {
    return "bg-error/10 text-error";
  }

  return "bg-border text-muted";
}

/*
 * Historical data validation.
 *
 * A run is flagged if:
 * - It lacks test-case results.
 * - A test case has no usable score.
 * - One or more required criteria are missing.
 * - Scores are outside the 0–100 range.
 * - The result score disagrees with its criterion average.
 * - The stored run score disagrees with the result averages.
 * - A score appears to use the legacy 0–10 scale.
 *
 * These checks cannot prove that an LLM judge's assessment
 * is objectively correct. They detect data consistency issues.
 */
function getRunQualityIssue(run) {
  const results = run.results || [];
  const totalCases = Number(run.total_cases);

  if (
    results.length === 0 ||
    !Number.isFinite(totalCases) ||
    results.length !== totalCases
  ) {
    return "Missing or incomplete test-case results.";
  }

  const resultScores = [];

  for (const result of results) {
    if (
      result.status === "error" ||
      result.score === null ||
      result.score === undefined
    ) {
      return `Test case ${result.test_case} has no valid score.`;
    }

    const criteria = result.criteria_scores || {};

    const missingCriteria = REQUIRED_CRITERIA.filter(
      (key) =>
        !Object.prototype.hasOwnProperty.call(criteria, key)
    );

    if (missingCriteria.length > 0) {
      return `Test case ${result.test_case} has incomplete criterion scores.`;
    }

    const values = REQUIRED_CRITERIA.map((key) =>
      Number(criteria[key])
    );

    if (
      values.some(
        (value) =>
          !Number.isFinite(value) ||
          value < 0 ||
          value > 100
      )
    ) {
      return `Test case ${result.test_case} has invalid criterion scores.`;
    }

    const score = Number(result.score);

    if (
      !Number.isFinite(score) ||
      score < 0 ||
      score > 100
    ) {
      return `Test case ${result.test_case} has an invalid overall score.`;
    }

    // Flag possible legacy 0–10 scoring. Do not silently
    // rescale saved records because their original scale
    // cannot be established with certainty.
    if (
      Math.max(...values) <= 10 &&
      score <= 10
    ) {
      return `Test case ${result.test_case} may use a legacy 0–10 scoring scale.`;
    }

    const criterionMean =
      values.reduce((sum, value) => sum + value, 0) /
      REQUIRED_CRITERIA.length;

    if (Math.abs(criterionMean - score) > 0.11) {
      return `Test case ${result.test_case} score does not match its criterion average.`;
    }

    resultScores.push(score);
  }

  const calculatedRunScore =
    average(resultScores);

  const storedRunScore = Number(run.overall_score);

  if (
    !Number.isFinite(storedRunScore) ||
    Math.abs(calculatedRunScore - storedRunScore) > 0.11
  ) {
    return "Stored run score does not match the test-case averages.";
  }

  return null;
}

function summarizeRuns(versionRuns) {
  const scores = versionRuns
    .map((run) => numberOrNull(run.overall_score))
    .filter((value) => value !== null);

  const totalCases = versionRuns.reduce(
    (sum, run) => sum + Number(run.total_cases || 0),
    0
  );

  const passedCases = versionRuns.reduce(
    (sum, run) => sum + Number(run.passed_cases || 0),
    0
  );

  const durations = versionRuns
    .map((run) => numberOrNull(run.total_duration))
    .filter((value) => value !== null);

  const min = scores.length ? Math.min(...scores) : null;
  const max = scores.length ? Math.max(...scores) : null;

  return {
    runCount: versionRuns.length,
    scoredRuns: scores.length,
    mean: average(scores),
    min,
    max,
    range:
      min !== null && max !== null
        ? max - min
        : null,
    standardDeviation: standardDeviation(scores),
    totalCases,
    passedCases,
    casePassRate: totalCases
      ? (passedCases / totalCases) * 100
      : null,
    averageDuration: average(durations),
  };
}

function summarizeCases(versionRuns) {
  const cases = new Map();

  versionRuns.forEach((run) => {
    (run.results || []).forEach((result) => {
      const key = String(result.test_case);

      if (!cases.has(key)) {
        cases.set(key, {
          id: result.test_case,
          name: result.test_case_name || `Test case #${key}`,
          scores: [],
          observations: 0,
          passed: 0,
        });
      }

      const entry = cases.get(key);
      const score = numberOrNull(result.score);

      if (score !== null) {
        entry.scores.push(score);
      }

      entry.observations += 1;

      if (result.status === "passed") {
        entry.passed += 1;
      }
    });
  });

  return new Map(
    Array.from(cases.entries()).map(([key, entry]) => [
      key,
      {
        ...entry,
        mean: average(entry.scores),
        min: entry.scores.length
          ? Math.min(...entry.scores)
          : null,
        max: entry.scores.length
          ? Math.max(...entry.scores)
          : null,
        standardDeviation: standardDeviation(entry.scores),
        passRate: entry.observations
          ? (entry.passed / entry.observations) * 100
          : null,
      },
    ])
  );
}

function summarizeCriteria(versionRuns) {
  const criteria = new Map();

  versionRuns.forEach((run) => {
    (run.results || []).forEach((result) => {
      Object.entries(result.criteria_scores || {}).forEach(
        ([name, rawValue]) => {
          const value = numberOrNull(rawValue);

          if (value === null) return;

          if (!criteria.has(name)) {
            criteria.set(name, []);
          }

          criteria.get(name).push(value);
        }
      );
    });
  });

  return new Map(
    Array.from(criteria.entries()).map(([name, values]) => [
      name,
      {
        mean: average(values),
        observations: values.length,
      },
    ])
  );
}

function versionLabel(version) {
  return `v${version.versionNumber} · ${version.runs.length} run${
    version.runs.length === 1 ? "" : "s"
  } · mean ${formatNumber(version.stats.mean)}`;
}

function LoadingState() {
  return (
    <div className="flex min-h-[360px] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-border border-t-brand" />
        <p className="mt-4 text-sm text-muted">
          Loading version performance data...
        </p>
      </div>
    </div>
  );
}

export default function VersionPerformanceAnalysis() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [promptId, setPromptId] = useState("");
  const [datasetId, setDatasetId] = useState("");
  const [model, setModel] = useState("");

  const [versionAId, setVersionAId] = useState("");
  const [versionBId, setVersionBId] = useState("");
  const [threshold, setThreshold] = useState(2);

  const [includeFlaggedRuns, setIncludeFlaggedRuns] =
    useState(false);

  // Load only completed runs. Individual run records are not changed.
  useEffect(() => {
    let active = true;

    async function loadRuns() {
      try {
        setLoading(true);
        setError("");

        const data = await getEvaluationRuns();

        const completedRuns = unwrapList(data)
          .filter((run) => run.status === "completed")
          .sort(
            (a, b) =>
              new Date(b.created_at) - new Date(a.created_at)
          );

        if (!active) return;

        setRuns(completedRuns);

        if (completedRuns.length > 0) {
          const latest = completedRuns[0];

          setPromptId(String(latest.prompt));
          setDatasetId(String(latest.dataset));
          setModel(latest.model || "");
        }
      } catch (err) {
        if (!active) return;

        console.error(err);
        setError(
          err.message || "Unable to load evaluation history."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    loadRuns();

    return () => {
      active = false;
    };
  }, []);

  // Identify questionable historical records without deleting them.
  const flaggedRuns = useMemo(() => {
    return runs
      .map((run) => ({
        run,
        issue: getRunQualityIssue(run),
      }))
      .filter((item) => item.issue !== null);
  }, [runs]);

  // Exclude flagged records unless the user explicitly includes them.
  const analysisRuns = useMemo(() => {
    if (includeFlaggedRuns) {
      return runs;
    }

    return runs.filter(
      (run) => getRunQualityIssue(run) === null
    );
  }, [runs, includeFlaggedRuns]);

  // Prompt choices are based on all completed runs, including flagged ones,
  // so a user can inspect older data and choose to include it.
  const promptOptions = useMemo(() => {
    const unique = new Map();

    runs.forEach((run) => {
      const key = String(run.prompt);

      if (!unique.has(key)) {
        unique.set(key, {
          id: key,
          title: run.prompt_title || `Prompt #${key}`,
        });
      }
    });

    return Array.from(unique.values()).sort((a, b) =>
      a.title.localeCompare(b.title)
    );
  }, [runs]);

  const datasetOptions = useMemo(() => {
    const unique = new Map();

    runs
      .filter((run) => String(run.prompt) === promptId)
      .forEach((run) => {
        const key = String(run.dataset);

        if (!unique.has(key)) {
          unique.set(key, {
            id: key,
            name: run.dataset_name || `Dataset #${key}`,
          });
        }
      });

    return Array.from(unique.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [runs, promptId]);

  useEffect(() => {
    const valid = datasetOptions.some(
      (item) => item.id === datasetId
    );

    if (!valid) {
      setDatasetId(datasetOptions[0]?.id || "");
    }
  }, [datasetOptions, datasetId]);

  const modelOptions = useMemo(() => {
    return Array.from(
      new Set(
        runs
          .filter(
            (run) =>
              String(run.prompt) === promptId &&
              String(run.dataset) === datasetId
          )
          .map((run) => run.model)
          .filter(Boolean)
      )
    ).sort();
  }, [runs, promptId, datasetId]);

  useEffect(() => {
    if (!modelOptions.includes(model)) {
      setModel(modelOptions[0] || "");
    }
  }, [modelOptions, model]);

  // Group the eligible runs by database prompt-version ID.
  const versionOptions = useMemo(() => {
    const grouped = new Map();

    analysisRuns
      .filter(
        (run) =>
          String(run.prompt) === promptId &&
          String(run.dataset) === datasetId &&
          run.model === model
      )
      .forEach((run) => {
        const key = String(run.prompt_version);

        if (!grouped.has(key)) {
          grouped.set(key, {
            promptVersionId: key,
            versionNumber: Number(run.version_number || 0),
            runs: [],
          });
        }

        grouped.get(key).runs.push(run);
      });

    return Array.from(grouped.values())
      .sort(
        (a, b) =>
          a.versionNumber - b.versionNumber ||
          Number(a.promptVersionId) -
            Number(b.promptVersionId)
      )
      .map((version) => ({
        ...version,
        runs: [...version.runs].sort(
          (a, b) =>
            new Date(a.created_at) - new Date(b.created_at)
        ),
        stats: summarizeRuns(version.runs),
      }));
  }, [analysisRuns, promptId, datasetId, model]);

  // Keep existing selections if they're still valid. Otherwise choose
  // the first and last available versions.
  useEffect(() => {
    const ids = versionOptions.map(
      (version) => version.promptVersionId
    );

    setVersionAId((current) =>
      ids.includes(current) ? current : ids[0] || ""
    );

    setVersionBId((current) => {
      const baseline = ids.includes(versionAId)
        ? versionAId
        : ids[0];

      if (ids.includes(current) && current !== baseline) {
        return current;
      }

      return ids.find((id) => id !== baseline) || "";
    });
  }, [versionOptions, versionAId]);

  const versionA = versionOptions.find(
    (version) => version.promptVersionId === versionAId
  );

  const versionB = versionOptions.find(
    (version) => version.promptVersionId === versionBId
  );

  const analysis = useMemo(() => {
    if (
      !versionA ||
      !versionB ||
      versionAId === versionBId
    ) {
      return null;
    }

    const casesA = summarizeCases(versionA.runs);
    const casesB = summarizeCases(versionB.runs);

    const caseIds = Array.from(
      new Set([...casesA.keys(), ...casesB.keys()])
    );

    const caseRows = caseIds.map((key) => {
      const a = casesA.get(key) || null;
      const b = casesB.get(key) || null;

      return {
        id: a?.id ?? b?.id ?? key,
        name: a?.name ?? b?.name ?? `Test case #${key}`,
        a,
        b,
        scoreDelta:
          a?.mean !== null &&
          a?.mean !== undefined &&
          b?.mean !== null &&
          b?.mean !== undefined
            ? b.mean - a.mean
            : null,
        passRateDelta:
          a?.passRate !== null &&
          a?.passRate !== undefined &&
          b?.passRate !== null &&
          b?.passRate !== undefined
            ? b.passRate - a.passRate
            : null,
      };
    });

    const criteriaA = summarizeCriteria(versionA.runs);
    const criteriaB = summarizeCriteria(versionB.runs);

    const criterionNames = Array.from(
      new Set([
        ...criteriaA.keys(),
        ...criteriaB.keys(),
      ])
    );

    const criterionRows = criterionNames.map((name) => {
      const a = criteriaA.get(name);
      const b = criteriaB.get(name);

      return {
        name,
        a: a?.mean ?? null,
        b: b?.mean ?? null,
        delta:
          a?.mean !== null &&
          a?.mean !== undefined &&
          b?.mean !== null &&
          b?.mean !== undefined
            ? b.mean - a.mean
            : null,
      };
    });

    const scoreDelta =
      versionA.stats.mean !== null &&
      versionB.stats.mean !== null
        ? versionB.stats.mean - versionA.stats.mean
        : null;

    const variabilityDelta =
      versionA.stats.standardDeviation !== null &&
      versionB.stats.standardDeviation !== null
        ? versionB.stats.standardDeviation -
          versionA.stats.standardDeviation
        : null;

    const passRateDelta =
      versionA.stats.casePassRate !== null &&
      versionB.stats.casePassRate !== null
        ? versionB.stats.casePassRate -
          versionA.stats.casePassRate
        : null;

    return {
      caseRows,
      criterionRows,
      scoreDelta,
      variabilityDelta,
      passRateDelta,
      improvedCases: caseRows.filter(
        (item) =>
          item.scoreDelta !== null &&
          item.scoreDelta > 0
      ).length,
      regressedCases: caseRows.filter(
        (item) =>
          item.scoreDelta !== null &&
          item.scoreDelta < 0
      ).length,
      unchangedCases: caseRows.filter(
        (item) => item.scoreDelta === 0
      ).length,
    };
  }, [versionA, versionB, versionAId, versionBId]);

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-8 pb-12">
      {/* Page header */}
      <div className="flex flex-col gap-3">
        <Link
          to="/dashboard/evaluations"
          className="inline-flex w-fit items-center gap-2 text-xs font-medium text-muted hover:text-ink"
        >
          ← Back to evaluations
        </Link>

        <div>
          <h1 className="font-serif text-4xl tracking-tight text-ink">
            Did the prompt actually improve?
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Compare version-level averages across repeated evaluation
            runs, inspect consistency, and identify test cases that
            improved or regressed.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {/* Historical run quality warning */}
      {flaggedRuns.length > 0 && (
        <section className="rounded-xl border border-border bg-surface p-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-warning">
                Data quality review
              </p>

              <h2 className="mt-1 font-serif text-2xl text-ink">
                {flaggedRuns.length} historical run
                {flaggedRuns.length === 1 ? "" : "s"} flagged
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                These runs contain incomplete scores, inconsistent
                calculations, or possible legacy scoring-scale results.
                They are excluded from analysis by default. No records
                have been deleted.
              </p>
            </div>

            <label className="flex shrink-0 items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={includeFlaggedRuns}
                onChange={(event) =>
                  setIncludeFlaggedRuns(event.target.checked)
                }
                className="accent-current"
              />
              Include flagged runs
            </label>
          </div>

          <details className="mt-4 border-t border-border pt-3">
            <summary className="cursor-pointer list-none text-xs font-medium text-muted hover:text-ink">
              <span className="inline-flex items-center gap-1.5">
                <svg
                  width="12"
                  height="12"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="transition-transform [[open]_&]:rotate-90"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 18l6-6-6-6"
                  />
                </svg>
                Show flagged run details
              </span>
            </summary>

            <div className="mt-3 divide-y divide-border">
              {flaggedRuns.map(({ run, issue }) => (
                <div
                  key={run.id}
                  className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center"
                >
                  <div>
                    <p className="text-sm font-medium text-ink">
                      Evaluation #{run.id} · v{run.version_number}
                    </p>

                    <p className="mt-1 text-xs text-muted">
                      {run.prompt_title} · {run.dataset_name}
                    </p>
                  </div>

                  <div className="sm:text-right">
                    <p className="font-mono text-sm text-ink">
                      Score: {run.overall_score ?? "—"}
                    </p>

                    <p className="mt-1 max-w-md text-xs text-error">
                      {issue}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </details>
        </section>
      )}

      {/* Comparison setup */}
      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="mb-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
            Comparison setup
          </p>

          <h2 className="mt-1 font-serif text-2xl text-ink">
            Keep the experiment conditions consistent
          </h2>

          <p className="mt-2 text-sm text-muted">
            Both versions use the same prompt, dataset, and model.
            Statistics are calculated from the selected eligible runs.
          </p>
        </div>

        <div className="space-y-5">
          {/* Row 1: Experiment conditions */}
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink">
                Prompt
              </label>

              <select
                value={promptId}
                onChange={(event) => setPromptId(event.target.value)}
                className="w-full rounded-control border border-border bg-background px-3 py-2.5 text-sm text-ink outline-none focus:border-brand"
              >
                <option value="">Select prompt</option>

                {promptOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink">
                Dataset
              </label>

              <select
                value={datasetId}
                onChange={(event) => setDatasetId(event.target.value)}
                className="w-full rounded-control border border-border bg-background px-3 py-2.5 text-sm text-ink outline-none focus:border-brand"
              >
                <option value="">Select dataset</option>

                {datasetOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink">
                Model
              </label>

              <select
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className="w-full rounded-control border border-border bg-background px-3 py-2.5 text-sm text-ink outline-none focus:border-brand"
              >
                <option value="">Select model</option>

                {modelOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Row 2: Version comparison */}
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink">
                Baseline version
              </label>

              <select
                value={versionAId}
                onChange={(event) => setVersionAId(event.target.value)}
                className="w-full rounded-control border border-border bg-background px-3 py-2.5 text-sm text-ink outline-none focus:border-brand"
              >
                <option value="">Select baseline version</option>

                {versionOptions.map((item) => (
                  <option
                    key={item.promptVersionId}
                    value={item.promptVersionId}
                    disabled={item.promptVersionId === versionBId}
                  >
                    {versionLabel(item)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink">
                Comparison version
              </label>

              <select
                value={versionBId}
                onChange={(event) => setVersionBId(event.target.value)}
                className="w-full rounded-control border border-border bg-background px-3 py-2.5 text-sm text-ink outline-none focus:border-brand"
              >
                <option value="">Select comparison version</option>

                {versionOptions.map((item) => (
                  <option
                    key={item.promptVersionId}
                    value={item.promptVersionId}
                    disabled={item.promptVersionId === versionAId}
                  >
                    {versionLabel(item)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink">
                Score-change threshold
              </label>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0.5"
                  max="50"
                  step="0.5"
                  value={threshold}
                  onChange={(event) => {
                    const value = Number(event.target.value);

                    if (
                      Number.isFinite(value) &&
                      value >= 0.5 &&
                      value <= 50
                    ) {
                      setThreshold(value);
                    }
                  }}
                  className="w-full rounded-control border border-border bg-background px-3 py-2.5 font-mono text-sm text-ink outline-none focus:border-brand"
                />

                <span className="text-xs text-muted">pts</span>
              </div>

              <p className="mt-1.5 text-[10px] leading-4 text-muted">
                Changes smaller than this are treated as no material change.
              </p>
            </div>
          </div>
        </div>

        {versionOptions.length < 2 && (
          <div className="mt-5 rounded-lg border border-border bg-background p-4 text-sm text-muted">
            There are not yet two prompt versions with eligible
            completed runs for this prompt, dataset, and model.
            Create another prompt version, evaluate it under the
            same conditions, and return here.
          </div>
        )}
      </section>

      {/* No comparison selected */}
      {!versionA || !versionB || !analysis ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
          <h2 className="font-serif text-2xl text-ink">
            Choose two different versions
          </h2>

          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">
            Select a baseline and a comparison version with completed,
            eligible runs. Prompt Lab will calculate average scores,
            variability, and changes in test-case outcomes.
          </p>
        </div>
      ) : (
        <>
          {/* Version performance cards */}
          <section>
            <div className="mb-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
                Version performance
              </p>

              <h2 className="mt-1 font-serif text-3xl text-ink">
                Mean performance and consistency
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {[versionA, versionB].map((version, index) => (
                <article
                  key={version.promptVersionId}
                  className="rounded-xl border border-border bg-surface p-5"
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-brand">
                    {index === 0 ? "Baseline" : "Comparison"}
                  </p>

                  <h3 className="mt-1 font-serif text-2xl text-ink">
                    {versionA.runs[0]?.prompt_title || "Prompt"} · v
                    {version.versionNumber}
                  </h3>

                  <p className="mt-1 text-xs text-muted">
                    {version.runs.length} eligible completed run
                    {version.runs.length === 1 ? "" : "s"}
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-muted">
                        Mean score
                      </p>

                      <p
                        className={`mt-1 font-mono text-2xl font-semibold ${scoreColor(
                          version.stats.mean
                        )}`}
                      >
                        {formatNumber(version.stats.mean)}
                      </p>
                    </div>

                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-muted">
                        Std deviation
                      </p>

                      <p className="mt-1 font-mono text-2xl text-ink">
                        {formatNumber(
                          version.stats.standardDeviation
                        )}
                      </p>

                      {version.stats.standardDeviation === null && (
                        <p className="mt-1 text-[10px] text-muted">
                          Need at least two scored runs
                        </p>
                      )}
                    </div>

                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-muted">
                        Score range
                      </p>

                      <p className="mt-1 font-mono text-xl text-ink">
                        {formatNumber(version.stats.range)}
                      </p>
                    </div>

                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-muted">
                        Case pass rate
                      </p>

                      <p className="mt-1 font-mono text-xl text-success">
                        {version.stats.casePassRate === null
                          ? "—"
                          : `${formatNumber(
                              version.stats.casePassRate,
                              1
                            )}%`}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted">
                    <span>
                      Score min–max: {formatNumber(version.stats.min)}–
                      {formatNumber(version.stats.max)}
                    </span>

                    <span>
                      Avg duration:{" "}
                      {formatDuration(version.stats.averageDuration)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Aggregate change cards */}
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-surface p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-muted">
                Mean-score change
              </p>

              <p
                className={`mt-2 font-mono text-3xl font-semibold ${changeClass(
                  analysis.scoreDelta,
                  threshold
                )}`}
              >
                {formatDelta(analysis.scoreDelta)}
              </p>

              <span
                className={`mt-3 inline-flex rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] ${changeBadge(
                  analysis.scoreDelta,
                  threshold
                )}`}
              >
                {changeLabel(analysis.scoreDelta, threshold)}
              </span>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-muted">
                Variability change
              </p>

              <p className="mt-2 font-mono text-3xl text-ink">
                {formatDelta(analysis.variabilityDelta)}
              </p>

              <p className="mt-2 text-xs leading-5 text-muted">
                Comparison standard deviation minus baseline standard
                deviation. A negative value indicates lower observed
                score variation in the comparison version.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-muted">
                Case pass-rate change
              </p>

              <p
                className={`mt-2 font-mono text-3xl ${changeClass(
                  analysis.passRateDelta,
                  threshold
                )}`}
              >
                {analysis.passRateDelta === null
                  ? "—"
                  : `${formatDelta(
                      analysis.passRateDelta
                    )} pp`}
              </p>

              <p className="mt-2 text-xs leading-5 text-muted">
                Percentage-point change across the selected runs.
              </p>
            </div>
          </section>

          <p className="text-[10px] leading-5 text-muted">
            Mean-score changes are descriptive comparisons, not proof that the prompt change caused the difference. Standard deviation is unavailable when a version has fewer than two scored runs. The selected threshold is an application setting, not a universal definition of improvement or regression.
          </p>

          {/* Criterion-level analysis */}
          <section className="rounded-xl border border-border bg-surface">
            <div className="border-b border-border p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
                Criterion-level analysis
              </p>

              <h2 className="mt-1 font-serif text-2xl text-ink">
                Which evaluation dimensions changed?
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-background text-left">
                    <th className="px-5 py-3 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                      Criterion
                    </th>
                    <th className="px-5 py-3 text-right font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                      Baseline
                    </th>
                    <th className="px-5 py-3 text-right font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                      Comparison
                    </th>
                    <th className="px-5 py-3 text-right font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                      Change
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {analysis.criterionRows.map((row) => (
                    <tr
                      key={row.name}
                      className="border-b border-border last:border-b-0"
                    >
                      <td className="px-5 py-4 capitalize text-ink">
                        {row.name.replace(/_/g, " ")}
                      </td>

                      <td className="px-5 py-4 text-right font-mono text-muted">
                        {formatNumber(row.a)}
                      </td>

                      <td className="px-5 py-4 text-right font-mono text-muted">
                        {formatNumber(row.b)}
                      </td>

                      <td
                        className={`px-5 py-4 text-right font-mono font-semibold ${changeClass(
                          row.delta,
                          threshold
                        )}`}
                      >
                        {formatDelta(row.delta)}
                      </td>
                    </tr>
                  ))}

                  {analysis.criterionRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-6 text-center text-muted"
                      >
                        No criterion scores are available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Test-case analysis */}
          <section className="rounded-xl border border-border bg-surface">
            <div className="border-b border-border p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
                Test-case analysis
              </p>

              <h2 className="mt-1 font-serif text-2xl text-ink">
                Improvements and regressions
              </h2>

              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
                <span>
                  Improved cases:{" "}
                  <strong className="text-success">
                    {analysis.improvedCases}
                  </strong>
                </span>

                <span>
                  Lower-scoring cases:{" "}
                  <strong className="text-error">
                    {analysis.regressedCases}
                  </strong>
                </span>

                <span>
                  Unchanged cases:{" "}
                  <strong className="text-ink">
                    {analysis.unchangedCases}
                  </strong>
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-background text-left">
                    <th className="px-5 py-3 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                      Test case
                    </th>
                    <th className="px-5 py-3 text-right font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                      Baseline mean
                    </th>
                    <th className="px-5 py-3 text-right font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                      Comparison mean
                    </th>
                    <th className="px-5 py-3 text-right font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                      Score change
                    </th>
                    <th className="px-5 py-3 text-right font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                      Pass-rate change
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {[...analysis.caseRows]
                    .sort(
                      (a, b) =>
                        (a.scoreDelta ?? 0) -
                        (b.scoreDelta ?? 0)
                    )
                    .map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-border last:border-b-0"
                      >
                        <td className="px-5 py-4">
                          <p className="font-medium text-ink">
                            {row.name}
                          </p>

                          <p className="mt-1 font-mono text-[10px] text-muted">
                            Case #{row.id}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-right font-mono text-muted">
                          {formatNumber(row.a?.mean ?? null)}
                        </td>

                        <td className="px-5 py-4 text-right font-mono text-muted">
                          {formatNumber(row.b?.mean ?? null)}
                        </td>

                        <td
                          className={`px-5 py-4 text-right font-mono font-semibold ${changeClass(
                            row.scoreDelta,
                            threshold
                          )}`}
                        >
                          {formatDelta(row.scoreDelta)}
                        </td>

                        <td
                          className={`px-5 py-4 text-right font-mono ${changeClass(
                            row.passRateDelta,
                            0.01
                          )}`}
                        >
                          {row.passRateDelta === null
                            ? "—"
                            : `${formatDelta(
                                row.passRateDelta
                              )} pp`}
                        </td>
                      </tr>
                    ))}

                  {analysis.caseRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-6 text-center text-muted"
                      >
                        No comparable test-case results were found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Navigation */}
          <div className="flex flex-wrap gap-3 border-t border-border pt-6">
            <Link
              to="/dashboard/evaluations/repeat"
              className="rounded-control border border-border bg-surface px-4 py-2.5 text-sm font-medium text-ink hover:border-ink"
            >
              Run repeat study
            </Link>

            <Link
              to="/dashboard/evaluations/compare"
              className="rounded-control bg-brand px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              Compare individual runs
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
