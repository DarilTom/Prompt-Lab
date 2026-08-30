import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import DashboardHeader from './DashboardHeader'

// Derive a human-readable title from the current pathname
function usePageTitle() {
  const { pathname } = useLocation()
  const segment = pathname.split('/').filter(Boolean).pop()
  if (!segment || segment === 'dashboard') return 'Overview'
  return segment.charAt(0).toUpperCase() + segment.slice(1)
}

export default function DashboardLayout() {
  const title = usePageTitle()

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardHeader title={title} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}