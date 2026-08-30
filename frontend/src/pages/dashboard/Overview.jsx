import { useAuth } from '../../context/AuthContext'

/* ── Mock data ─────────────────────────────────────────── */
const stats = [
  { label: 'Active Prompts', value: '24', delta: '+3 this week', color: 'text-brand' },
  { label: 'Executions', value: '1,847', delta: '+142 today', color: 'text-accent' },
  { label: 'Avg. Score', value: '8.4', delta: '↑ 0.6 vs last week', color: 'text-success' },
  { label: 'Comparisons Run', value: '61', delta: '12 pending review', color: 'text-warning' },
]

const recentPrompts = [
  {
    id: 'p-001',
    title: 'Product description generator',
    model: 'gpt-4o',
    version: 'v7',
    score: 9.1,
    runs: 34,
    tag: 'Production',
    tagColor: 'bg-success/10 text-success',
    updatedAt: '2 h ago',
  },
  {
    id: 'p-002',
    title: 'Customer support triage',
    model: 'claude-3-5-sonnet',
    version: 'v3',
    score: 7.8,
    runs: 21,
    tag: 'Testing',
    tagColor: 'bg-warning/10 text-warning',
    updatedAt: '5 h ago',
  },
  {
    id: 'p-003',
    title: 'Code review assistant',
    model: 'gpt-4o-mini',
    version: 'v2',
    score: 8.5,
    runs: 12,
    tag: 'Draft',
    tagColor: 'bg-border text-muted',
    updatedAt: 'Yesterday',
  },
  {
    id: 'p-004',
    title: 'Legal clause summarizer',
    model: 'claude-3-haiku',
    version: 'v1',
    score: 6.9,
    runs: 8,
    tag: 'Draft',
    tagColor: 'bg-border text-muted',
    updatedAt: 'Yesterday',
  },
]

const recentActivity = [
  { icon: '⚡', text: 'Execution batch completed — 18 runs', sub: 'product-description · v7', time: '12 min ago' },
  { icon: '🔬', text: 'Comparison started — GPT-4o vs Claude', sub: 'code-review · A/B test', time: '1 h ago' },
  { icon: '📝', text: 'New prompt version saved', sub: 'customer-support · v3', time: '3 h ago' },
  { icon: '📊', text: 'Score improved by +1.2', sub: 'product-description · v7', time: '5 h ago' },
  { icon: '🚀', text: 'Prompt promoted to Production', sub: 'product-description · v6 → v7', time: 'Yesterday' },
]

const modelBreakdown = [
  { model: 'gpt-4o', runs: 872, pct: 47 },
  { model: 'claude-3-5-sonnet', runs: 519, pct: 28 },
  { model: 'gpt-4o-mini', runs: 315, pct: 17 },
  { model: 'claude-3-haiku', runs: 141, pct: 8 },
]

const modelColors = ['bg-brand', 'bg-accent', 'bg-support', 'bg-warning']

/* ── Helpers ────────────────────────────────────────────── */
function StatCard({ label, value, delta, color }) {
  return (
    <div className="rounded-card border border-border bg-surface p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className={`mt-2 font-serif text-4xl tracking-tight ${color}`}>{value}</p>
      <p className="mt-1.5 text-xs text-muted">{delta}</p>
    </div>
  )
}

function ScorePip({ score }) {
  const color =
    score >= 8.5 ? 'text-success' : score >= 7 ? 'text-warning' : 'text-error'
  return (
    <span className={`font-mono text-sm font-semibold tabular-nums ${color}`}>
      {score.toFixed(1)}
    </span>
  )
}

/* ── Overview Page ──────────────────────────────────────── */
export default function Overview() {
  const { user } = useAuth()

  return (
    <div className="space-y-7 pb-10">
      {/* Greeting */}
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          Experiment workspace
        </p>
        <h2 className="mt-1 font-serif text-3xl text-ink">
          Good evening, {user?.name?.split(' ')[0] || 'there'}.
        </h2>
        <p className="mt-1 text-sm text-muted">
          Here's what's happening in your lab right now.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Main grid */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Recent prompts (2/3 width) */}
        <div className="lg:col-span-2 rounded-card border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h3 className="text-sm font-semibold text-ink">Recent prompts</h3>
            <button
              type="button"
              className="text-xs font-medium text-brand transition-standard hover:opacity-70"
            >
              View all →
            </button>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['Prompt', 'Model', 'Ver.', 'Score', 'Runs', 'Status', 'Updated'].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-muted/70"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentPrompts.map((p, i) => (
                <tr
                  key={p.id}
                  className={`group transition-standard hover:bg-background ${i < recentPrompts.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <td className="px-5 py-3.5">
                    <span className="font-medium text-ink group-hover:text-brand transition-standard cursor-pointer">
                      {p.title}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <code className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px] text-muted">
                      {p.model}
                    </code>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-xs text-muted">{p.version}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <ScorePip score={p.score} />
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-xs text-muted">{p.runs}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-sm px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${p.tagColor}`}>
                      {p.tag}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-[11px] text-muted">{p.updatedAt}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-5">
          {/* Model breakdown */}
          <div className="rounded-card border border-border bg-surface p-5">
            <h3 className="mb-4 text-sm font-semibold text-ink">Model usage</h3>
            <div className="mb-3 flex h-2 w-full overflow-hidden rounded-full">
              {modelBreakdown.map((m, i) => (
                <div
                  key={m.model}
                  className={`${modelColors[i]} h-full`}
                  style={{ width: `${m.pct}%` }}
                  title={`${m.model}: ${m.pct}%`}
                />
              ))}
            </div>
            <ul className="space-y-2.5">
              {modelBreakdown.map((m, i) => (
                <li key={m.model} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${modelColors[i]}`} />
                    <code className="font-mono text-xs text-muted">{m.model}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs tabular-nums text-muted">{m.runs.toLocaleString()}</span>
                    <span className="font-mono text-[10px] text-muted/60">{m.pct}%</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Activity feed */}
          <div className="rounded-card border border-border bg-surface p-5">
            <h3 className="mb-4 text-sm font-semibold text-ink">Activity</h3>
            <ul className="space-y-3.5">
              {recentActivity.map((item, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 text-base leading-none" aria-hidden="true">
                    {item.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-ink">{item.text}</p>
                    <p className="font-mono text-[10px] text-muted">{item.sub}</p>
                    <p className="font-mono text-[10px] text-muted/60">{item.time}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Quick-start card */}
      <div className="rounded-card border border-dashed border-border bg-surface px-6 py-5 flex items-center justify-between gap-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Next step</p>
          <p className="mt-1 text-sm font-medium text-ink">Run your first A/B comparison</p>
          <p className="mt-0.5 text-xs text-muted">
            Pick two prompt versions, pick a model, and let Prompt Lab score the difference.
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 inline-flex items-center gap-2 rounded-control border border-border bg-background px-4 py-2 text-sm font-medium text-ink transition-standard hover:border-ink"
        >
          Start comparison →
        </button>
      </div>
    </div>
  )
}