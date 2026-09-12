export function RunStageIndicator({ stage }: { stage?: string }) {
  return <div className="stage-chip active">{stage ?? 'Queued'}</div>
}
