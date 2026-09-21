import { useEffect, useState } from 'react'
import { runsApi } from '../api/runs'
import type { Run } from '../types/run'

/**
 * Crawls take minutes, and there are no notifications, so this is how someone
 * leaves and comes back to find what happened.
 */
export function PastCrawlsPage({
  onBack,
  onOpenRun,
}: {
  onBack: () => void
  onOpenRun: (runId: string) => void
}) {
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        setRuns(await runsApi.listRuns())
      } catch {
        setError('Could not load past crawls.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  return (
    <main className="page-shell">
      <div className="page-header-row">
        <div>
          <div className="breadcrumb">Crawls</div>
          <h2>Past Crawls</h2>
        </div>
        <button className="secondary-button" onClick={onBack}>Back</button>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}
      {loading ? <div className="muted">Loading…</div> : null}
      {!loading && runs.length === 0 && !error ? (
        <div className="muted">Nothing has been crawled yet.</div>
      ) : null}

      {runs.length > 0 ? (
        <div className="table-panel">
          <table>
            <thead>
              <tr>
                <th>Started</th>
                <th>School</th>
                <th>Status</th>
                <th>People found</th>
                <th>New</th>
                <th>Missing</th>
                <th>Spend</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr
                  key={run.id}
                  className="clickable-row"
                  onClick={() => onOpenRun(run.id)}
                >
                  <td>{formatDateTime(run.startedAt)}</td>
                  <td>{run.schoolName ?? 'School crawl'}</td>
                  <td>
                    <span className="status-pill">
                      {run.stoppedAtLimit ? 'stopped at budget' : run.status}
                    </span>
                  </td>
                  <td>{run.counts?.peopleFound ?? 0}</td>
                  <td>{run.counts?.newCount ?? 0}</td>
                  <td>{run.counts?.missingCount ?? 0}</td>
                  <td>{run.spendUsd != null ? `$${run.spendUsd.toFixed(2)}` : '—'}</td>
                  <td>{formatDuration(run.elapsedSeconds ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  )
}

function formatDateTime(value?: string) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function formatDuration(seconds: number) {
  if (!seconds) return '—'
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`
}
