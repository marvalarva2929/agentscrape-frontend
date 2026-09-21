import type { ReactNode } from 'react'

export function TopNav({
  onLogout,
  onNavigateSchools,
  onNavigateCrawl,
  onNavigateHistory,
  statusText,
  children,
}: {
  onLogout: () => void
  onNavigateSchools: () => void
  onNavigateCrawl: () => void
  onNavigateHistory?: () => void
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
        <button className="nav-link" onClick={onNavigateSchools}>Programs</button>
        {onNavigateHistory ? (
          <button className="nav-link" onClick={onNavigateHistory}>Past crawls</button>
        ) : null}
        <button className="primary-button small-button" onClick={onNavigateCrawl}>CRAWL / UPDATE</button>
        {children}
      </nav>

      <div className="topbar-actions">
        {statusText ? <span className="status-pill online">{statusText}</span> : null}
        <button className="link-button" onClick={onLogout}>Logout</button>
      </div>
    </header>
  )
}
