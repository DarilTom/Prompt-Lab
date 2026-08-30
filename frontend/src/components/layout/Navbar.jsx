import { Link } from 'react-router-dom'
import Container from '../ui/Container'

const navLinks = [
  { href: '#product', label: 'Product' },
  { href: '#features', label: 'Features' },
  { href: '#research', label: 'Research' },
  { href: '#docs', label: 'Documentation' },
]

export default function Navbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm">
      <Container className="flex h-16 items-center justify-between gap-4">
        {/* Wordmark */}
        <a href="#top" className="font-serif text-xl tracking-tight text-ink hover:text-ink">
          Prompt Lab
        </a>

        {/* Page-section anchors */}
        <nav className="hidden items-center gap-6 text-sm text-muted md:flex" aria-label="Site sections">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="transition-standard hover:text-ink">
              {link.label}
            </a>
          ))}
        </nav>

        {/* Auth CTAs */}
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="hidden text-sm font-medium text-muted transition-standard hover:text-ink sm:block"
          >
            Sign In
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center gap-1.5 rounded-control bg-brand px-4 py-2 text-sm font-medium text-white transition-standard hover:opacity-90"
          >
            Start Building
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </Container>
    </header>
  )
}
