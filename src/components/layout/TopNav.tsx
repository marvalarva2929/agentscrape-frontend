import type { ReactNode } from 'react'

export function TopNav({
  onLogout,
  onNavigateSchools,
  onNavigateCrawl,
  onNavigateHistory,
  onNavigateQueue,
  crawlLabel,
  statusText,
  children,
}: {
  onLogout: () => void
  onNavigateSchools: () => void
  onNavigateCrawl?: () => void
  onNavigateHistory?: () => void
  onNavigateQueue?: () => void
  /** Names what starting a crawl will do: run it now, or join the queue. */
  crawlLabel?: string
  statusText?: ReactNode
  children?: ReactNode
}) {
  return (
    <header className="topbar">
      <div className="brand-wrap">
        <div className="brand-mark">R</div>
        <button className="nav-link" onClick={onNavigateSchools}>Residency Monitor</button>
      </div>

      <nav className="main-nav" aria-label="Main navigation">
        <button className="nav-link" onClick={onNavigateSchools}>Schools</button>
        {onNavigateHistory ? (
          <button className="nav-link" onClick={onNavigateHistory}>Past crawls</button>
        ) : null}
        {onNavigateQueue ? (
          <button className="nav-link" onClick={onNavigateQueue}>Queue</button>
        ) : null}
        {onNavigateCrawl ? (
          <button className="primary-button small-button" onClick={onNavigateCrawl}>{crawlLabel ?? 'Run Crawl'}</button>
        ) : null}
        {children}
      </nav>

      <div className="topbar-actions">
        {statusText ? <span className="status-pill online">{statusText}</span> : null}
        <button className="link-button" onClick={onLogout}>Logout</button>
      </div>
    </header>
  )
}
