import Container from '../ui/Container'
import SectionHeading from '../ui/SectionHeading'

const metrics = [
  {
    value: '8.4',
    unit: '/ 10',
    label: 'Clarity',
    note: 'Sample run · support-reply v4',
  },
  {
    value: '3',
    unit: 'runs',
    label: 'Consistency',
    note: 'Same case, locked settings',
  },
  {
    value: '−57%',
    unit: 'tokens',
    label: 'Length',
    note: 'v3 142 → v4 61',
  },
  {
    value: 'v4',
    unit: 'kept',
    label: 'Decision',
    note: 'Winner on action + clarity',
  },
]

export default function Research() {
  return (
    <section id="research" className="scroll-mt-20 py-section">
      <Container>
        <SectionHeading
          eyebrow="Research"
          title="Measure the draft, not the vibe."
          description="Metrics are attached to a named experiment. These figures are a static sample of what the lab will record — not live data."
        />
        <div className="mt-roomy grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <article
              key={metric.label}
              className="rounded-card border border-border bg-surface px-5 py-6 shadow-subtle"
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
                {metric.label}
              </p>
              <p className="mt-3 font-serif text-4xl tracking-tight text-ink">
                {metric.value}
                <span className="ml-1 font-mono text-sm text-muted">{metric.unit}</span>
              </p>
              <p className="mt-stack font-mono text-xs text-muted">{metric.note}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  )
}
