import Button from '../ui/Button'
import Container from '../ui/Container'

const links = [
  { href: '#showcase', label: 'Workspace' },
  { href: '#features', label: 'Features' },
  { href: '#workflow', label: 'Workflow' },
  { href: '#research', label: 'Research' },
]

export default function Navbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background">
      <Container className="flex h-16 items-center justify-between gap-4">
        <a href="#top" className="font-serif text-xl tracking-tight text-ink hover:text-ink">
          Prompt Lab
        </a>
        <nav className="hidden items-center gap-6 text-sm text-muted md:flex" aria-label="Page">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="hover:text-brand">
              {link.label}
            </a>
          ))}
        </nav>
        <Button href="#cta">Enter the lab</Button>
      </Container>
    </header>
  )
}
