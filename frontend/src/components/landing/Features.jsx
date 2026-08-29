import Container from '../ui/Container'
import SectionHeading from '../ui/SectionHeading'

const features = [
  {
    key: '01',
    title: 'Design',
    body: 'Write prompts as drafts with intent, constraints, and a clear job. Treat the first version as a hypothesis, not a finished message.',
  },
  {
    key: '02',
    title: 'Test',
    body: 'Run the same case under named models and settings. Capture output, latency, and token use as part of the record.',
  },
  {
    key: '03',
    title: 'Optimize',
    body: 'Change one thing at a time. Keep notes on what you altered so the next draft is a decision, not a guess.',
  },
  {
    key: '04',
    title: 'Compare',
    body: 'Place versions side by side. Keep the prompt that wins on clarity, action, and cost — retire the rest.',
  },
]

export default function Features() {
  return (
    <section id="features" className="scroll-mt-20 py-section">
      <Container>
        <SectionHeading
          eyebrow="Features"
          title="Four moves. One loop."
          description="Prompt Lab is built around the work of iterating, not around a single chat box."
        />
        <div className="mt-roomy grid gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <article
              key={feature.key}
              className="rounded-card border border-border bg-surface p-6 shadow-subtle"
            >
              <p className="font-mono text-xs text-brand">{feature.key}</p>
              <h3 className="mt-tight font-serif text-2xl font-normal tracking-tight">
                {feature.title}
              </h3>
              <p className="mt-stack text-sm text-muted">{feature.body}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  )
}
