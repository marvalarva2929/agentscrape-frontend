import { useEffect, useMemo, useState } from 'react'
import type { Person } from '../types/person'
import type { Program } from '../types/program'
import type { School } from '../types/school'

export function ProgramPage({
  school,
  program,
  people,
  onBack,
  onOpenPerson,
  onOpenRunWizard,
}: {
  school: School
  program: Program
  people: Person[]
  onBack: () => void
  onOpenPerson: (id: string) => void
  onOpenRunWizard: () => void
}) {
  const [query, setQuery] = useState('')
  const [trainingFilter, setTrainingFilter] = useState<'all' | 'Resident' | 'Fellow'>('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [sortKey, setSortKey] = useState<'name' | 'lastVerified'>('name')
  const [page, setPage] = useState(1)
  const pageSize = 5

  const filteredPeople = useMemo(() => {
    return people
      .filter((person) => {
        const matchesText = person.name.toLowerCase().includes(query.toLowerCase()) || (person.email ?? '').toLowerCase().includes(query.toLowerCase())
        const matchesTraining = trainingFilter === 'all' || person.trainingType === trainingFilter
        const matchesYear = yearFilter === 'all' || person.year === yearFilter
        return matchesText && matchesTraining && matchesYear
      })
      .sort((a, b) => {
        if (sortKey === 'lastVerified') {
          return new Date(b.lastVerified ?? 0).getTime() - new Date(a.lastVerified ?? 0).getTime()
        }
        return a.name.localeCompare(b.name)
      })
  }, [people, query, trainingFilter, yearFilter, sortKey])

  useEffect(() => setPage(1), [query, trainingFilter, yearFilter, sortKey])

  const totalPages = Math.max(1, Math.ceil(filteredPeople.length / pageSize))
  const visiblePeople = filteredPeople.slice((page - 1) * pageSize, page * pageSize)

  return (
    <main className="page-shell">
      <div className="program-header">
        <div>
          <div className="breadcrumb">Schools / {school.name} / {program.name}</div>
          <div className="program-title-row">
            <h2>{school.name}</h2>
            <h3>{program.name}</h3>
          </div>
        </div>

        <button className="primary-button" onClick={onOpenRunWizard}>CRAWL / UPDATE</button>
      </div>

      <div className="summary-row">
        <div className="summary-card"><div className="summary-label">Total People</div><div className="summary-value">{people.length}</div></div>
        <div className="summary-card"><div className="summary-label">Residents</div><div className="summary-value">{people.filter((item) => item.trainingType === 'Resident').length}</div></div>
        <div className="summary-card"><div className="summary-label">Fellows</div><div className="summary-value">{people.filter((item) => item.trainingType === 'Fellow').length}</div></div>
        <div className="summary-card"><div className="summary-label">Emails Found</div><div className="summary-value">{people.filter((item) => item.email).length}</div></div>
        <div className="summary-card"><div className="summary-label">Last Updated</div><div className="summary-value">{program.lastUpdated ?? '—'}</div></div>
      </div>

      <div className="table-panel">
        <div className="table-controls">
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or email" />
          <select value={trainingFilter} onChange={(event) => setTrainingFilter(event.target.value as 'all' | 'Resident' | 'Fellow')}>
            <option value="all">All training types</option>
            <option value="Resident">Residents</option>
            <option value="Fellow">Fellows</option>
          </select>
          <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
            <option value="all">All years</option>
            <option value="PGY-1">PGY-1</option>
            <option value="PGY-2">PGY-2</option>
            <option value="PGY-3">PGY-3</option>
            <option value="PGY-5">PGY-5</option>
          </select>
          <select value={sortKey} onChange={(event) => setSortKey(event.target.value as 'name' | 'lastVerified')}>
            <option value="name">Sort by name</option>
            <option value="lastVerified">Sort by last verified</option>
          </select>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Training Type</th>
                <th>PGY / Year</th>
                <th>Specialty</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Last Verified</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {visiblePeople.map((person) => (
                <tr key={person.id} onClick={() => onOpenPerson(person.id)} className="clickable-row">
                  <td>{person.name}</td>
                  <td>{person.trainingType ?? '—'}</td>
                  <td>{person.year ?? '—'}</td>
                  <td>{person.specialty ?? '—'}</td>
                  <td>{person.email || '—'}</td>
                  <td><StatusBadge status={person.status} /></td>
                  <td>{person.lastVerified ?? '—'}</td>
                  <td>{person.source ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pagination-row">
          <button className="secondary-button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button className="secondary-button" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</button>
        </div>
      </div>

      <button className="secondary-button back-button" onClick={onBack}>Back to programs</button>
    </main>
  )
}

function StatusBadge({ status }: { status: Person['status'] }) {
  return <span className={`status-badge ${status}`}>{status}</span>
}
