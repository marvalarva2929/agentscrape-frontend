import { useEffect, useMemo, useState } from 'react'
import { runStatusLabel, runsApi } from '../api/runs'
import type { Run } from '../types/run'
import { downloadWorkbook } from '../utils/excel'

export function PastCrawlsPage({
  onBack,
  onOpenRun,
  activeRun,
}: {
  onBack: () => void
  onOpenRun: (runId: string) => void
  /** A just-started crawl must be visible before the next history API refresh. */
  activeRun?: Run | null
}) {
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const visibleRuns = useMemo(() => {
    if (!activeRun) return runs
    const matchingHistory = runs.find((run) => run.id === activeRun.id)
    const current = matchingHistory ? { ...matchingHistory, ...activeRun } : activeRun
    return [current, ...runs.filter((run) => run.id !== activeRun.id)]
  }, [activeRun, runs])
  const load = async () => {
    try { setRuns(await runsApi.listRuns()); setError('') } catch { setError('Could not load crawl history.') } finally { setLoading(false) }
  }
  useEffect(() => { void load(); const timer = window.setInterval(() => { void load() }, 5000); return () => window.clearInterval(timer) }, [])
  const exportRows = () => {
    setExporting(true)
    try {
      downloadWorkbook('Past Crawls', [
        { label: 'Started', value: (run: Run) => run.startedAt }, { label: 'Completed', value: (run: Run) => run.finishedAt },
        { label: 'Operation', value: (run: Run) => run.runType ?? 'Crawl' }, { label: 'Status', value: (run: Run) => labelStatus(run) },
        { label: 'People found', value: (run: Run) => run.counts?.peopleFound }, { label: 'New', value: (run: Run) => run.counts?.newCount },
        { label: 'Changed', value: (run: Run) => run.counts?.changedCount }, { label: 'Missing', value: (run: Run) => run.counts?.missingCount },
        { label: 'Spend USD', value: (run: Run) => run.spendUsd }, { label: 'Duration seconds', value: (run: Run) => run.elapsedSeconds },
      ], visibleRuns, 'past-crawls.xlsx')
    } catch { setError('Could not create the Excel workbook. Please try again.') } finally { setExporting(false) }
  }
  return <main className="page-shell"><div className="page-header-row"><div><div className="breadcrumb">Crawls</div><h2>Past Crawls</h2></div><div className="modal-actions"><button className="secondary-button" disabled={exporting} onClick={exportRows}>{exporting ? 'Preparing Excel…' : 'Download Excel'}</button><button className="secondary-button" onClick={onBack}>Back</button></div></div>{error && <div className="error-banner">{error}</div>}{loading && <div className="muted">Loading…</div>}{!loading && !visibleRuns.length && !error && <div className="muted">Nothing has been crawled yet.</div>}{visibleRuns.length > 0 && <div className="table-panel"><div className="table-wrap"><table><thead><tr><th>Started</th><th>Completed</th><th>Operation</th><th>Status</th><th>People found</th><th>New</th><th>Changed</th><th>Missing</th><th>Spend</th><th>Duration</th></tr></thead><tbody>{visibleRuns.map((run) => <tr key={run.id} className="clickable-row" onClick={() => onOpenRun(run.id)}><td>{formatDateTime(run.startedAt)}</td><td>{formatDateTime(run.finishedAt)}</td><td>{run.runType ?? 'Crawl'}</td><td><span className="status-pill">{labelStatus(run)}</span></td><td>{run.counts?.peopleFound ?? 0}</td><td>{run.counts?.newCount ?? 0}</td><td>{run.counts?.changedCount ?? 0}</td><td>{run.counts?.missingCount ?? 0}</td><td>{run.spendUsd == null ? '—' : `$${run.spendUsd.toFixed(2)}`}</td><td>{formatDuration(run.elapsedSeconds ?? 0)}</td></tr>)}</tbody></table></div></div>}</main>
}
function labelStatus(run: Run) { return runStatusLabel(run) }
function formatDateTime(value?: string) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString() }
function formatDuration(seconds: number) { if (!seconds) return '—'; const minutes = Math.floor(seconds / 60); return minutes ? `${minutes}m ${seconds % 60}s` : `${seconds}s` }
