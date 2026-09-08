import Container from '../ui/Container'

const planned = [
  'AI Prompt Optimizer',
  'Prompt Scoring',
  'Automatic Prompt Rewriting',
  'Multi-Model Evaluation',
  'Advanced Analytics',
]

export default function NextPhase() {
  return (
    <section className='py-section bg-surface'>
      <Container>
        <div className='mx-auto max-w-2xl'>
          <p className='font-mono text-[10px] uppercase tracking-[0.22em] text-muted'>Next Phase</p>
          <h2 className='mt-2 font-serif text-3xl tracking-tight text-ink sm:text-4xl'>
            From prompt management to prompt intelligence.
          </h2>
          <p className='mt-4 text-sm leading-relaxed text-muted'>
            The following capabilities are planned for the next phaseand are not
            part of the current implementation.
          </p>

          <ul className='mt-8 space-y-3'>
            {planned.map((item) => (
              <li key={item} className='flex items-start gap-3'>
                <span
                  className='mt-0.5 shrink-0 rounded-sm border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-muted/60'
                  aria-label='Planned for Semester 4'
                >
                  S4
                </span>
                <span className='text-sm text-ink'>{item}</span>
              </li>
            ))}
          </ul>

          <p className='mt-6 font-mono text-[10px] uppercase tracking-[0.16em] text-muted/60'>
            Future capabilities will be added to the platform as part of the next phase of development.
          </p>
        </div>
      </Container>
    </section>
  )
}
