import { apiRequest } from "./api";

export async function getEvaluationDatasets() {
  return apiRequest("/evaluations/datasets/");
}

export async function getEvaluationDataset(datasetId) {
  return apiRequest(`/evaluations/datasets/${datasetId}/`);
}

export async function createEvaluationDataset({
  name,
  description,
}) {
  return apiRequest("/evaluations/datasets/", {
    method: "POST",
    body: JSON.stringify({
      name,
      description,
    }),
  });
}

export async function updateEvaluationDataset(
  datasetId,
  data
) {
  return apiRequest(
    `/evaluations/datasets/${datasetId}/`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    }
  );
}

export async function deleteEvaluationDataset(datasetId) {
  return apiRequest(
    `/evaluations/datasets/${datasetId}/`,
    {
      method: "DELETE",
    }
  );
}

export async function getDatasetTestCases(datasetId) {
  return apiRequest(
    `/evaluations/datasets/${datasetId}/test-cases/`
  );
}

export async function createTestCase(
  datasetId,
  data
) {
  return apiRequest(
    `/evaluations/datasets/${datasetId}/test-cases/`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

export async function updateTestCase(
  testCaseId,
  data
) {
  return apiRequest(
    `/evaluations/test-cases/${testCaseId}/`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    }
  );
}

export async function deleteTestCase(testCaseId) {
  return apiRequest(
    `/evaluations/test-cases/${testCaseId}/`,
    {
      method: "DELETE",
    }
  );
}

export async function getEvaluationRuns() {
  return apiRequest("/evaluations/runs/");
}

export async function getEvaluationRun(runId, options = {}) {
  return apiRequest(`/evaluations/runs/${runId}/`, options);
}

export async function getPromptsForEvaluation() {
  return apiRequest("/prompts/");
}

export async function getPromptVersionsForEvaluation(promptId) {
  return apiRequest(`/prompts/${promptId}/versions/`);
}

export async function createEvaluationRun({
  prompt_version,
  dataset,
  model,
}) {
  return apiRequest("/evaluations/runs/", {
    method: "POST",
    body: JSON.stringify({
      prompt_version,
      dataset,
      model,
    }),
  });
}

/**
 * Polls an evaluation run every intervalMs until it reaches a terminal status
 * ('completed' or 'failed') or until the abort signal is triggered.
 */
export async function pollEvaluationRun(runId, options = {}) {
  const {
    intervalMs = 2500,
    maxAttempts = 240,
    onProgress,
    signal,
  } = options;

  let attempts = 0;

  while (attempts < maxAttempts) {
    if (signal?.aborted) {
      const abortError = new Error("Evaluation polling aborted.");
      abortError.name = "AbortError";
      throw abortError;
    }

    const run = await getEvaluationRun(runId, { signal });

    if (onProgress && typeof onProgress === "function") {
      onProgress(run);
    }

    if (run.status === "completed" || run.status === "failed") {
      return run;
    }

    attempts += 1;

    await new Promise((resolve, reject) => {
      if (signal?.aborted) {
        const abortError = new Error("Evaluation polling aborted.");
        abortError.name = "AbortError";
        reject(abortError);
        return;
      }

      let onAbort;
      const timer = setTimeout(() => {
        if (signal && onAbort) {
          signal.removeEventListener("abort", onAbort);
        }
        resolve();
      }, intervalMs);

      if (signal) {
        onAbort = () => {
          clearTimeout(timer);
          signal.removeEventListener("abort", onAbort);
          const abortError = new Error("Evaluation polling aborted.");
          abortError.name = "AbortError";
          reject(abortError);
        };
        signal.addEventListener("abort", onAbort, { once: true });
      }
    });
  }

  throw new Error(
    "Evaluation timed out while waiting for background completion."
  );
}