export default function DashboardHeader({ title }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-6">
      <h1 className="text-base font-semibold text-ink">{title}</h1>

      <div className="flex items-center gap-3">
        <div className="relative hidden sm:block">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            width="14"
            height="14"
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
            placeholder="Search prompts…"
            className="h-8 w-52 rounded-md border border-border bg-background pl-8 pr-3 font-mono text-xs text-ink placeholder:text-muted/60 focus:border-ink focus:outline-none transition-standard"
          />
        </div>

        <button
          type="button"
          title="Notifications"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted transition-standard hover:border-ink hover:text-ink"
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="sr-only">Notifications</span>
        </button>

        <button
          type="button"
          title="New prompt"
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand px-3 text-xs font-medium text-white transition-standard hover:opacity-90"
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path strokeLinecap="round" d="M12 5v14M5 12h14" />
          </svg>
          New prompt
        </button>
      </div>
    </header>
  )
}
