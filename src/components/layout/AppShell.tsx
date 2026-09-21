import type { ReactNode } from 'react'
import { TopNav } from './TopNav'

export function AppShell({
  children,
  onLogout,
  onNavigateSchools,
  onNavigateCrawl,
  onNavigateHistory,
  statusText,
}: {
  children: ReactNode
  onLogout: () => void
  onNavigateSchools: () => void
  onNavigateCrawl: () => void
  onNavigateHistory?: () => void
  statusText?: ReactNode
}) {
  return (
    <div className="app-shell">
      <TopNav
        onLogout={onLogout}
        onNavigateSchools={onNavigateSchools}
        onNavigateCrawl={onNavigateCrawl}
        onNavigateHistory={onNavigateHistory}
        statusText={statusText}
      />
      {children}
    </div>
  )
}
