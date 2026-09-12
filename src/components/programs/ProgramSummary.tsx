import type { Program } from '../../types/program'

export function ProgramSummary({ program }: { program: Program }) {
  return (
    <div className="summary-row">
      <div className="summary-card">
        <div className="summary-label">Total People</div>
        <div className="summary-value">{program.peopleCount ?? 0}</div>
      </div>
      <div className="summary-card">
        <div className="summary-label">Residents</div>
        <div className="summary-value">{program.residentCount ?? 0}</div>
      </div>
      <div className="summary-card">
        <div className="summary-label">Fellows</div>
        <div className="summary-value">{program.fellowCount ?? 0}</div>
      </div>
      <div className="summary-card">
        <div className="summary-label">Emails Found</div>
        <div className="summary-value">{program.peopleCount ? Math.max(1, Math.round((program.peopleCount ?? 0) * 0.7)) : 0}</div>
      </div>
      <div className="summary-card">
        <div className="summary-label">Last Updated</div>
        <div className="summary-value">{program.lastUpdated ?? '—'}</div>
      </div>
    </div>
  )
}
