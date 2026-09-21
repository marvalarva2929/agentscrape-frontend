import type { ReactNode } from 'react'

export type NavItem = 'home' | 'data' | 'history' | 'queue' | 'crawl'

export function TopNav({
  onLogout,
  onNavigateHome,
  onNavigateSchools,
  onNavigateCrawl,
  onNavigateHistory,
  onNavigateQueue,
  crawlLabel,
  statusText,
  active,
  children,
}: {
  onLogout: () => void
  onNavigateHome?: () => void
  onNavigateSchools: () => void
  onNavigateCrawl?: () => void
  onNavigateHistory?: () => void
  onNavigateQueue?: () => void
  /** Names what starting a crawl will do: run it now, or join the queue. */
  crawlLabel?: string
  statusText?: ReactNode
  /** The page being shown, outlined in the navigation. */
  active?: NavItem
  children?: ReactNode
}) {
  return (
    <header className="topbar">
      <div className="brand-wrap">
        <div className="brand-mark">R</div>
        <button className="nav-link" onClick={onNavigateHome ?? onNavigateSchools}>Residency Monitor</button>
      </div>

      <nav className="main-nav" aria-label="Main navigation">
        {onNavigateHome ? (
          <button className={navClass('home', active)} aria-current={active === 'home' ? 'page' : undefined} onClick={onNavigateHome}>Home</button>
        ) : null}
        <button className={navClass('data', active)} aria-current={active === 'data' ? 'page' : undefined} onClick={onNavigateSchools}>Data</button>
        {onNavigateHistory ? (
          <button className={navClass('history', active)} aria-current={active === 'history' ? 'page' : undefined} onClick={onNavigateHistory}>Past crawls</button>
        ) : null}
        {onNavigateQueue ? (
          <button className={navClass('queue', active)} aria-current={active === 'queue' ? 'page' : undefined} onClick={onNavigateQueue}>Queue</button>
        ) : null}
        {onNavigateCrawl ? (
          <button className={`primary-button small-button${active === 'crawl' ? ' active' : ''}`} aria-current={active === 'crawl' ? 'page' : undefined} onClick={onNavigateCrawl}>{crawlLabel ?? 'Run Crawl'}</button>
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

const navClass = (item: NavItem, active?: NavItem) => `nav-link${active === item ? ' active' : ''}`
