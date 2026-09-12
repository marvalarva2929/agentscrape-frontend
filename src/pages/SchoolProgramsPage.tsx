import type { Program } from '../types/program'
import type { School } from '../types/school'

export function SchoolProgramsPage({
  school,
  programs,
  onBack,
  onSelectProgram,
}: {
  school: School
  programs: Program[]
  onBack: () => void
  onSelectProgram: (id: string) => void
}) {
  return (
    <main className="page-shell">
      <div className="page-header-row">
        <div>
          <div className="breadcrumb">Schools / {school.name}</div>
          <h2>{school.name}</h2>
        </div>
        <button className="secondary-button" onClick={onBack}>Back to schools</button>
      </div>

      <section className="panel-block">
        <div className="panel-header">
          <h3>Programs</h3>
        </div>

        <div className="card-grid compact">
          {programs.map((program) => (
            <button key={program.id} className="program-card" onClick={() => onSelectProgram(program.id)}>
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
          ))}
        </div>
      </section>
    </main>
  )
}
