import { formatModelLabel } from "../../services/modelService";

/**
 * Consistent Model Selector for Prompt Lab.
 * Shows loading, error with retry, empty state when no models installed,
 * or the populated dropdown with parameter & disk size information.
 */
export default function ModelSelector({
  value,
  onChange,
  models = [],
  loading = false,
  error = null,
  onRetry,
  disabled = false,
  label = "Model",
  labelClassName,
  selectClassName,
  helperText,
}) {
  const defaultLabelClass =
    labelClassName ||
    "mb-2 block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted";

  const defaultSelectClass =
    selectClassName ||
    "w-full rounded-control border border-border bg-background px-3 py-2.5 text-sm font-medium text-ink outline-none transition-standard focus:border-brand disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div>
      {label && <label className={defaultLabelClass}>{label}</label>}

      {loading ? (
        <div>
          <div className="relative">
            <select disabled className={`${defaultSelectClass} pr-10 opacity-70`}>
              <option value="">Checking local Ollama models...</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">
            Connecting to Ollama at http://localhost:11434...
          </p>
        </div>
      ) : error ? (
        <div className="space-y-2">
          <select disabled className={defaultSelectClass}>
            <option value="">Ollama connection error</option>
          </select>

          <div className="rounded-control border border-error/20 bg-error/5 p-3 text-xs text-error">
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
              <p className="leading-relaxed">{error}</p>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="self-start whitespace-nowrap font-semibold underline hover:opacity-80 sm:self-auto"
                >
                  Retry connection
                </button>
              )}
            </div>
          </div>
        </div>
      ) : models.length === 0 ? (
        <div className="space-y-2">
          <select disabled className={defaultSelectClass}>
            <option value="">No local models found</option>
          </select>

          <div className="rounded-control border border-amber-300 bg-amber-50/70 p-3 text-xs text-amber-900">
            <p className="font-semibold">No Ollama models installed</p>
            <p className="mt-1 text-amber-800">
              Run this command in your terminal to install the default model:
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <code className="rounded border border-amber-200 bg-white/80 px-2 py-1 font-mono text-[11px] text-ink select-all">
                ollama pull gemma3:4b
              </code>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="font-semibold text-amber-900 underline hover:opacity-80"
                >
                  Refresh
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={defaultSelectClass}
          >
            {/* If current value isn't in models, prompt user to select */}
            {!models.some((m) => m.name === value || m.model === value) && (
              <option value="">Select an installed model</option>
            )}
            {models.map((model) => (
              <option key={model.name} value={model.name}>
                {formatModelLabel(model)}
              </option>
            ))}
          </select>

          <p className="mt-2 text-xs leading-5 text-muted">
            {helperText ||
              `Running locally through Ollama (${models.length} model${
                models.length > 1 ? "s" : ""
              } installed).`}
          </p>
        </div>
      )}
    </div>
  );
}
