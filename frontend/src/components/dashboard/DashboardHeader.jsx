import { Link, useLocation } from "react-router-dom";
import { usePromptImprover } from "../../context/PromptImproverContext";

export default function DashboardHeader({ title }) {
  const { pathname } = useLocation();
  const {
    improving,
    activeModel,
    notification,
    dismissNotification,
  } = usePromptImprover();

  const isImproverPage =
    pathname === "/dashboard" ||
    pathname === "/dashboard/" ||
    pathname === "/dashboard/prompts/improve";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-6">
      <h1 className="text-base font-semibold text-ink">{title}</h1>

      <div className="flex items-center gap-3">
        {/* Active background generation status */}
        {improving && (
          <Link
            to="/dashboard/prompts/improve"
            className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/5 px-3 py-1 text-xs font-medium text-brand hover:bg-brand/10 transition-colors shadow-xs"
            title="Prompt Improver is running. Click to view."
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand"></span>
            </span>
            <span>
              Improving prompt{activeModel ? ` with ${activeModel}` : ""}...
            </span>
          </Link>
        )}

        {/* Finished / result notification */}
        {!improving && notification && (
          <div className="flex items-center gap-1.5">
            {notification.type === "success" ? (
              <Link
                to="/dashboard/prompts/improve"
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-500/20 transition-colors shadow-xs"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                <span>
                  {isImproverPage
                    ? "Prompt improved!"
                    : "Prompt improved! View result →"}
                </span>
              </Link>
            ) : (
              <Link
                to="/dashboard/prompts/improve"
                className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-800 hover:bg-rose-500/20 transition-colors shadow-xs"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                <span>
                  {isImproverPage
                    ? "Improvement failed"
                    : "Improvement failed. View details →"}
                </span>
              </Link>
            )}

            <button
              type="button"
              onClick={dismissNotification}
              className="rounded p-1 text-xs text-muted hover:text-ink transition-colors"
              title="Dismiss notification"
              aria-label="Dismiss notification"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
