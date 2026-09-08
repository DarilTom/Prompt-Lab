import Container from '../ui/Container'
import SectionHeading from '../ui/SectionHeading'

const concepts = [
  {
    n: '01',
    title: 'Iteration',
    body: 'Prompt refinement is an experimental loop, not a single conversation. Each version is a hypothesis waiting to be tested against a fixed case.',
  },
  {
    n: '02',
    title: 'Measurement',
    body: 'Every execution captures output, latency, and token use. The record exists so decisions can be revisited, not reconstructed from memory.',
  },
  {
    n: '03',
    title: 'Comparison',
    body: 'Progress is visible only when versions are placed side by side. Prompt Lab makes that comparison the default step — not an afterthought.',
  },
]

export default function Research() {
  return (
    <section id='research' className='scroll-mt-20 py-section'>
      <Container>
        <SectionHeading
          eyebrow='Research'
          title='Built for experimentation, not just generation.'
          description='Prompt engineering is iterative. Prompt Lab treats prompts as versioned artifacts so experiments can be executed, measured, compared, and refined.'
        />
        <div className='mt-roomy grid gap-6 sm:grid-cols-3'>
          {concepts.map((c) => (
            <article key={c.n} className='border-t-2 border-brand pt-5'>
              <p className='font-mono text-xs text-brand'>{c.n} &#8212;</p>
              <h3 className='mt-tight font-sans text-base font-semibold text-ink'>{c.title}</h3>
              <p className='mt-stack text-sm leading-relaxed text-muted'>{c.body}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  )
}
