import type { ReactNode } from 'react'
import { TopNav } from './TopNav'

export function AppShell({
  children,
  onLogout,
  onNavigateSchools,
  onNavigateCrawl,
  onNavigateSubmit,
  onNavigateHistory,
  onNavigateAdmin,
  isAdmin,
  statusText,
}: {
  children: ReactNode
  onLogout: () => void
  onNavigateSchools: () => void
  onNavigateCrawl: () => void
  onNavigateSubmit?: () => void
  onNavigateHistory?: () => void
  onNavigateAdmin?: () => void
  isAdmin?: boolean
  statusText?: ReactNode
}) {
  return (
    <div className="app-shell">
      <TopNav
        onLogout={onLogout}
        onNavigateSchools={onNavigateSchools}
        onNavigateCrawl={onNavigateCrawl}
        onNavigateSubmit={onNavigateSubmit}
        onNavigateHistory={onNavigateHistory}
        onNavigateAdmin={onNavigateAdmin}
        isAdmin={isAdmin}
        statusText={statusText}
      />
      {children}
    </div>
  )
}
