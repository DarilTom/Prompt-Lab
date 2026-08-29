import Button from '../ui/Button'
import Container from '../ui/Container'

export default function FinalCta() {
  return (
    <section id="cta" className="scroll-mt-20 py-section">
      <Container>
        <div className="rounded-card border border-border bg-surface px-6 py-12 text-center shadow-subtle sm:px-12">
          <p className="mb-tight font-mono text-xs uppercase tracking-[0.2em] text-muted">
            Next
          </p>
          <h2 className="font-serif text-3xl tracking-tight sm:text-5xl">
            Bring the next prompt to the bench.
          </h2>
          <p className="mx-auto mt-stack max-w-md text-muted">
            Prompt Lab is the workspace for that loop. The lab itself ships in
            the next phase — this page is the door.
          </p>
          <div className="mt-roomy">
            <Button href="#top">Back to the top</Button>
          </div>
        </div>
      </Container>
    </section>
  )
}
