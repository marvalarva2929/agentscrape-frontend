import type { Program } from '../../types/program'

export function ProgramCard({ program, onClick }: { program: Program; onClick: () => void }) {
  return (
    <button className="program-card" onClick={onClick}>
      <div className="program-name-row">
        <div>
          <div className="eyebrow">Program</div>
          <h4>{program.name}</h4>
        </div>
        <span className="pill neutral">{program.type ?? 'Program'}</span>
      </div>

      <div className="stat-row">
        <div><span>Residents</span><strong>{program.residentCount ?? 0}</strong></div>
        <div><span>Fellows</span><strong>{program.fellowCount ?? 0}</strong></div>
        <div><span>Total People</span><strong>{program.peopleCount ?? 0}</strong></div>
        <div><span>Last Updated</span><strong>{program.lastUpdated ?? '—'}</strong></div>
      </div>
    </button>
  )
}
