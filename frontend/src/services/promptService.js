import { apiRequest } from "./api";

export async function getPrompts({ search = "", status = "" } = {}) {
  const params = new URLSearchParams();

  if (search.trim()) {
    params.set("search", search.trim());
  }

  if (status && status !== "All") {
    params.set("status", status.toLowerCase());
  }

  const queryString = params.toString();

  return apiRequest(
    `/prompts/${queryString ? `?${queryString}` : ""}`
  );
}

export async function getPrompt(promptId) {
  return apiRequest(`/prompts/${promptId}/`);
}

export async function createPrompt({
  title,
  description,
  category,
  status,
  content,
  system_prompt,
  variables,
  change_summary,
}) {
  return apiRequest("/prompts/", {
    method: "POST",
    body: JSON.stringify({
      title,
      description,
      category,
      status,
      content,
      system_prompt,
      variables,
      change_summary,
    }),
  });
}

export async function updatePrompt(promptId, data) {
  return apiRequest(`/prompts/${promptId}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function getPromptVersions(promptId) {
  return apiRequest(`/prompts/${promptId}/versions/`);
}

export async function createPromptVersion(promptId, {
  content,
  system_prompt = "",
  change_summary = "",
  variables = {},
}) {
  return apiRequest(`/prompts/${promptId}/versions/`, {
    method: "POST",
    body: JSON.stringify({
      content,
      system_prompt,
      change_summary,
      variables,
    }),
  });
}

export async function improvePrompt({
  prompt_text,
  context = "",
  tone = "",
  output_format = "",
  model = "gemma3:4b",
}) {
  return apiRequest("/prompts/improve/", {
    method: "POST",
    body: JSON.stringify({
      prompt_text,
      context,
      tone,
      output_format,
      model,
    }),
  });
}