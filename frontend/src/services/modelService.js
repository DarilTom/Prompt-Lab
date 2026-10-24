import { apiRequest } from "./api";

/**
 * Fetch list of locally installed Ollama models.
 * Returns { models: [ { name, model, family, parameter_size, size, size_formatted, modified_at, digest } ] }
 */
export async function getInstalledModels() {
  return apiRequest("/executions/models/");
}

/**
 * Format model display label with parameters and disk size when available.
 * e.g. "gemma3:4b (4.3B · 3.3 GB)"
 */
export function formatModelLabel(model) {
  if (!model) return "";
  const parts = [];
  if (model.parameter_size) parts.push(model.parameter_size);
  if (model.size_formatted) parts.push(model.size_formatted);
  if (parts.length > 0) {
    return `${model.name} (${parts.join(" · ")})`;
  }
  return model.name;
}

/**
 * Determine best default model:
 * 1. If preferredModel is provided and installed, use it.
 * 2. Otherwise default to 'gemma3:4b' when installed.
 * 3. If 'gemma3:4b' is not installed, select the first available model.
 * 4. If no models available, return empty string.
 */
export function pickDefaultModel(models, preferredModel) {
  if (!Array.isArray(models) || models.length === 0) {
    return "";
  }

  if (preferredModel) {
    const preferred = models.find(
      (m) =>
        m.name === preferredModel ||
        m.model === preferredModel ||
        m.name.startsWith(preferredModel)
    );
    if (preferred) {
      return preferred.name;
    }
  }

  const gemma = models.find(
    (m) =>
      m.name === "gemma3:4b" ||
      m.model === "gemma3:4b" ||
      m.name.startsWith("gemma3:4b")
  );

  if (gemma) {
    return gemma.name;
  }

  return models[0].name;
}
