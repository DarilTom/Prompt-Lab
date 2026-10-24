import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import DashboardHeader from './DashboardHeader'
import { PromptImproverProvider } from '../../context/PromptImproverContext'

const ROUTE_TITLES = {
  '/dashboard': 'Prompt Improver',
  '/dashboard/': 'Prompt Improver',
  '/dashboard/prompts/improve': 'Prompt Improver',
  '/dashboard/overview': 'Overview',
  '/dashboard/prompts': 'Prompt Library',
  '/dashboard/prompts/new': 'New Prompt',
  '/dashboard/evaluations': 'Evaluation Lab',
  '/dashboard/evaluations/run': 'Run Evaluation',
  '/dashboard/evaluations/compare': 'Compare Runs',
  '/dashboard/evaluations/repeat': 'Repeatability Study',
  '/dashboard/evaluations/performance': 'Version Performance',
  '/dashboard/executions': 'Execution History',
  '/dashboard/comparisons': 'Response Comparison',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/settings': 'Settings',
}

// Derive a human-readable title from the current pathname
function usePageTitle() {
  const { pathname } = useLocation()

  if (ROUTE_TITLES[pathname]) {
    return ROUTE_TITLES[pathname]
  }

  if (pathname.startsWith('/dashboard/prompts/')) {
    return 'Prompt Detail'
  }

  if (pathname.startsWith('/dashboard/executions/')) {
    return 'Execution Detail'
  }

  if (pathname.startsWith('/dashboard/evaluations/runs/')) {
    return 'Evaluation Result'
  }

  const segment = pathname.split('/').filter(Boolean).pop()
  if (!segment) return 'Prompt Improver'
  return segment.charAt(0).toUpperCase() + segment.slice(1)
}

export default function DashboardLayout() {
  const title = usePageTitle()

  return (
    <PromptImproverProvider>
      <div className="flex h-dvh overflow-hidden bg-background">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <DashboardHeader title={title} />
          <main className="flex-1 overflow-y-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </PromptImproverProvider>
  )
}