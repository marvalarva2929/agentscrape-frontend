import type { ReactNode } from 'react'
import { TopNav } from './TopNav'

export function AppShell({
  children,
  onLogout,
  onNavigateSchools,
  onNavigateCrawl,
  onNavigateHistory,
  onNavigateGame,
  statusText,
}: {
  children: ReactNode
  onLogout: () => void
  onNavigateSchools: () => void
  onNavigateCrawl?: () => void
  onNavigateHistory?: () => void
  onNavigateGame?: () => void
  statusText?: ReactNode
}) {
  return (
    <div className="app-shell">
      <TopNav
        onLogout={onLogout}
        onNavigateSchools={onNavigateSchools}
        onNavigateCrawl={onNavigateCrawl}
        onNavigateHistory={onNavigateHistory}
        onNavigateGame={onNavigateGame}
        statusText={statusText}
      />
      {children}
    </div>
  )
}
