import { Link } from 'react-router-dom'
import Container from '../ui/Container'

function ExperimentPanel() {
  return (
    <div
      className='w-full max-w-sm rounded-card border border-border bg-surface shadow-raised lg:max-w-none'
      aria-hidden='true'
    >
      {/* Panel header */}
      <div className='flex items-center justify-between border-b border-border px-4 py-3'>
        <div>
          <p className='font-mono text-[10px] uppercase tracking-[0.2em] text-muted'>Experiment 014</p>
          <p className='mt-0.5 text-sm font-medium text-ink'>Customer Support Prompt</p>
        </div>
        <div className='flex items-center gap-2'>
          <span className='font-mono text-[10px] text-muted'>v04</span>
          <span className='rounded border border-warning/30 bg-warning/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-warning'>
            Testing
          </span>
        </div>
      </div>

      {/* Prompt body */}
      <div className='px-4 py-4'>
        <p className='mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted'>Prompt</p>
        <div className='rounded-md border border-border bg-background px-3 py-3'>
          <p className='font-mono text-[11px] leading-relaxed text-muted'>
            Analyze the following customer issue and produce a clear, empathetic support response...
          </p>
        </div>
      </div>

      {/* Metadata grid */}
      <div className='grid grid-cols-3 gap-0 border-t border-border'>
        {[
          { label: 'Model',    value: 'gemma3:4b' },
          { label: 'Tokens',   value: '384' },
          { label: 'Latency',  value: '1.2s' },
        ].map((m) => (
          <div key={m.label} className='border-r border-border px-4 py-3 last:border-r-0'>
            <p className='font-mono text-[9px] uppercase tracking-widest text-muted/60'>{m.label}</p>
            <p className='mt-1 font-mono text-sm text-ink'>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Illustrative disclaimer */}
      <div className='border-t border-border px-4 py-2.5'>
        <p className='font-mono text-[9px] uppercase tracking-[0.14em] text-muted/50'>
          Illustrative product UI — not live data
        </p>
      </div>
    </div>
  )
}

export default function Hero() {
  return (
    <section id='top' className='py-section sm:py-20'>
      <Container>
        <div className='grid items-center gap-12 lg:grid-cols-2'>

          {/* Left: editorial text */}
          <div>
            <p className='mb-tight font-mono text-xs uppercase tracking-[0.2em] text-muted'>
              Prompt Lab
            </p>
            <h1 className='max-w-xl font-serif text-4xl tracking-tight text-ink sm:text-5xl lg:text-[3.5rem]'>
              A laboratory for better prompts.
            </h1>
            <p className='mt-stack max-w-lg text-lg leading-relaxed text-muted'>
              Create, test, version, compare, and optimize prompts across AI models
              from one focused workspace.
            </p>
            <div className='mt-roomy flex flex-wrap gap-3'>
              <Link
                to='/login'
                className='inline-flex items-center justify-center rounded-control bg-brand px-5 py-2.5 text-sm font-medium text-white transition-standard hover:opacity-90'
              >
                Enter the lab
              </Link>
              <a
                href='#product'
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById('product')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className='inline-flex items-center justify-center rounded-control border border-border bg-surface px-5 py-2.5 text-sm font-medium text-ink transition-standard hover:border-ink/20 hover:text-ink'
              >
                See the workspace
              </a>
            </div>
          </div>

          {/* Right: experiment panel */}
          <div className='flex justify-center lg:justify-end'>
            <ExperimentPanel />
          </div>

        </div>
      </Container>
    </section>
  )
}
