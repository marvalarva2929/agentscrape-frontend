import type { School } from '../types/school'

export function SchoolsPage({
  schools,
  onSelectSchool,
}: {
  schools: School[]
  onSelectSchool: (id: string) => void
}) {
  return (
    <main className="page-shell">
      <div className="page-header-row">
        <div>
          <div className="breadcrumb">Schools</div>
          <h2>Select a School</h2>
        </div>
      </div>

      <div className="card-grid">
        {schools.map((school) => (
          <button key={school.id} className="school-card" onClick={() => onSelectSchool(school.id)}>
            <div className="card-header-row">
              <div>
                <div className="eyebrow">School</div>
                <h3>{school.name}</h3>
              </div>
            </div>
            <div className="meta-list">
              <div><span>Location</span><strong>{school.location ?? '—'}</strong></div>
              <div><span>Programs</span><strong>{school.programCount ?? 0}</strong></div>
              <div><span>Total People Collected</span><strong>{school.peopleCount ?? 0}</strong></div>
              <div><span>Last Updated</span><strong>{school.lastUpdated ?? '—'}</strong></div>
            </div>
          </button>
        ))}
      </div>
    </main>
  )
}
