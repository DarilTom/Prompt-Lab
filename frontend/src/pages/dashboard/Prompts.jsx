import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import PromptCard from "../../components/dashboard/PromptCard";
import { getPrompts } from "../../services/promptService";

/* ─────────────────────────────────────────────────────────
   EMPTY STATE
   ───────────────────────────────────────────────────────── */

function EmptyState({ hasFilters, onClear, onNewPrompt }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface py-24 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand/8">
        <svg
          width="24"
          height="24"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-brand"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
          />
        </svg>
      </div>

      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        {hasFilters ? "No results" : "Prompt Library"}
      </p>

      <p className="mt-2 font-serif text-2xl text-ink">
        {hasFilters
          ? "Nothing matches your filters"
          : "Your lab notebook is empty"}
      </p>

      <p className="mt-2 max-w-sm text-sm text-muted">
        {hasFilters
          ? "Try adjusting your search or status filter."
          : "Prompts you create will appear here as experiment cards. Start by adding your first prompt."}
      </p>

      {hasFilters ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-6 inline-flex items-center gap-2 rounded-control border border-border bg-background px-4 py-2 text-sm font-medium text-ink transition-standard hover:border-ink"
        >
          Clear filters
        </button>
      ) : (
        <button
          type="button"
          onClick={onNewPrompt}
          className="mt-6 inline-flex items-center gap-1.5 rounded-control bg-brand px-4 py-2 text-sm font-medium text-white transition-standard hover:opacity-90"
        >
          <svg
            width="12"
            height="12"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden="true"
          >
            <path strokeLinecap="round" d="M12 5v14M5 12h14" />
          </svg>

          New Prompt
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   PROMPT LIBRARY PAGE
   ───────────────────────────────────────────────────────── */

export default function Prompts() {
  const navigate = useNavigate();

  const [prompts, setPrompts] = useState([]);
  const [query, setQuery] = useState("");
  const [activeStatus, setActiveStatus] = useState("All");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPrompts() {
      setLoading(true);
      setError("");

      try {
        const data = await getPrompts({
          search: query,
          status: activeStatus,
        });

        if (!cancelled) {
          setPrompts(data);
        }
      } catch (err) {
        if (!cancelled) {
          setPrompts([]);
          setError(err.message || "Unable to load prompts.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPrompts();

    return () => {
      cancelled = true;
    };
  }, [query, activeStatus]);

  const hasFilters =
    query.trim() !== "" || activeStatus !== "All";

  function clearFilters() {
    setQuery("");
    setActiveStatus("All");
  }

  function handleNewPrompt() {
    navigate("/dashboard/prompts/new");
  }

  return (
    <div className="space-y-8 pb-12">
      {/* ── Page Header ─────────────────────────────────── */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
            Prompt Library
          </p>

          <h2 className="mt-1 font-serif text-3xl text-ink">
            Experiment Archive
          </h2>

          <p className="mt-1.5 max-w-lg text-sm text-muted">
            Every prompt is an experiment. Version them, run them, score them
            — and keep only what works.
          </p>
        </div>

        <div className="shrink-0">
          <button
            type="button"
            onClick={handleNewPrompt}
            className="inline-flex items-center gap-1.5 rounded-control bg-brand px-4 py-2 text-sm font-medium text-white transition-standard hover:opacity-90"
          >
            <svg
              width="12"
              height="12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden="true"
            >
              <path strokeLinecap="round" d="M12 5v14M5 12h14" />
            </svg>

            New Prompt
          </button>
        </div>
      </div>

      {/* ── Toolbar ─────────────────────────────────────── */}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        {/* Search */}
        <div className="relative w-full max-w-xs">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted/60"
            width="13"
            height="13"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
          </svg>

          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search prompts…"
            className="h-9 w-full rounded-md border border-border bg-surface pl-8 pr-3 font-mono text-xs text-ink placeholder:text-muted/50 transition-standard focus:border-ink focus:outline-none"
          />
        </div>

        {/* Status dropdown */}
        <div className="relative">
          <select
            value={activeStatus}
            onChange={(event) => setActiveStatus(event.target.value)}
            className="h-9 cursor-pointer appearance-none rounded-md border border-border bg-surface pl-3 pr-7 font-mono text-[11px] text-muted transition-standard hover:border-ink/40 focus:border-ink focus:outline-none"
          >
            <option value="All">All statuses</option>
            <option value="Draft">Draft</option>
            <option value="Testing">Testing</option>
            <option value="Production">Production</option>
            <option value="Archived">Archived</option>
          </select>

          <svg
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
            width="10"
            height="10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>

      {/* ── Results count ───────────────────────────────── */}

      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted/70">
          {prompts.length}{" "}
          {prompts.length === 1 ? "prompt" : "prompts"}
          {hasFilters && " · filtered"}
        </span>

        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="font-mono text-[10px] uppercase tracking-wide text-brand transition-standard hover:opacity-70"
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Card Grid ───────────────────────────────────── */}

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {/* Loading */}
        {loading && (
          <div className="col-span-full flex items-center justify-center py-20">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              Loading experiments...
            </p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="col-span-full rounded-card border border-error/20 bg-error/5 p-6 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-error">
              Unable to load experiments
            </p>

            <p className="mt-2 text-sm text-muted">
              {error}
            </p>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-control border border-border bg-background px-4 py-2 text-sm font-medium text-ink transition-standard hover:border-ink"
            >
              Try again
            </button>
          </div>
        )}

        {/* Prompt cards */}
        {!loading &&
          !error &&
          prompts.length > 0 &&
          prompts.map((prompt) => (
            <PromptCard
  key={prompt.id}
  prompt={prompt}
  onClick={() =>
    navigate(`/dashboard/prompts/${prompt.id}`)
  }
/>
          ))}

        {/* Empty state */}
        {!loading &&
          !error &&
          prompts.length === 0 && (
            <EmptyState
              hasFilters={hasFilters}
              onClear={clearFilters}
              onNewPrompt={handleNewPrompt}
            />
          )}
      </div>
    </div>
  );
}