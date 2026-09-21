import { useCallback, useEffect, useState } from 'react'
import { runsApi } from '../../api/runs'
import { EMPTY_QUEUE, type QueueEntry, type RunQueue } from '../../types/queue'

const POLL_MS = 5000

/**
 * Live view of the run queue.
 *
 * Schools run one at a time, so this is the only place that shows what the
 * crawl that is going will be followed by. It polls rather than using the run
 * event stream, because a waiting run has no stream of its own yet.
 */
export function QueuePanel({ compact = false }: { compact?: boolean }) {
  const [queue, setQueue] = useState<RunQueue>(EMPTY_QUEUE)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setQueue(await runsApi.getQueue())
      setError('')
    } catch {
      setError('Could not load the queue.')
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    let stopped = false
    const tick = () => { if (!stopped) void refresh() }
    tick()
    const timer = window.setInterval(tick, POLL_MS)
    return () => { stopped = true; window.clearInterval(timer) }
  }, [refresh])

  if (!loaded) return <div className="empty-state">Loading the queue…</div>
  if (error) return <div className="error-banner">{error}</div>

  const nothing =
    queue.running.length === 0 && queue.waiting.length === 0 && queue.stalled.length === 0
  if (nothing) {
    return <div className="empty-state">Nothing is running and nothing is queued.</div>
  }

  return (
    <div className="queue-list">
      {queue.running.map((entry) => (
        <QueueRow key={entry.run_id} entry={entry} state="running" compact={compact} />
      ))}
      {queue.waiting.map((entry) => (
        <QueueRow key={entry.run_id} entry={entry} state="waiting" compact={compact} />
      ))}
      {queue.stalled.map((entry) => (
        <QueueRow key={entry.run_id} entry={entry} state="stalled" compact={compact} />
      ))}
    </div>
  )
}

const STATE_LABELS: Record<string, string> = {
  running: 'Running now',
  waiting: 'Waiting',
  stalled: 'Stalled',
}

function QueueRow({
  entry,
  state,
  compact,
}: {
  entry: QueueEntry
  state: 'running' | 'waiting' | 'stalled'
  compact: boolean
}) {
  const name =
    entry.label ??
    entry.sites.map((site) => site.domain).filter(Boolean).join(', ') ??
    entry.run_id
  const people = entry.sites.reduce((total, site) => total + site.records_found, 0)

  return (
    <div className={`queue-row ${state}`}>
      <div className="queue-position" aria-hidden={state !== 'waiting'}>
        {state === 'waiting' ? entry.position : '•'}
      </div>
      <div className="queue-body">
        <div className="queue-title">
          <strong>{name || entry.run_id}</strong>
          <span className={`status-badge ${state}`}>{STATE_LABELS[state]}</span>
        </div>
        <div className="queue-meta muted">
          {entry.sites_completed}/{entry.sites_total} schools
          {' · '}
          {Math.max(people, entry.records_found).toLocaleString()} people
          {' · '}${entry.spend_usd.toFixed(2)}
          {state === 'waiting' && entry.position === 1 ? ' · starts next' : ''}
        </div>
        {!compact && entry.sites.length > 0 && (
          <ul className="queue-sites">
            {entry.sites.map((site) => (
              <li key={site.site_id}>
                <span className="queue-site-domain">{site.domain ?? site.site_id}</span>
                <span className="muted">
                  {site.status}
                  {site.steps_taken > 0 ? ` · ${site.steps_taken.toLocaleString()} pages` : ''}
                  {site.records_found > 0
                    ? ` · ${site.records_found.toLocaleString()} people`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
