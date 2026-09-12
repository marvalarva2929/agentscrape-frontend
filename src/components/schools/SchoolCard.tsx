import type { School } from '../../types/school'

export function SchoolCard({ school, onClick }: { school: School; onClick: () => void }) {
  return (
    <button className="school-card" onClick={onClick}>
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
  )
}
