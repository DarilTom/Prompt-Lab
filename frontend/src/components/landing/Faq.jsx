import { useState } from 'react'
import Container from '../ui/Container'
import SectionHeading from '../ui/SectionHeading'

const faqs = [
  {
    q: 'What is Prompt Lab?',
    a: 'Prompt Lab is a focused workspace for prompt engineering. It lets you create, version, run, and compare prompts against a local language model — so you can iterate with intention rather than guesswork.',
  },
  {
    q: 'Who is Prompt Lab for?',
    a: 'Prompt Lab is built for developers, researchers, and students who work with language models and want a structured way to design and improve prompts over time. It is an MCA mini project developed for Semester 3.',
  },
  {
    q: 'What can I do with a prompt?',
    a: 'You can create a prompt in the Prompt Library, save multiple versions of it, run it in the Execution Sandbox, review the output and metrics in Execution History, and compare two runs side by side in the Comparison view.',
  },
  {
    q: 'Which models are supported?',
    a: 'Prompt Lab currently supports local LLM execution via Ollama. Any model you have installed and running locally through Ollama can be selected in the sandbox. Cloud model support is not part of the current implementation.',
  },
  {
    q: 'Does Prompt Lab store prompt versions?',
    a: 'Yes. Each time you save a new version of a prompt, Prompt Lab stores it with a version number and timestamp. You can view, compare, and restore earlier versions from the Prompt Library.',
  },
  {
    q: 'What is planned for the next phase?',
    a: 'Semester 4 plans include an AI Prompt Optimizer, automatic prompt rewriting, prompt scoring, multi-model evaluation, and advanced analytics. These features are not available in the current build.',
  },
]

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)

  return (
    <div className='border-b border-border'>
      <button
        type='button'
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className='flex w-full items-center justify-between gap-4 py-4 text-left text-sm font-medium text-ink transition-standard hover:text-brand'
      >
        <span>{q}</span>
        <svg
          width='16'
          height='16'
          fill='none'
          viewBox='0 0 24 24'
          stroke='currentColor'
          strokeWidth='2'
          aria-hidden='true'
          className={'shrink-0 transition-standard ' + (open ? 'rotate-45' : '')}
        >
          <path strokeLinecap='round' d='M12 5v14M5 12h14' />
        </svg>
      </button>
      {open && (
        <p className='pb-5 text-sm leading-relaxed text-muted'>{a}</p>
      )}
    </div>
  )
}

export default function Faq() {
  return (
    <section id='faq' className='scroll-mt-20 py-section'>
      <Container>
        <div className='grid gap-12 lg:grid-cols-3'>
          <div>
            <SectionHeading
              eyebrow='FAQ'
              title='Frequently asked questions.'
            />
          </div>
          <div className='lg:col-span-2'>
            <div className='divide-y-0'>
              {faqs.map((item) => (
                <FaqItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
