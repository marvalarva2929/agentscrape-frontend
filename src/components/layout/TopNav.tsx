import type { ReactNode } from 'react'

export function TopNav({
  onLogout,
  onNavigateSchools,
  onNavigateCrawl,
  onNavigateSubmit,
  onNavigateHistory,
  onNavigateAdmin,
  isAdmin,
  statusText,
  children,
}: {
  onLogout: () => void
  onNavigateSchools: () => void
  onNavigateCrawl: () => void
  onNavigateSubmit?: () => void
  onNavigateHistory?: () => void
  onNavigateAdmin?: () => void
  isAdmin?: boolean
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
        {onNavigateSubmit ? (
          <button className="nav-link" onClick={onNavigateSubmit}>Request schools</button>
        ) : null}
        {/* Staff only: launching runs is billable. */}
        {isAdmin && onNavigateAdmin ? (
          <button className="nav-link" onClick={onNavigateAdmin}>Admin</button>
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
