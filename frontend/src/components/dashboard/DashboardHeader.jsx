import { Link, useLocation } from "react-router-dom";
import { usePromptImprover } from "../../context/PromptImproverContext";
import { useExecution } from "../../context/ExecutionContext";

export default function DashboardHeader({ breadcrumbs = [] }) {
  const { pathname } = useLocation();
  const {
    improving,
    activeModel,
    notification,
    dismissNotification,
  } = usePromptImprover();

  const {
    activeTask: activeExecution,
    notification: executionNotification,
    dismissNotification: dismissExecutionNotification,
  } = useExecution();

  const isImproverPage =
    pathname === "/dashboard" ||
    pathname === "/dashboard/" ||
    pathname === "/dashboard/prompts/improve";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-6">
      <nav aria-label="Breadcrumbs" className="flex items-center gap-2 font-mono text-xs">
        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          return (
            <span key={idx} className="flex items-center gap-2">
              {idx > 0 && (
                <span className="text-muted/40 select-none" aria-hidden="true">
                  /
                </span>
              )}
              {crumb.to && !isLast ? (
                <Link
                  to={crumb.to}
                  className="text-muted hover:text-ink transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className={isLast ? "font-semibold text-ink" : "text-muted"}>
                  {crumb.label}
                </span>
              )}
            </span>
          );
        })}
      </nav>

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

        {/* Active sandbox execution status */}
        {activeExecution && activeExecution.status === "running" && (
          <Link
            to={`/dashboard/prompts/${activeExecution.promptId}#execution-sandbox`}
            className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/5 px-3 py-1 text-xs font-medium text-brand hover:bg-brand/10 transition-colors shadow-xs"
            title="Sandbox execution is running. Click to view."
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand"></span>
            </span>
            <span>
              Running {activeExecution.promptTitle} (v{activeExecution.versionNumber})
              {activeExecution.model ? ` on ${activeExecution.model}` : ""}...
            </span>
          </Link>
        )}

        {/* Finished execution notification */}
        {(!activeExecution || activeExecution.status !== "running") && executionNotification && (
          <div className="flex items-center gap-1.5">
            {executionNotification.type === "success" ? (
              <Link
                to={`/dashboard/prompts/${executionNotification.promptId}#execution-sandbox`}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-500/20 transition-colors shadow-xs"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                <span>
                  {pathname === `/dashboard/prompts/${executionNotification.promptId}`
                    ? "Execution completed!"
                    : `Executed ${executionNotification.promptTitle}! View response →`}
                </span>
              </Link>
            ) : (
              <Link
                to={`/dashboard/prompts/${executionNotification.promptId}#execution-sandbox`}
                className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-800 hover:bg-rose-500/20 transition-colors shadow-xs"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                <span>
                  {pathname === `/dashboard/prompts/${executionNotification.promptId}`
                    ? "Execution failed"
                    : `Execution failed on ${executionNotification.promptTitle}. View details →`}
                </span>
              </Link>
            )}

            <button
              type="button"
              onClick={dismissExecutionNotification}
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
