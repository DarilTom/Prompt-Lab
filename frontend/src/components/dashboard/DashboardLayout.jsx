import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import DashboardHeader from './DashboardHeader'
import { PromptImproverProvider } from '../../context/PromptImproverContext'
import { ExecutionProvider } from '../../context/ExecutionContext'

function useBreadcrumbs(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/dashboard'

  if (path === '/dashboard' || path === '/dashboard/prompts/improve') {
    return [
      { label: 'Workspace' },
      { label: 'Prompt Improver' },
    ]
  }

  if (path === '/dashboard/overview') {
    return [
      { label: 'Workspace' },
      { label: 'Overview' },
    ]
  }

  if (path === '/dashboard/prompts') {
    return [
      { label: 'Workspace' },
      { label: 'Prompt Library' },
    ]
  }

  if (path === '/dashboard/prompts/new') {
    return [
      { label: 'Prompt Library', to: '/dashboard/prompts' },
      { label: 'New Prompt' },
    ]
  }

  if (path.startsWith('/dashboard/prompts/')) {
    return [
      { label: 'Prompt Library', to: '/dashboard/prompts' },
      { label: 'Prompt Detail' },
    ]
  }

  if (path === '/dashboard/executions') {
    return [
      { label: 'Workspace' },
      { label: 'Execution History' },
    ]
  }

  if (path.startsWith('/dashboard/executions/')) {
    return [
      { label: 'Execution History', to: '/dashboard/executions' },
      { label: 'Execution Detail' },
    ]
  }

  if (path === '/dashboard/comparisons') {
    return [
      { label: 'Workspace' },
      { label: 'Response Comparison' },
    ]
  }

  if (path === '/dashboard/analytics') {
    return [
      { label: 'Workspace' },
      { label: 'Analytics' },
    ]
  }

  if (path === '/dashboard/evaluations') {
    return [
      { label: 'Workspace' },
      { label: 'Evaluation Lab' },
    ]
  }

  if (path === '/dashboard/evaluations/run') {
    return [
      { label: 'Evaluation Lab', to: '/dashboard/evaluations' },
      { label: 'Run Evaluation' },
    ]
  }

  if (path === '/dashboard/evaluations/compare') {
    return [
      { label: 'Evaluation Lab', to: '/dashboard/evaluations' },
      { label: 'Compare Runs' },
    ]
  }

  if (path.startsWith('/dashboard/evaluations/runs/')) {
    return [
      { label: 'Evaluation Lab', to: '/dashboard/evaluations' },
      { label: 'Evaluation Result' },
    ]
  }

  if (path === '/dashboard/evaluations/repeat') {
    return [
      { label: 'Evaluation Lab', to: '/dashboard/evaluations' },
      { label: 'Repeatability Study' },
    ]
  }

  if (path === '/dashboard/evaluations/performance') {
    return [
      { label: 'Evaluation Lab', to: '/dashboard/evaluations' },
      { label: 'Version Performance' },
    ]
  }

  if (path === '/dashboard/settings') {
    return [
      { label: 'Workspace' },
      { label: 'Settings' },
    ]
  }

  if (path === '/dashboard/admin') {
    return [
      { label: 'Administration' },
      { label: 'Overview' },
    ]
  }

  if (path === '/dashboard/admin/users') {
    return [
      { label: 'Administration', to: '/dashboard/admin' },
      { label: 'Users' },
    ]
  }

  const segments = path.split('/').filter(Boolean)
  const last = segments[segments.length - 1] || 'Dashboard'
  const formatted = last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, ' ')
  return [
    { label: 'Workspace' },
    { label: formatted },
  ]
}

export default function DashboardLayout() {
  const { pathname } = useLocation()
  const breadcrumbs = useBreadcrumbs(pathname)

  return (
    <PromptImproverProvider>
      <ExecutionProvider>
        <div className="flex h-dvh overflow-hidden bg-background">
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <DashboardHeader breadcrumbs={breadcrumbs} />
            <main className="flex-1 overflow-y-auto p-6">
              <Outlet />
            </main>
          </div>
        </div>
      </ExecutionProvider>
    </PromptImproverProvider>
  )
}
