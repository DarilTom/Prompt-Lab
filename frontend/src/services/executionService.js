import { apiRequest } from "./api";

export async function getInstalledModels() {
  return apiRequest("/executions/models/");
}

export async function createExecution({
  prompt_version,
  model,
  input_text,
}) {
  return apiRequest("/executions/", {
    method: "POST",
    // 620s ensures client timeout gives backend 600s to complete without aborting prematurely
    timeout: 620000,
    body: JSON.stringify({
      prompt_version,
      model,
      input_text,
    }),
  });
}

export async function getExecutions({ promptId = "" } = {}) {
  const params = new URLSearchParams();

  if (promptId) {
    params.set("prompt", promptId);
  }

  const queryString = params.toString();

  return apiRequest(
    `/executions/${queryString ? `?${queryString}` : ""}`
  );
}

export async function getExecution(executionId) {
  return apiRequest(`/executions/${executionId}/`);
}

export async function deleteExecution(executionId) {
  return apiRequest(`/executions/${executionId}/`, {
    method: "DELETE",
  });
}

export async function compareAndRecommendExecutions({
  execution_a_id,
  execution_b_id,
  judge_model,
}) {
  return apiRequest("/executions/compare-recommend/", {
    method: "POST",
    timeout: 300000,
    body: JSON.stringify({
      execution_a_id,
      execution_b_id,
      judge_model: judge_model || undefined,
    }),
  });
}
