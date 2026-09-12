import type { Run } from '../../types/run'

const stageLabels: Record<string, string> = {
  discovering: 'Discovering People',
  directory: 'Directory Enrichment',
  finalizing: 'Finalizing Records',
  complete: 'Completed',
  queued: 'Queued',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

export function RunProgress({ run }: { run: Run }) {
  const elapsed = run.elapsedSeconds ?? 0
  const progress = run.progress ?? 0

  return (
    <>
      <div className="progress-strip">
        <div><span>Status</span><strong>{run.status}</strong></div>
        <div><span>Elapsed</span><strong>{formatDuration(elapsed)}</strong></div>
        <div><span>Overall Progress</span><strong>{progress}%</strong></div>
        <div><span>People Found</span><strong>{run.counts?.peopleFound ?? 0}</strong></div>
        <div><span>People Enriched</span><strong>{run.counts?.peopleEnriched ?? 0}</strong></div>
        <div><span>Emails Found</span><strong>{run.counts?.emailsFound ?? 0}</strong></div>
        <div><span>Warnings</span><strong>{run.warnings ?? 0}</strong></div>
      </div>

      <div className="stage-bar">
        {Object.entries(stageLabels).map(([key, label]) => (
          <div key={key} className={`stage-chip ${run.stage === key ? 'active' : ''}`}>
            {label}
          </div>
        ))}
      </div>
    </>
  )
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
