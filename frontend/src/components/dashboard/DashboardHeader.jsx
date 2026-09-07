export default function DashboardHeader({ title }) {
  return (
    <header className="flex h-14 shrink-0 items-center border-b border-border bg-surface px-6">
      <h1 className="text-base font-semibold text-ink">{title}</h1>
    </header>
  )
}
