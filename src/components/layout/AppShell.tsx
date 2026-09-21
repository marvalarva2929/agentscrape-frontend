import type { ReactNode } from 'react'
import { TopNav, type NavItem } from './TopNav'

export function AppShell({
  children,
  onLogout,
  onNavigateHome,
  onNavigateSchools,
  onNavigateCrawl,
  onNavigateHistory,
  onNavigateQueue,
  crawlLabel,
  statusText,
  active,
}: {
  children: ReactNode
  onLogout: () => void
  onNavigateHome?: () => void
  onNavigateSchools: () => void
  onNavigateCrawl?: () => void
  onNavigateHistory?: () => void
  onNavigateQueue?: () => void
  /** Names what starting a crawl will do: run it now, or join the queue. */
  crawlLabel?: string
  statusText?: ReactNode
  active?: NavItem
}) {
  return (
    <div className="app-shell">
      <TopNav
        onLogout={onLogout}
        onNavigateHome={onNavigateHome}
        onNavigateSchools={onNavigateSchools}
        onNavigateCrawl={onNavigateCrawl}
        onNavigateHistory={onNavigateHistory}
        onNavigateQueue={onNavigateQueue}
        crawlLabel={crawlLabel}
        statusText={statusText}
        active={active}
      />
      {children}
    </div>
  )
}
