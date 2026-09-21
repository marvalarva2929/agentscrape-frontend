import { useEffect, useRef, useState } from 'react'
import { runStatusLabel, runsApi, type Connection, type SiteRunSnapshot } from '../api/runs'
import { isFinished } from '../api/runEvents'
import { AgentPanel } from '../components/run/AgentPanel'
import type { FeedItem, Run } from '../types/run'

const stageLabels: Record<string, string> = {
  discovering: 'Mapping the site',
  directory: 'Reading pages',
  finalizing: 'Finalizing records',
  complete: 'Completed',
}

const SITES_POLL_MS = 5000

export function RunMonitorPage({
  run,
  connection = 'live',
  onBack,
  onViewResults,
  onOpenQueue,
  onResume,
  onStop,
}: {
  run: Run
  /** Whether the live stream is delivering. Absent for a run that is over. */
  connection?: Connection
  onBack: () => void
  onViewResults?: () => void
  onOpenQueue?: () => void
  onResume?: () => void
  onStop?: () => Promise<void>
}) {
  const [siteRuns, setSiteRuns] = useState<SiteRunSnapshot[]>([])
  const [retryingSiteId, setRetryingSiteId] = useState<string | null>(null)
  const [retryError, setRetryError] = useState('')
  const [stopping, setStopping] = useState(false)
  const [confirmingStop, setConfirmingStop] = useState(false)
  const [stopError, setStopError] = useState('')
  const finished = isFinished(run.status)
  const waiting = run.status === 'queued'
  const elapsed = useElapsed(run.startedAt, run.finishedAt, run.elapsedSeconds, finished || waiting)
  const title = run.label ?? run.schoolName ?? 'Selected school'

  // Coming back to a crawl that is still going: make sure something is still
  // listening, so the feed keeps filling and the run reads as live again.
  useEffect(() => {
    if (!finished) onResume?.()
    // Re-check only when a different run is opened: re-running this on every
    // render would re-check the stream more often than it can change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.id])

  // Per-school status: the pages each agent has read and why a school failed.
  // Polled while the run is going, and once more when it ends.
  const runId = useRef(run.id)
  runId.current = run.id
  useEffect(() => {
    let cancelled = false
    const load = () => {
      void runsApi.getRunSites(run.id).then((sites) => {
        if (!cancelled && runId.current === run.id) setSiteRuns(sites)
      }).catch(() => undefined)
    }
    load()
    if (finished) return () => { cancelled = true }
    const timer = window.setInterval(load, SITES_POLL_MS)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [run.id, run.status, finished])

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
      setRetryError('Could not queue this school for another attempt. Please try again in a moment.')
    } finally {
      setRetryingSiteId(null)
    }
  }

  const stopCrawl = async () => {
    if (!onStop) return
    setStopping(true)
    setStopError('')
    setConfirmingStop(false)
    try {
      await onStop()
    } catch {
      setStopError(waiting ? 'Could not remove this crawl from the queue. Please try again.' : 'Could not stop the crawl. Please try again.')
    } finally {
      setStopping(false)
    }
  }

  const failedSites = siteRuns.filter((site) => site.status === 'failed' || site.status === 'rejected')
  const emptySites = siteRuns.filter((site) => site.status === 'completed' && (site.records_found ?? 0) === 0 && site.error_code?.startsWith('NO_'))
  const noPeople = finished && !run.errorMessage && failedSites.length === 0 && (run.counts?.peopleFound ?? 0) === 0

  return (
    <main className="page-shell">
      <div className="monitor-header">
        <div>
          <h2>{finished ? 'Crawl finished' : waiting ? 'Waiting to start' : 'Crawling'} · {title}</h2>
        </div>
        <div className="monitor-actions">
          {!finished && onStop && (confirmingStop ? (
            <>
              <span className="confirm-text">{waiting ? 'Take it out of the queue?' : 'Stop this crawl? What it has found is kept.'}</span>
              <button className="secondary-button danger" disabled={stopping} onClick={() => void stopCrawl()}>{waiting ? 'Yes, remove' : 'Yes, stop'}</button>
              <button className="secondary-button" onClick={() => setConfirmingStop(false)}>{waiting ? 'Keep it' : 'Keep going'}</button>
            </>
          ) : (
            <button className="secondary-button" disabled={stopping} onClick={() => setConfirmingStop(true)}>
              {stopping ? 'Working…' : waiting ? 'Remove from queue' : 'Stop Crawl'}
            </button>
          ))}
          {onOpenQueue && <button className="secondary-button" onClick={onOpenQueue}>Running crawls</button>}
          <button className="secondary-button" onClick={onBack}>← Home</button>
        </div>
      </div>

      {waiting && (
        <div className="waiting-panel" role="status">
          <strong>{run.queuePosition ? `Waiting — #${run.queuePosition} in the queue` : 'Waiting for its turn'}</strong>
        </div>
      )}

      {!finished && <ConnectionNotice connection={connection} />}

      <div className="progress-strip">
        <div><span>Status</span><strong>{runStatusLabel(run)}</strong></div>
        <div><span>Elapsed</span><strong>{waiting ? '—' : formatDuration(elapsed)}</strong></div>
        <div><span>Model spend</span><strong>{formatUsd(run.spendUsd)}{run.maxSpendUsd ? ` of ${formatUsd(run.maxSpendUsd)}` : ''}</strong></div>
        <div><span>Tokens in / out</span><strong>{formatTokens(run.tokensIn)} / {formatTokens(run.tokensOut)}</strong></div>
        <div><span>People found</span><strong>{run.counts?.peopleFound ?? 0}</strong></div>
        <div><span>Residents &amp; fellows</span><strong>{run.traineesFound ?? 0}</strong></div>
        <div><span>With an email</span><strong>{run.counts?.emailsFound ?? 0}</strong></div>
        <div><span>Pages read</span><strong>{run.pagesRead ?? 0}{run.stepBudget ? ` / ${run.stepBudget}` : ''}</strong></div>
        <div><span>Schools</span><strong>{run.sitesCompleted ?? 0}/{run.sitesTotal ?? 0} complete</strong></div>
        <div><span>Failed</span><strong>{run.sitesFailed ?? 0}</strong></div>
        <div>
          <span>Programs covered</span>
          <strong>{run.programsTotal ? `${run.programsCovered ?? 0} / ${run.programsTotal}` : '—'}</strong>
        </div>
        <div><span>Operation</span><strong>{run.runType ?? 'Crawl'}</strong></div>
      </div>

      {failedSites.map((site) => (
        <div key={site.id} className="error-banner">
          <span>
            <strong>{site.hospital ?? site.domain ?? 'A school'}</strong> could not be crawled:{' '}
            {site.error_message ?? 'no reason was recorded.'}
          </span>
          <button className="secondary-button small-button" disabled={retryingSiteId === site.site_id} onClick={() => void retrySite(site)}>
            {retryingSiteId === site.site_id ? 'Queuing…' : 'Try again'}
          </button>
        </div>
      ))}
      {emptySites.map((site) => (
        <div key={site.id} className="connection-notice" role="status">
          <strong>{site.hospital ?? site.domain ?? 'A school'}</strong>: {site.error_message}
        </div>
      ))}
      {run.status === 'failed' && run.errorMessage && failedSites.length === 0 && <div className="error-banner">The crawl failed: {run.errorMessage}</div>}
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
            {run.status === 'failed' || run.errorMessage ? 'Crawl stopped early — results so far are saved' : 'Crawl complete'}
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
          {noPeople && <p className="feed-error-note">No people were found on this school.</p>}
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

      {!waiting && <AgentPanel agents={run.agents ?? []} finished={finished} />}

      {siteRuns.length > 0 && (
        <section className="sites-panel" aria-label="Schools in this crawl">
          <div className="activity-feed-header"><h3>Schools</h3></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>School</th><th>Status</th><th>Pages</th><th>Programs</th><th>People</th><th>Note</th></tr></thead>
              <tbody>
                {siteRuns.map((site) => (
                  <tr key={site.id}>
                    <td>{site.hospital ?? site.domain ?? site.site_id}</td>
                    <td><span className={`status-badge ${site.status}`}>{site.status}</span></td>
                    <td>{site.steps_taken ? `${site.steps_taken.toLocaleString()}${site.step_budget ? ` / ${site.step_budget.toLocaleString()}` : ''}` : '—'}</td>
                    <td>{site.coverage?.programs_total ? `${site.coverage.programs_covered ?? 0} / ${site.coverage.programs_total}` : '—'}</td>
                    <td>{(site.records_found ?? 0).toLocaleString()}</td>
                    <td>{site.error_message ?? (site.agent_id && site.status === 'running' ? site.agent_id : '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="activity-feed" aria-live="polite">
        <div className="activity-feed-header">
          <h3>Activity</h3>
          {!finished && !waiting && connection === 'live' && <span className="live-dot">Live</span>}
        </div>
        {(run.feed ?? []).length === 0 ? (
          <p className="activity-empty">
            {finished ? 'No activity was recorded.' : waiting ? 'Not started yet.' : 'Starting…'}
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

function ConnectionNotice({ connection }: { connection: Connection }) {
  if (connection === 'live') return null
  const text = connection === 'connecting'
    ? 'Connecting…'
    : connection === 'reconnecting'
      ? 'Connection lost. Reconnecting…'
      : 'No updates for a while. Still trying…'
  return <div className="connection-notice" role="status">{text}</div>
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

function formatTokens(value?: number) {
  if (value === undefined || value === null) return '—'
  return value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value)
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}
