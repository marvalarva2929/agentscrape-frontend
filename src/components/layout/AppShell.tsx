import type { ReactNode } from 'react'
import { TopNav } from './TopNav'

export function AppShell({
  children,
  onLogout,
  onNavigateSchools,
  onNavigateCrawl,
  onNavigateHistory,
  onNavigateQueue,
  crawlLabel,
  statusText,
}: {
  children: ReactNode
  onLogout: () => void
  onNavigateSchools: () => void
  onNavigateCrawl?: () => void
  onNavigateHistory?: () => void
  onNavigateQueue?: () => void
  /** Names what starting a crawl will do: run it now, or join the queue. */
  crawlLabel?: string
  statusText?: ReactNode
}) {
  return (
    <div className="app-shell">
      <TopNav
        onLogout={onLogout}
        onNavigateSchools={onNavigateSchools}
        onNavigateCrawl={onNavigateCrawl}
        onNavigateHistory={onNavigateHistory}
        onNavigateQueue={onNavigateQueue}
        crawlLabel={crawlLabel}
        statusText={statusText}
      />
      {children}
    </div>
  )
}
