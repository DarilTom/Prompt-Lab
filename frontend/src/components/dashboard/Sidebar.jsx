import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const icons = {
  overview: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),

  prompts: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6M9 8h6M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
    </svg>
  ),

  improver: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m6.364.636l-2.121 2.121M21 12h-3m.636 6.364l-2.121-2.121M12 21v-3m-6.364.636l2.121-2.121M3 12h3m-.636-6.364l2.121 2.121M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),

  evaluations: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3h6M10 3v3H7a2 2 0 00-2 2v11a2 2 0 002 2h10a2 2 0 002-2V8a2 2 0 00-2-2h-3V3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h8M8 16h5" />
    </svg>
  ),

  executions: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
    </svg>
  ),

  comparisons: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8M8 12h8M8 17h4" />
      <circle cx="4" cy="7" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="4" cy="17" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  ),

  analytics: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l4-8 4 4 4-6 4 10" />
    </svg>
  ),

  settings: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),

  signout: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
}

const primaryNavBeforeEval = [
  {
    to: '/dashboard',
    label: 'Prompt Improver',
    icon: icons.improver,
    match: (pathname) =>
      pathname === '/dashboard' || pathname === '/dashboard/prompts/improve',
  },
  {
    to: '/dashboard/prompts',
    label: 'Prompt Library',
    icon: icons.prompts,
    match: (pathname) =>
      pathname === '/dashboard/prompts' ||
      (pathname.startsWith('/dashboard/prompts/') &&
        pathname !== '/dashboard/prompts/improve'),
  },
]

const primaryNavAfterEval = [
  {
    to: '/dashboard/executions',
    label: 'Execution History',
    icon: icons.executions,
    match: (pathname) => pathname.startsWith('/dashboard/executions'),
  },
  {
    to: '/dashboard/comparisons',
    label: 'Response Comparison',
    icon: icons.comparisons,
    match: (pathname) => pathname.startsWith('/dashboard/comparisons'),
  },
  {
    to: '/dashboard/analytics',
    label: 'Analytics',
    icon: icons.analytics,
    match: (pathname) => pathname.startsWith('/dashboard/analytics'),
  },
]

const evaluationNav = [
  {
    to: '/dashboard/evaluations',
    label: 'Datasets & Runs',
    end: true,
  },
  {
    to: '/dashboard/evaluations/run',
    label: 'Run Evaluation',
    end: true,
  },
  {
    to: '/dashboard/evaluations/compare',
    label: 'Compare Runs',
    end: true,
  },
  {
    to: '/dashboard/evaluations/repeat',
    label: 'Repeatability Study',
    end: true,
  },
  {
    to: '/dashboard/evaluations/performance',
    label: 'Version Performance',
    end: true,
  },
]

const linkBase =
  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-standard'

const activeClass = 'bg-ink text-white'

const inactiveClass =
  'text-muted hover:bg-border/60 hover:text-ink'

const subLinkBase =
  'flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-standard'

const subActiveClass =
  'bg-brand/10 text-brand'

const subInactiveClass =
  'text-muted hover:bg-border/60 hover:text-ink'

export default function Sidebar() {
  const { user, logout } = useAuth()
  const location = useLocation()

  const isEvaluationActive =
    location.pathname.startsWith('/dashboard/evaluations')

  const [isEvaluationOpen, setIsEvaluationOpen] =
    useState(isEvaluationActive)

  // Automatically expand the group when visiting an evaluation page.
  useEffect(() => {
    if (isEvaluationActive) {
      setIsEvaluationOpen(true)
    }
  }, [isEvaluationActive])

  return (
    <aside className="flex h-full w-56 flex-col border-r border-border bg-surface">
      {/* Brand */}
      <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
        <span className="font-serif text-lg tracking-tight text-ink">
          Prompt Lab
        </span>

        <span className="ml-2 rounded-sm bg-brand/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-brand">
          beta
        </span>
      </div>

      {/* Main navigation */}
      <nav
        className="flex-1 overflow-y-auto px-3 py-4"
        aria-label="Dashboard navigation"
      >
        <p className="mb-2 px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted/70">
          Workspace
        </p>

        <ul className="space-y-0.5" role="list">
          {primaryNavBeforeEval.map(({ to, label, icon, match }) => {
            const isActive = match(location.pathname)
            return (
              <li key={to}>
                <NavLink
                  to={to}
                  className={`${linkBase} ${
                    isActive ? activeClass : inactiveClass
                  }`}
                >
                  {icon}
                  <span>{label}</span>
                </NavLink>
              </li>
            )
          })}

          {/* Expandable Evaluation Lab */}
          <li>
            <div
              className={`${linkBase} ${
                isEvaluationActive
                  ? activeClass
                  : inactiveClass
              }`}
            >
              <Link
                to="/dashboard/evaluations"
                className="flex min-w-0 flex-1 items-center gap-2.5"
                aria-label="Open Evaluation Lab home"
              >
                {icons.evaluations}
                <span>Evaluation Lab</span>
              </Link>

              <button
                type="button"
                onClick={() =>
                  setIsEvaluationOpen((open) => !open)
                }
                aria-expanded={isEvaluationOpen}
                aria-controls="evaluation-lab-menu"
                aria-label={
                  isEvaluationOpen
                    ? 'Collapse Evaluation Lab menu'
                    : 'Expand Evaluation Lab menu'
                }
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`transition-transform duration-200 ${
                    isEvaluationOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 9l6 6 6-6"
                  />
                </svg>
              </button>
            </div>

            {isEvaluationOpen && (
              <ul
                id="evaluation-lab-menu"
                className="ml-5 mt-1 space-y-0.5 border-l border-border pl-3"
                role="list"
              >
                {evaluationNav.map(
                  ({ to, label, end }) => (
                    <li key={to}>
                      <NavLink
                        to={to}
                        end={end}
                        className={({ isActive }) =>
                          `${subLinkBase} ${
                            isActive
                              ? subActiveClass
                              : subInactiveClass
                          }`
                        }
                      >
                        <span>{label}</span>
                      </NavLink>
                    </li>
                  )
                )}
              </ul>
            )}
          </li>

          {primaryNavAfterEval.map(({ to, label, icon, match }) => {
            const isActive = match(location.pathname)
            return (
              <li key={to}>
                <NavLink
                  to={to}
                  className={`${linkBase} ${
                    isActive ? activeClass : inactiveClass
                  }`}
                >
                  {icon}
                  <span>{label}</span>
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Overview, settings, profile, and sign out */}
      <div className="shrink-0 space-y-0.5 border-t border-border px-3 py-3">
        <NavLink
          to="/dashboard/overview"
          className={`${linkBase} ${
            location.pathname === '/dashboard/overview'
              ? activeClass
              : inactiveClass
          }`}
        >
          {icons.overview}
          <span>Overview</span>
        </NavLink>

        <NavLink
          to="/dashboard/settings"
          className={({ isActive }) =>
            `${linkBase} ${
              isActive ? activeClass : inactiveClass
            }`
          }
        >
          {icons.settings}
          <span>Settings</span>
        </NavLink>

        <div className="mt-2 flex items-center gap-2.5 rounded-md px-3 py-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/15 font-mono text-xs font-semibold text-brand">
            {(user?.name?.[0] || user?.email?.[0] || '?').toUpperCase()}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-ink">
              {user?.name || 'You'}
            </p>

            <p className="truncate font-mono text-[10px] text-muted">
              {user?.email || ''}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={logout}
          className={`${linkBase} ${inactiveClass} w-full text-left`}
        >
          {icons.signout}
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )
}