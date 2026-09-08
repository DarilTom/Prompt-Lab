import Container from '../ui/Container'

export default function Footer() {
  return (
    <footer className='border-t border-border py-10'>
      <Container className='flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between'>
        <div>
          <p className='font-serif text-2xl tracking-tight text-ink'>Prompt Lab</p>
          <p className='mt-tight text-sm text-muted'>A laboratory for better prompts.</p>
        </div>
        <div className='font-mono text-xs text-muted'>
          <p>Design. Test. Optimize. Compare.</p>
          <p className='mt-tight'>MCA Mini Project &#183; 2026</p>
        </div>
      </Container>
    </footer>
  )
}
