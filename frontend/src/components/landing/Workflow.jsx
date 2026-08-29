import Container from '../ui/Container'
import SectionHeading from '../ui/SectionHeading'

const steps = [
  {
    n: '1',
    title: 'State the job',
    body: 'Name the audience, the constraint, and the output you need.',
  },
  {
    n: '2',
    title: 'Run a controlled trial',
    body: 'Lock the model and sample. Change the prompt, not the weather.',
  },
  {
    n: '3',
    title: 'Score what changed',
    body: 'Read for clarity, correctness, and cost. Write the note you will need later.',
  },
  {
    n: '4',
    title: 'Keep the winner',
    body: 'Promote the version that holds up. Archive the rest without deleting the trail.',
  },
]

export default function Workflow() {
  return (
    <section id="workflow" className="scroll-mt-20 py-section">
      <Container>
        <SectionHeading
          eyebrow="Workflow"
          title="A lab loop, not a chat streak."
          description="Each pass is small, comparable, and easy to explain in a review."
        />
        <ol className="mt-roomy divide-y divide-border border-y border-border lg:grid lg:grid-cols-4 lg:divide-x lg:divide-y-0 lg:border-x lg:border-y-0">
          {steps.map((step) => (
            <li key={step.n} className="py-6 lg:px-5">
              <p className="font-mono text-xs text-muted">Step {step.n}</p>
              <h3 className="mt-tight font-serif text-xl font-normal tracking-tight">
                {step.title}
              </h3>
              <p className="mt-stack text-sm text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  )
}
