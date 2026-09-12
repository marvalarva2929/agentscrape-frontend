import { useEffect, useState } from 'react'
import { DirectoryDashGame } from '../components/game/DirectoryDashGame'
import type { Run } from '../types/run'

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

  const stageLabels: Record<string, string> = {
    discovering: 'Discovering People',
    directory: 'Directory Enrichment',
    finalizing: 'Finalizing Records',
    complete: 'Completed',
    queued: 'Queued',
    failed: 'Failed',
    cancelled: 'Cancelled',
  }

  useEffect(() => {
    if (run.progress && run.progress >= 100) {
      onStartGame()
    }
  }, [run, onStartGame])

  return (
    <main className="page-shell">
      <div className="monitor-header">
        <div>
          <div className="breadcrumb">Programs / {run.programName ?? 'Program'}</div>
          <h2>Updating {run.programName ?? 'Program'}</h2>
        </div>
        <div className="monitor-actions">
          <button className="secondary-button" onClick={() => setShowGame(true)}>Play While You Wait</button>
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
      </div>

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

      {showGame && (
        <DirectoryDashGame
          programName={run.programName ?? 'Program'}
          status={run.stage ?? 'discovering'}
          peopleFound={run.counts?.peopleFound ?? 0}
          emailsFound={run.counts?.emailsFound ?? 0}
          onClose={() => setShowGame(false)}
          runFinished={(run.progress ?? 0) >= 100}
        />
      )}
    </main>
  )
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
