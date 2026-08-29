import Button from '../ui/Button'
import Container from '../ui/Container'

export default function Hero() {
  return (
    <section className="py-section sm:py-20">
      <Container>
        <p className="mb-tight font-mono text-xs uppercase tracking-[0.2em] text-muted">
          Prompt Lab
        </p>
        <h1 className="max-w-4xl font-serif text-4xl tracking-tight text-ink sm:text-6xl">
          Design. Test. Optimize. Compare.
        </h1>
        <p className="mt-stack max-w-xl text-lg text-muted">
          A laboratory for better prompts. Version them, run them, measure them,
          and keep the draft that actually works.
        </p>
        <div className="mt-roomy flex flex-wrap gap-3">
          <Button href="#cta">Enter the lab</Button>
          <Button href="#showcase" variant="secondary">
            See the workspace
          </Button>
        </div>
      </Container>
    </section>
  )
}
