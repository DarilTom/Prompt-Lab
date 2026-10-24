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
