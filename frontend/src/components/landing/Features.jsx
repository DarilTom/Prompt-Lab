import Container from '../ui/Container'
import SectionHeading from '../ui/SectionHeading'

const features = [
  {
    key: '01',
    title: 'Prompt Library',
    body: 'Create and organize prompts in a personal workspace. Each prompt is a named, editable experiment artifact.',
  },
  {
    key: '02',
    title: 'Prompt Versioning',
    body: 'Maintain multiple versions of each prompt with a visible change history so you always know what you changed.',
  },
  {
    key: '03',
    title: 'Execution Sandbox',
    body: 'Run prompts against a local LLM via Ollama and inspect outputs, token counts, and latency in one view.',
  },
  {
    key: '04',
    title: 'Execution History',
    body: 'Keep a record of every prompt execution — outputs, model settings, and performance metrics — for later review.',
  },
  {
    key: '05',
    title: 'Response Comparison',
    body: 'Place two completed runs side by side. Read the differences and make an evidence-based decision on which to keep.',
  },
  {
    key: '06',
    title: 'Basic Analytics',
    body: 'Review execution activity and model usage across your workspace. Understand how your prompts are being run.',
  },
]

export default function Features() {
  return (
    <section id='features' className='scroll-mt-20 py-section bg-surface'>
      <Container>
        <SectionHeading
          eyebrow='Features'
          title='Everything needed for the prompt lifecycle.'
          description=' These are the features currently built and available for your workspace.'
        />
        <div className='mt-roomy grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {features.map((f) => (
            <article
              key={f.key}
              className='rounded-card border border-border bg-background p-6'
            >
              <p className='font-mono text-xs text-brand'>{f.key}</p>
              <h3 className='mt-tight font-sans text-base font-semibold tracking-tight text-ink'>
                {f.title}
              </h3>
              <p className='mt-stack text-sm leading-relaxed text-muted'>{f.body}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  )
}
