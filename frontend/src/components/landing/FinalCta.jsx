import { Link } from 'react-router-dom'
import Container from '../ui/Container'

export default function FinalCta() {
  return (
    <section id='cta' className='scroll-mt-20 py-section'>
      <Container>
        <div className='rounded-card border border-border bg-surface px-6 py-12 text-center shadow-subtle sm:px-12'>
          <p className='mb-tight font-mono text-xs uppercase tracking-[0.2em] text-muted'>
            Get started
          </p>
          <h2 className='font-serif text-3xl tracking-tight text-ink sm:text-5xl'>
            Bring the next prompt to the bench.
          </h2>
          <p className='mx-auto mt-stack max-w-md text-muted'>
            Start building, test an idea, and turn prompt iteration into a measurable workflow.
          </p>
          <div className='mt-roomy flex flex-wrap items-center justify-center gap-3'>
            <Link
              to='/register'
              className='inline-flex items-center gap-1.5 rounded-control bg-brand px-5 py-2.5 text-sm font-medium text-white transition-standard hover:opacity-90'
            >
              Start Building <span aria-hidden='true'>&#8594;</span>
            </Link>
            <Link
              to='/login'
              className='inline-flex items-center rounded-control border border-border bg-background px-5 py-2.5 text-sm font-medium text-ink transition-standard hover:border-ink/30 hover:text-ink'
            >
              Sign In
            </Link>
          </div>
        </div>
      </Container>
    </section>
  )
}
