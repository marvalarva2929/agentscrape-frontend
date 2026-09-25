import { useEffect, useMemo, useState } from 'react'
import { mergeRun, runStatusLabel, runsApi } from '../api/runs'
import { peopleApi } from '../api/people'
import type { Run } from '../types/run'
import { crawlName } from '../utils/crawlName'
import { downloadWorkbook } from '../utils/excel'

export function PastCrawlsPage({
  onBack,
  onOpenRun,
  activeRun,
}: {
  onBack: () => void
  onOpenRun: (runId: string) => void
  /** The crawl being watched: its stream-only figures show before the next history refresh. */
  activeRun?: Run | null
}) {
  const [query, setQuery] = useState('')
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [retryingVerificationId, setRetryingVerificationId] = useState<string | null>(null)

  const visibleRuns = useMemo(() => {
    if (!activeRun || query.trim()) return runs
    const fromServer = runs.find((run) => run.id === activeRun.id)
    // The server's row is the settled truth for status, name and totals; what
    // the stream added on top (live figures) is kept, never the other way round.
    // A watched run that has not reached the history yet is shown as it is.
    const current = fromServer ? mergeRun(activeRun, fromServer) : activeRun
    return [current, ...runs.filter((run) => run.id !== activeRun.id)]
  }, [activeRun, runs, query])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setRuns([])
    const load = async () => {
      try {
        const rows = await runsApi.listRuns(Infinity, query)
        if (!cancelled) { setRuns(rows); setError('') }
      } catch {
        if (!cancelled) setError('Could not load crawl history.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    const debounce = window.setTimeout(() => { void load() }, 250)
    const timer = window.setInterval(() => { if (document.visibilityState !== 'hidden') void load() }, 5000)
    return () => { cancelled = true; window.clearTimeout(debounce); window.clearInterval(timer) }
  }, [query])

  const exportRows = () => {
    setExporting(true)
    try {
      downloadWorkbook('Past Crawls', [
        { label: 'Name', value: (run: Run) => crawlName(run) }, { label: 'School', value: (run: Run) => run.schoolName },
        { label: 'Started', value: (run: Run) => run.startedAt }, { label: 'Completed', value: (run: Run) => run.finishedAt },
        { label: 'Operation', value: (run: Run) => run.runType ?? 'Crawl' }, { label: 'Status', value: (run: Run) => runStatusLabel(run) },
        { label: 'People found', value: (run: Run) => run.counts?.peopleFound }, { label: 'New', value: (run: Run) => run.counts?.newCount },
        { label: 'Changed', value: (run: Run) => run.counts?.changedCount }, { label: 'Missing', value: (run: Run) => run.counts?.missingCount },
        { label: 'Spend USD', value: (run: Run) => run.spendUsd }, { label: 'Duration seconds', value: (run: Run) => run.elapsedSeconds },
      ], visibleRuns, 'past-crawls.xlsx')
    } catch { setError('Could not create the Excel workbook. Please try again.') } finally { setExporting(false) }
  }

  const retryVerification = async (run: Run) => {
    if (!run.verificationJobId) return
    setRetryingVerificationId(run.verificationJobId)
    try {
      const job = await peopleApi.resumeVerification(run.verificationJobId)
      if (job.runId) onOpenRun(job.runId)
      else setError('Verification was queued, but its run could not be opened.')
    } catch {
      setError('Could not retry this verification. It may already be fully verified.')
    } finally {
      setRetryingVerificationId(null)
    }
  }

  return (
    <main className="page-shell">
      <div className="page-header-row">
        <h2>Past Crawls</h2>
        <div className="modal-actions">
          <button className="secondary-button" disabled={exporting || visibleRuns.length === 0} onClick={exportRows}>{exporting ? 'Preparing Excel…' : 'Download Excel'}</button>
          <button className="secondary-button" onClick={onBack}>← Past data</button>
        </div>
      </div>
      <div className="table-controls">
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
          placeholder="Search crawl name, school, domain or run ID" aria-label="Search crawls" />
      </div>
      {error && <div className="error-banner">{error}</div>}
      {loading && <div className="muted">Loading…</div>}
      {!loading && !visibleRuns.length && !error && <div className="empty-state">{query.trim() ? 'No crawls match your search.' : 'Nothing has been crawled yet.'}</div>}
      {visibleRuns.length > 0 && (
        <div className="table-panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Name</th><th>Started</th><th>Completed</th><th>Operation</th><th>Status</th><th>People found</th><th>New</th><th>Changed</th><th>Missing</th><th>Spend</th><th>Duration</th><th>Action</th></tr>
              </thead>
              <tbody>
                {visibleRuns.map((run) => (
                  <tr key={run.id} className="clickable-row" onClick={() => onOpenRun(run.id)}>
                    <td className="crawl-name">
                      <strong>{crawlName(run)}</strong>
                      {run.schoolName && run.schoolName !== crawlName(run) && <span className="muted"> {run.schoolName}</span>}
                    </td>
                    <td>{formatDateTime(run.startedAt)}</td>
                    <td>{formatDateTime(run.finishedAt)}</td>
                    <td>{run.runType ?? 'Crawl'}</td>
                    <td><span className="status-pill">{runStatusLabel(run)}</span></td>
                    <td>{run.counts?.peopleFound ?? 0}</td>
                    <td>{run.counts?.newCount ?? 0}</td>
                    <td>{run.counts?.changedCount ?? 0}</td>
                    <td>{run.counts?.missingCount ?? 0}</td>
                    <td>{run.spendUsd == null ? '—' : `$${run.spendUsd.toFixed(2)}`}</td>
                    <td>{formatDuration(run.elapsedSeconds ?? 0)}</td>
                    <td>
                      {run.verificationJobId ? (
                        <button className="secondary-button small-button" disabled={retryingVerificationId === run.verificationJobId}
                          onClick={(event) => { event.stopPropagation(); void retryVerification(run) }}>
                          {retryingVerificationId === run.verificationJobId ? 'Queuing…' : 'Retry unverified'}
                        </button>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  )
}

function formatDateTime(value?: string) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString() }
function formatDuration(seconds: number) { if (!seconds) return '—'; const minutes = Math.floor(seconds / 60); return minutes ? `${minutes}m ${seconds % 60}s` : `${seconds}s` }
