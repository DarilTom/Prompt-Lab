import Container from '../ui/Container'
import SectionHeading from '../ui/SectionHeading'

const steps = [
  { n: '01', label: 'Create',  desc: 'Write a prompt in the library. Describe its job, its audience, and its constraints.' },
  { n: '02', label: 'Version', desc: 'Save each revision as a numbered version. The history stays intact.' },
  { n: '03', label: 'Execute', desc: 'Run the prompt against a local model. Capture output, latency, and token count.' },
  { n: '04', label: 'Compare', desc: 'Place two runs side by side. Read what changed and decide which holds up.' },
  { n: '05', label: 'Analyze', desc: 'Review execution activity and model usage across all your experiments.' },
]

export default function ProductShowcase() {
  return (
    <section id='product' className='scroll-mt-20 pb-section pt-section'>
      <Container>
        <SectionHeading
          eyebrow='Product'
          title='The product is the experiment bench.'
          description='Prompts sit beside versions, executions, outputs, and measurements — giving you one focused workspace for iterative prompt engineering.'
        />

        {/* Workflow spine — vertical on mobile, horizontal line with nodes on lg */}
        <div className='mt-roomy'>
          <ol className='relative flex flex-col gap-0' aria-label='Prompt workflow'>
            {steps.map((step, i) => (
              <li key={step.n} className='group flex gap-5'>

                {/* Spine column */}
                <div className='flex flex-col items-center'>
                  <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface shadow-subtle'>
                    <span className='font-mono text-[10px] text-muted'>{step.n}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className='mt-1 w-px flex-1 bg-border' style={{ minHeight: '2.5rem' }} aria-hidden='true' />
                  )}
                </div>

                {/* Content */}
                <div className='pb-8'>
                  <p className='font-mono text-xs font-semibold uppercase tracking-[0.16em] text-brand'>
                    {step.label}
                  </p>
                  <p className='mt-1 max-w-md text-sm leading-relaxed text-muted'>{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  )
}
