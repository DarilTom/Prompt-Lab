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

export async function getEvaluationRun(runId) {
  return apiRequest(`/evaluations/runs/${runId}/`);
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