import { useCallback, useEffect, useState } from 'react'
import { runsApi } from '../../api/runs'
import { EMPTY_QUEUE, type QueueEntry, type RunQueue } from '../../types/queue'

const POLL_MS = 3000

/**
 * The run queue, and what can be done to it.
 *
 * Schools run one at a time, so this is where you see what the crawl that is
 * going will be followed by, open any of them, and take a waiting school out or
 * change its place. It polls rather than using the run event stream, because a
 * waiting run has no stream of its own yet.
 */
export function QueuePanel({
  compact = false,
  onOpenRun,
}: {
  compact?: boolean
  onOpenRun?: (runId: string) => void
}) {
  const [queue, setQueue] = useState<RunQueue>(EMPTY_QUEUE)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

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

  const move = async (runId: string, direction: 'up' | 'down' | 'top') => {
    setBusyId(runId); setActionError('')
    try {
      setQueue(await runsApi.moveRun(runId, direction))
    } catch {
      setActionError('Could not move that item. It may have just started; the queue has been refreshed.')
      void refresh()
    } finally { setBusyId(null) }
  }

  const remove = async (runId: string) => {
    setBusyId(runId); setActionError(''); setConfirmId(null)
    try {
      await runsApi.cancelRun(runId)
    } catch {
      setActionError('Could not remove that item from the queue.')
    } finally {
      setBusyId(null)
      void refresh()
    }
  }

  if (!loaded) return <div className="empty-state">Loading the queue…</div>
  if (error && queue === EMPTY_QUEUE) return <div className="error-banner">{error}</div>

  const nothing = queue.running.length === 0 && queue.waiting.length === 0 && queue.stalled.length === 0
  if (nothing) {
    return <div className="empty-state">Nothing is running or waiting.</div>
  }

  const rowProps = { compact, onOpenRun, busyId, confirmId, setConfirmId, move, remove }
  return (
    <div className="queue-list">
      {error && <div className="error-banner">{error} Showing the last queue that loaded.</div>}
      {actionError && <div className="error-banner">{actionError}</div>}
      {queue.running.map((entry) => <QueueRow key={entry.run_id} entry={entry} state="running" {...rowProps} />)}
      {queue.waiting.map((entry, index) => (
        <QueueRow key={entry.run_id} entry={entry} state="waiting" first={index === 0} last={index === queue.waiting.length - 1} {...rowProps} />
      ))}
      {queue.stalled.map((entry) => <QueueRow key={entry.run_id} entry={entry} state="stalled" {...rowProps} />)}
    </div>
  )
}

const STATE_LABELS: Record<string, string> = {
  running: 'Running now',
  waiting: 'Waiting',
  stalled: 'Stalled',
}

function QueueRow({
  entry, state, compact, onOpenRun, busyId, confirmId, setConfirmId, move, remove, first, last,
}: {
  entry: QueueEntry
  state: 'running' | 'waiting' | 'stalled'
  compact: boolean
  onOpenRun?: (runId: string) => void
  busyId: string | null
  confirmId: string | null
  setConfirmId: (id: string | null) => void
  move: (runId: string, direction: 'up' | 'down' | 'top') => Promise<void>
  remove: (runId: string) => Promise<void>
  first?: boolean
  last?: boolean
}) {
  const name = entry.label || entry.sites.map((site) => site.domain).filter(Boolean).join(', ') || entry.run_id
  const people = entry.sites.reduce((total, site) => total + site.records_found, 0)
  // Verification passes use the same run stream as crawls and are therefore
  // openable from the queue for live status and activity.
  const verify = entry.kind === 'verify'
  const open = onOpenRun
  const busy = busyId === entry.run_id
  const confirming = confirmId === entry.run_id

  return (
    <div className={`queue-row ${state}`}>
      <div className="queue-position" aria-hidden={state !== 'waiting'}>
        {state === 'waiting' ? entry.position : '•'}
      </div>
      <div className="queue-body">
        <div className="queue-title">
          {open
            ? <button type="button" className="text-button queue-name" onClick={() => open(entry.run_id)}>{name}</button>
            : <strong>{name}</strong>}
          <span className={`status-badge ${state}`}>{STATE_LABELS[state]}</span>
        </div>
        <div className="queue-meta muted">
          {verify
            ? <>Verification{state === 'running' && entry.records_total
              ? ` · ${(entry.records_checked ?? 0).toLocaleString()} of ${entry.records_total.toLocaleString()} rows checked`
              : ''}</>
            : <>{Math.max(people, entry.records_found).toLocaleString()} people</>}
          {' · '}${entry.spend_usd.toFixed(2)}
          {entry.sites_total > 1 ? ` · ${entry.sites_completed}/${entry.sites_total} schools` : ''}
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
                  {site.records_found > 0 ? ` · ${site.records_found.toLocaleString()} people` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
        {state === 'waiting' && !compact && (
          <div className="queue-actions">
            {confirming ? (
              <>
                <span>Take “{name}” out of the queue?</span>
                <button className="secondary-button small-button" disabled={busy} onClick={() => void remove(entry.run_id)}>Yes, remove</button>
                <button className="secondary-button small-button" onClick={() => setConfirmId(null)}>Keep it</button>
              </>
            ) : (
              <>
                <button className="secondary-button small-button" disabled={busy || first} onClick={() => void move(entry.run_id, 'top')}>Run next</button>
                <button className="secondary-button small-button" disabled={busy || first} aria-label={`Move ${name} up`} onClick={() => void move(entry.run_id, 'up')}>↑</button>
                <button className="secondary-button small-button" disabled={busy || last} aria-label={`Move ${name} down`} onClick={() => void move(entry.run_id, 'down')}>↓</button>
                <button className="secondary-button small-button" disabled={busy} onClick={() => setConfirmId(entry.run_id)}>Remove</button>
              </>
            )}
          </div>
        )}
        {state === 'running' && verify && !compact && (
          <div className="queue-actions">
            {confirming ? (
              <>
                <span>Stop verification for “{name}”?</span>
                <button className="secondary-button small-button" disabled={busy} onClick={() => void remove(entry.run_id)}>Yes, stop</button>
                <button className="secondary-button small-button" onClick={() => setConfirmId(null)}>Keep running</button>
              </>
            ) : (
              <button className="secondary-button small-button" disabled={busy} onClick={() => setConfirmId(entry.run_id)}>Stop verification</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
