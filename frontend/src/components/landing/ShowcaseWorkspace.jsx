export default function ShowcaseWorkspace() {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface shadow-raised">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="size-2 rounded-pill bg-brand" aria-hidden="true" />
          <p className="text-sm font-medium">support-reply</p>
          <span className="font-mono text-xs text-muted">exp_08 · v4</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted">
          <span className="rounded-pill border border-border px-2 py-1">llama3.2</span>
          <span className="rounded-pill border border-border px-2 py-1">temp 0.2</span>
          <span className="rounded-pill border border-border px-2 py-1">312 tok</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2">
        <div className="border-b border-border p-4 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
              Prompt
            </p>
            <p className="font-mono text-[11px] text-muted">v4 · 248 tokens</p>
          </div>
          <pre className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-ink">
            {`You are a support editor.

Rewrite the draft so it is:
- calm
- specific
- one action

Keep the original facts. Do not add a refund unless the draft already offers one.`}
          </pre>
        </div>

        <div className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
              Output
            </p>
            <p className="font-mono text-[11px] text-muted">1.4s · run 03</p>
          </div>
          <p className="text-sm leading-relaxed text-ink">
            Thanks for waiting. Your order 1842 shipped yesterday and should
            arrive Thursday. Track it from the receipt email, and write back if
            it is not there by Friday.
          </p>
        </div>
      </div>

      <div className="grid gap-3 border-t border-border bg-background px-4 py-4 sm:grid-cols-3">
        <CompareRow version="v3" label="Clarity" left="6.1" right="8.4" winner />
        <CompareRow version="v4" label="Action" left="5.8" right="8.9" winner />
        <CompareRow version="v4" label="Length" left="142" right="61" />
      </div>
    </div>
  )
}

function CompareRow({ version, label, left, right, winner = false }) {
  return (
    <div className="rounded-control border border-border bg-surface px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
          {label}
        </span>
        <span className="font-mono text-[11px] text-accent">{version} vs prev</span>
      </div>
      <p className="font-mono text-sm text-ink">
        <span className="text-muted">{left}</span>
        <span className="mx-2 text-muted">→</span>
        <span>{right}</span>
        {winner ? (
          <span className="ml-2 text-xs text-success">kept</span>
        ) : null}
      </p>
    </div>
  )
}
