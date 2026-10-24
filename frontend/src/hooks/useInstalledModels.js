import { useState, useEffect, useCallback } from "react";
import { getInstalledModels, pickDefaultModel } from "../services/modelService";
import { useAuth } from "../context/AuthContext";

export { pickDefaultModel };

/**
 * Hook to retrieve and cache locally installed Ollama models.
 * Automatically respects the signed-in user's default model preference.
 */
export function useInstalledModels(overridePreferredModel) {
  const { user } = useAuth();
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const preferred =
    overridePreferredModel !== undefined
      ? overridePreferredModel
      : (user?.default_model || "");

  const retry = useCallback(() => {
    setLoading(true);
    setReloadTrigger((count) => count + 1);
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await getInstalledModels();
        if (!active) return;
        const list = Array.isArray(response?.models) ? response.models : [];
        setModels(list);
        setError(null);
      } catch (err) {
        if (!active) return;
        const message =
          err?.message ||
          "Unable to retrieve installed Ollama models. Please ensure Ollama is running locally.";
        setError(message);
        setModels([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [reloadTrigger]);

  const defaultModel = pickDefaultModel(models, preferred);

  return {
    models,
    loading,
    error,
    retry,
    defaultModel,
    preferredModel: preferred,
  };
}
