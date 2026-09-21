import type { Run } from '../types/run'

export function RunMonitorPage({
  run,
  onBack,
  onViewResults,
}: {
  run: Run
  onBack: () => void
  onViewResults?: () => void
}) {
  const stageLabels: Record<string, string> = {
    discovering: 'Discovering People',
    directory: 'Directory Enrichment',
    finalizing: 'Finalizing Records',
    complete: 'Completed',
    queued: 'Queued',
    failed: 'Failed',
    cancelled: 'Cancelled',
  }

  return (
    <main className="page-shell">
      <div className="monitor-header">
        <div>
          <div className="breadcrumb">Crawls / {run.schoolName ?? 'School'}</div>
          <h2>Updating {run.schoolName ?? run.programName ?? 'School'}</h2>
        </div>
        <div className="monitor-actions">
          <button className="secondary-button" onClick={onBack}>Cancel</button>
        </div>
      </div>

      <div className="progress-strip">
        <div><span>Status</span><strong>{run.status}</strong></div>
        <div><span>Elapsed</span><strong>{formatDuration(run.elapsedSeconds ?? 0)}</strong></div>
        <div><span>Overall Progress</span><strong>{run.progress ?? 0}%</strong></div>
        <div><span>People Found</span><strong>{run.counts?.peopleFound ?? 0}</strong></div>
        <div><span>People Enriched</span><strong>{run.counts?.peopleEnriched ?? 0}</strong></div>
        <div><span>Emails Found</span><strong>{run.counts?.emailsFound ?? 0}</strong></div>
        <div><span>Failures / Warnings</span><strong>{run.warnings ?? 0}</strong></div>
        <div><span>Live spend</span><strong>${(run.spendUsd ?? 0).toFixed(4)}</strong></div>
      </div>

      <section className="card activity-log">
        <h3>Agent action log</h3>
        {(run.agentActivity?.length ?? 0) === 0 ? <div className="muted">Waiting for the crawler to report its first action.</div> : (
          <ol className="activity-list">
            {run.agentActivity?.map((activity) => (
              <li key={`${activity.id}-${activity.timestamp ?? activity.currentAction}`}>
                <strong>{activity.schoolName ?? run.schoolName ?? 'School'}</strong>{' — '}{activity.currentAction ?? 'Working'}
                {activity.currentPage ? <div className="muted">{activity.currentPage}</div> : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="stage-bar">
        {Object.entries(stageLabels).map(([key, label]) => (
          <div key={key} className={`stage-chip ${run.stage === key ? 'active' : ''}`}>
            {label}
          </div>
        ))}
      </div>

      {(run.progress ?? 0) >= 100 && (
        <div className="success-panel">
          <div className="success-header">Update complete</div>
          <div className="result-grid">
            <div><span>Total Found</span><strong>{run.counts?.peopleFound ?? 0}</strong></div>
            <div><span>New</span><strong>{run.counts?.newCount ?? 0}</strong></div>
            <div><span>Changed</span><strong>{run.counts?.changedCount ?? 0}</strong></div>
            <div><span>Missing</span><strong>{run.counts?.missingCount ?? 0}</strong></div>
            <div><span>Emails Found</span><strong>{run.counts?.emailsFound ?? 0}</strong></div>
          </div>
          <div className="modal-actions">
            {onViewResults ? (
              <button className="primary-button" onClick={onViewResults}>View Results</button>
            ) : (
              <button className="primary-button" onClick={onBack}>View Program</button>
            )}
          </div>
        </div>
      )}
    </main>
  )
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
