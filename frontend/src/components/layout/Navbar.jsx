import { useState } from 'react'
import { Link } from 'react-router-dom'
import Container from '../ui/Container'

const navLinks = [
  { href: '#product',  label: 'Product' },
  { href: '#features', label: 'Features' },
  { href: '#research', label: 'Research' },
  { href: '#faq',      label: 'FAQ' },
]

function scrollTo(id) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className='sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm'>
      <Container className='flex h-16 items-center justify-between gap-4'>

        {/* Wordmark */}
        <a
          href='#top'
          onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          className='font-serif text-xl tracking-tight text-ink hover:text-ink'
        >
          Prompt Lab
        </a>

        {/* Desktop nav */}
        <nav className='hidden items-center gap-6 text-sm text-muted md:flex' aria-label='Site sections'>
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => {
                e.preventDefault()
                scrollTo(link.href.slice(1))
              }}
              className='transition-standard hover:text-ink'
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Auth CTAs + mobile toggle */}
        <div className='flex items-center gap-3'>
          <Link
            to='/login'
            className='hidden text-sm font-medium text-muted transition-standard hover:text-ink sm:block'
          >
            Sign In
          </Link>
          <Link
            to='/register'
            className='inline-flex items-center gap-1.5 rounded-control bg-brand px-4 py-2 text-sm font-medium text-white transition-standard hover:opacity-90'
          >
            Start Building <span aria-hidden='true'>&#8594;</span>
          </Link>

          {/* Mobile hamburger */}
          <button
            type='button'
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className='flex h-8 w-8 flex-col items-center justify-center gap-1.5 md:hidden'
          >
            <span className={'block h-px w-5 bg-ink transition-standard ' + (menuOpen ? 'translate-y-[3px] rotate-45' : '')} />
            <span className={'block h-px w-5 bg-ink transition-standard ' + (menuOpen ? 'opacity-0' : '')} />
            <span className={'block h-px w-5 bg-ink transition-standard ' + (menuOpen ? '-translate-y-[3px] -rotate-45' : '')} />
          </button>
        </div>
      </Container>

      {/* Mobile menu */}
      {menuOpen && (
        <div className='border-t border-border bg-background/95 px-6 py-4 md:hidden'>
          <nav className='flex flex-col gap-3' aria-label='Mobile site sections'>
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault()
                  setMenuOpen(false)
                  setTimeout(() => scrollTo(link.href.slice(1)), 50)
                }}
                className='text-sm text-muted transition-standard hover:text-ink'
              >
                {link.label}
              </a>
            ))}
            <Link
              to='/login'
              className='text-sm font-medium text-muted transition-standard hover:text-ink'
              onClick={() => setMenuOpen(false)}
            >
              Sign In
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}
