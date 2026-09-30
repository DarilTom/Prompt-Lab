import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const icons = {
  overview: (
    <svg width='16' height='16' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth='1.75' aria-hidden='true'>
      <rect x='3' y='3' width='7' height='7' rx='1' />
      <rect x='14' y='3' width='7' height='7' rx='1' />
      <rect x='3' y='14' width='7' height='7' rx='1' />
      <rect x='14' y='14' width='7' height='7' rx='1' />
    </svg>
  ),
  prompts: (
    <svg width='16' height='16' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth='1.75' aria-hidden='true'>
      <path strokeLinecap='round' strokeLinejoin='round' d='M9 12h6M9 8h6M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z' />
    </svg>
  ),
  evaluations: (
  <svg
    width='16'
    height='16'
    fill='none'
    viewBox='0 0 24 24'
    stroke='currentColor'
    strokeWidth='1.75'
    aria-hidden='true'
  >
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      d='M4 5a2 2 0 012-2h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5z'
    />
    <path
      strokeLinecap='round'
      d='M8 8h8M8 12h5M8 16h3'
    />
  </svg>
),
  executions: (
    <svg width='16' height='16' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth='1.75' aria-hidden='true'>
      <path strokeLinecap='round' strokeLinejoin='round' d='M5 3l14 9-14 9V3z' />
    </svg>
  ),
  comparisons: (
    <svg width='16' height='16' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth='1.75' aria-hidden='true'>
      <path strokeLinecap='round' strokeLinejoin='round' d='M8 7h8M8 12h8M8 17h4' />
      <circle cx='4' cy='7' r='1.5' fill='currentColor' stroke='none' />
      <circle cx='4' cy='12' r='1.5' fill='currentColor' stroke='none' />
      <circle cx='4' cy='17' r='1.5' fill='currentColor' stroke='none' />
    </svg>
  ),
  analytics: (
    <svg width='16' height='16' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth='1.75' aria-hidden='true'>
      <path strokeLinecap='round' strokeLinejoin='round' d='M3 17l4-8 4 4 4-6 4 10' />
    </svg>
  ),
  settings: (
    <svg width='16' height='16' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth='1.75' aria-hidden='true'>
      <circle cx='12' cy='12' r='3' />
      <path strokeLinecap='round' d='M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z' />
    </svg>
  ),
  signout: (
    <svg width='16' height='16' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth='1.75' aria-hidden='true'>
      <path strokeLinecap='round' strokeLinejoin='round' d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1' />
    </svg>
  ),
}

const primaryNav = [
  { to: '/dashboard', label: 'Overview', icon: icons.overview, end: true },
  { to: '/dashboard/prompts', label: 'Prompts', icon: icons.prompts },
  { to: '/dashboard/evaluations', label: 'Evaluations', icon: icons.evaluations },
  { to: '/dashboard/executions', label: 'Executions', icon: icons.executions },
  { to: '/dashboard/comparisons', label: 'Comparisons', icon: icons.comparisons },
  { to: '/dashboard/analytics', label: 'Analytics', icon: icons.analytics },
]

const linkBase = 'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-standard'
const activeClass = 'bg-ink text-white'
const inactiveClass = 'text-muted hover:bg-border/60 hover:text-ink'

export default function Sidebar() {
  const { user, logout } = useAuth()

  return (
    <aside className='flex h-full w-56 flex-col border-r border-border bg-surface'>
      <div className='flex h-14 shrink-0 items-center border-b border-border px-4'>
        <span className='font-serif text-lg tracking-tight text-ink'>Prompt Lab</span>
        <span className='ml-2 rounded-sm bg-brand/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-brand'>
          beta
        </span>
      </div>

      <nav className='flex-1 overflow-y-auto px-3 py-4' aria-label='Dashboard navigation'>
        <p className='mb-2 px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted/70'>
          Workspace
        </p>
        <ul className='space-y-0.5' role='list'>
          {primaryNav.map(({ to, label, icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  linkBase + ' ' + (isActive ? activeClass : inactiveClass)
                }
              >
                {icon}
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className='shrink-0 border-t border-border px-3 py-3 space-y-0.5'>
        <NavLink
          to='/dashboard/settings'
          className={({ isActive }) =>
            linkBase + ' ' + (isActive ? activeClass : inactiveClass)
          }
        >
          {icons.settings}
          Settings
        </NavLink>

        <div className='mt-2 flex items-center gap-2.5 rounded-md px-3 py-2'>
          <div className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/15 font-mono text-xs font-semibold text-brand'>
            {(user?.name?.[0] || user?.email?.[0] || '?').toUpperCase()}
          </div>
          <div className='min-w-0 flex-1'>
            <p className='truncate text-xs font-medium text-ink'>
              {user?.name || 'You'}
            </p>
            <p className='truncate font-mono text-[10px] text-muted'>
              {user?.email || ''}
            </p>
          </div>
        </div>

        <button
          type='button'
          onClick={logout}
          className={linkBase + ' ' + inactiveClass + ' w-full text-left'}
        >
          {icons.signout}
          Sign out
        </button>
      </div>
    </aside>
  )
}
