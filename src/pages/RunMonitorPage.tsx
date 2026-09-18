import { useEffect, useState } from 'react'
import { DirectoryDashGame } from '../components/game/DirectoryDashGame'
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
  onStartGame,
  onViewResults,
}: {
  run: Run
  onBack: () => void
  onStartGame: () => void
  onViewResults?: () => void
}) {
  const [showGame, setShowGame] = useState(false)
  const finished = ['completed', 'failed', 'cancelled'].includes(run.status)
  const elapsed = useElapsed(run.startedAt, run.finishedAt, run.elapsedSeconds, finished)

  useEffect(() => {
    if (finished) {
      onStartGame()
    }
  }, [finished, onStartGame])

  return (
    <main className="page-shell">
      <div className="monitor-header">
        <div>
          <div className="breadcrumb">Schools / {run.schoolName ?? 'Selected school'}</div>
          <h2>{finished ? 'Crawl finished' : 'Crawling'} {run.schoolName ?? 'Selected school'}</h2>
        </div>
        <div className="monitor-actions">
          <button className="secondary-button" onClick={() => setShowGame(true)}>Play While You Wait</button>
          <button className="secondary-button" onClick={onBack}>{finished ? 'Back' : 'Leave'}</button>
        </div>
      </div>

      <div className="progress-strip">
        <div><span>Status</span><strong>{run.stoppedAtLimit ? 'stopped at limit' : run.status}</strong></div>
        <div><span>Operation</span><strong>{run.runType ?? 'Crawl'}</strong></div>
        <div><span>Stage</span><strong>{run.stage ?? 'queued'}</strong></div>
        <div><span>Elapsed</span><strong>{formatDuration(elapsed)}</strong></div>
        <div><span>Pages read</span><strong>{run.pagesRead ?? 0}</strong></div>
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

      {showGame && (
        <DirectoryDashGame
          schoolName={run.schoolName ?? 'Selected school'}
          status={run.stage ?? 'discovering'}
          peopleFound={run.counts?.peopleFound ?? 0}
          emailsFound={run.counts?.emailsFound ?? 0}
          onClose={() => setShowGame(false)}
          runFinished={finished}
        />
      )}
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
