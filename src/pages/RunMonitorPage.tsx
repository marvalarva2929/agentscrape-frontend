import { useEffect, useState } from 'react'
import { runStatusLabel, runsApi, type SiteRunSnapshot } from '../api/runs'
import type { FeedItem, Run } from '../types/run'

const stageLabels: Record<string, string> = {
  discovering: 'Mapping the site',
  directory: 'Reading pages',
  finalizing: 'Finalizing records',
  complete: 'Completed',
}

export function RunMonitorPage({
  run,
  onBack,
  onViewResults,
  onResume,
  onStop,
}: {
  run: Run
  onBack: () => void
  onViewResults?: () => void
  onResume?: () => void
  onStop?: () => Promise<void>
}) {
  const [siteRuns, setSiteRuns] = useState<SiteRunSnapshot[]>([])
  const [retryingSiteId, setRetryingSiteId] = useState<string | null>(null)
  const [retryError, setRetryError] = useState('')
  const [stopping, setStopping] = useState(false)
  const [stopError, setStopError] = useState('')
  const finished = ['completed', 'failed', 'cancelled'].includes(run.status)
  const elapsed = useElapsed(run.startedAt, run.finishedAt, run.elapsedSeconds, finished)

  // Coming back to a crawl that is still going: make sure something is still
  // listening, so the feed keeps filling and the run reads as live again.
  useEffect(() => {
    if (!finished) onResume?.()
    // Mount only: re-running this on every render would re-check the stream
    // more often than it can change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false
    void runsApi.getRunSites(run.id).then((sites) => {
      if (!cancelled) setSiteRuns(sites)
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [run.id, run.status])

  const retrySite = async (site: SiteRunSnapshot) => {
    setRetryingSiteId(site.site_id)
    setRetryError('')
    try {
      await runsApi.retrySite(run.id, site.site_id)
      setSiteRuns((current) => current.map((item) => item.site_id === site.site_id
        ? { ...item, status: 'pending', error_code: null, error_message: null }
        : item))
      onResume?.()
    } catch {
      setRetryError('Could not queue this site for another attempt. Please try again later.')
    } finally {
      setRetryingSiteId(null)
    }
  }

  const stopCrawl = async () => {
    if (!onStop) return
    setStopping(true)
    setStopError('')
    try {
      await onStop()
    } catch {
      setStopError('Could not stop the crawl. Please try again.')
    } finally {
      setStopping(false)
    }
  }

  const blockedSites = siteRuns.filter((site) => site.error_code === 'SITE_BLOCKED' || site.error_code === 'SITE_RATE_LIMITED')

  return (
    <main className="page-shell">
      <div className="monitor-header">
        <div>
          <div className="breadcrumb">Schools / {run.schoolName ?? 'Selected school'}</div>
          <h2>{finished ? 'Crawl finished' : 'Crawling'} {run.schoolName ?? 'Selected school'}</h2>
        </div>
        <div className="monitor-actions">
          {!finished && <button className="secondary-button" disabled={stopping} onClick={() => void stopCrawl()}>{stopping ? 'Stopping…' : 'Stop Crawl'}</button>}
          <button className="secondary-button" onClick={onBack}>{finished ? 'Back' : 'Leave'}</button>
        </div>
      </div>

      <div className="progress-strip">
        <div><span>Status</span><strong>{runStatusLabel(run)}</strong></div>
        <div><span>Operation</span><strong>{run.runType ?? 'Crawl'}</strong></div>
        <div><span>Stage</span><strong>{run.stage ?? 'queued'}</strong></div>
        <div><span>Elapsed</span><strong>{formatDuration(elapsed)}</strong></div>
        <div><span>Pages read</span><strong>{run.pagesRead ?? 0}</strong></div>
        <div><span>Page budget</span><strong>{run.stepBudget ? `${run.pagesRead ?? 0} / ${run.stepBudget}` : 'â€”'}</strong></div>
        <div><span>People found</span><strong>{run.counts?.peopleFound ?? 0}</strong></div>
        <div><span>Sites</span><strong>{run.sitesCompleted ?? 0}/{run.sitesTotal ?? 0} complete</strong></div>
        <div><span>Skipped / failed</span><strong>{run.sitesSkipped ?? 0} / {run.sitesFailed ?? 0}</strong></div>
        <div><span>Residents &amp; fellows</span><strong>{run.traineesFound ?? 0}</strong></div>
        <div>
          <span>Programs covered</span>
          <strong>
            {run.programsTotal ? `${run.programsCovered ?? 0} / ${run.programsTotal}` : '—'}
          </strong>
        </div>
        <div><span>Model spend</span><strong>{formatUsd(run.spendUsd)}</strong></div>
      </div>

      {!finished && <p className="muted">This crawl ends when it reaches the page budget, runs out of worthwhile links, has 150 pages in a row with no people, or reaches a configured spend limit.</p>}

      {blockedSites.map((site) => (
        <div key={site.id} className="error-banner">
          <span>{site.error_message ?? `Site could not be crawled (${site.domain ?? 'unknown site'}).`}</span>
          <button className="secondary-button small-button" disabled={retryingSiteId === site.site_id} onClick={() => void retrySite(site)}>
            {retryingSiteId === site.site_id ? 'Queuing…' : 'Try again later'}
          </button>
        </div>
      ))}
      {retryError && <div className="error-banner">{retryError}</div>}
      {stopError && <div className="error-banner">{stopError}</div>}

      <div className="stage-bar">
        {Object.entries(stageLabels).map(([key, label]) => (
          <div key={key} className={`stage-chip ${run.stage === key ? 'active' : ''}`}>
            {label}
          </div>
        ))}
      </div>

      {finished && (
        <div className="success-panel">
          <div className="success-header">
            {run.errorMessage ? 'Crawl stopped early — results so far are saved' : 'Crawl complete'}
          </div>
          <div className="result-grid">
            <div><span>People found</span><strong>{run.counts?.peopleFound ?? 0}</strong></div>
            <div><span>Residents &amp; fellows</span><strong>{run.traineesFound ?? 0}</strong></div>
            <div><span>New</span><strong>{run.counts?.newCount ?? 0}</strong></div>
            <div><span>Changed</span><strong>{run.counts?.changedCount ?? 0}</strong></div>
            <div><span>Pages read</span><strong>{run.pagesRead ?? 0}</strong></div>
            <div><span>Time</span><strong>{formatDuration(elapsed)}</strong></div>
            <div><span>Model spend</span><strong>{formatUsd(run.spendUsd)}</strong></div>
          </div>
          {run.errorMessage && <p className="feed-error-note">{run.errorMessage}</p>}
          <div className="modal-actions">
            {onViewResults ? (
              <button className="primary-button" onClick={onViewResults}>View Results</button>
            ) : (
              <button className="primary-button" onClick={onBack}>View School</button>
            )}
          </div>
        </div>
      )}

      <section className="activity-feed" aria-live="polite">
        <div className="activity-feed-header">
          <h3>Agent activity</h3>
          {!finished && <span className="live-dot">Live</span>}
        </div>
        {(run.feed ?? []).length === 0 ? (
          <p className="activity-empty">
            {finished ? 'No activity was recorded for this run.' : 'Waiting for the agent to start…'}
          </p>
        ) : (
          <ol className="activity-list">
            {(run.feed ?? []).map((item) => (
              <FeedRow key={item.id} item={item} />
            ))}
          </ol>
        )}
      </section>
    </main>
  )
}

function FeedRow({ item }: { item: FeedItem }) {
  const time = new Date(item.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const found = (item.records ?? 0) > 0
  return (
    <li className={`activity-item ${item.kind} ${found ? 'found' : ''}`}>
      <time>{time}</time>
      <div className="activity-body">
        <span>{item.message}</span>
        {item.url && (
          <a href={item.url} target="_blank" rel="noreferrer" className="activity-url">
            {item.url}
          </a>
        )}
      </div>
      {found && <strong className="activity-count">+{item.records}</strong>}
    </li>
  )
}

function useElapsed(startedAt?: string, finishedAt?: string, fallback = 0, stopped = false) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (stopped) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [stopped])
  if (!startedAt) return fallback
  const end = finishedAt ? Date.parse(finishedAt) : now
  return Math.max(0, Math.round((end - Date.parse(startedAt)) / 1000))
}

function formatUsd(value?: number) {
  if (value === undefined || value === null) return '—'
  return `$${value.toFixed(value < 1 ? 3 : 2)}`
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}
