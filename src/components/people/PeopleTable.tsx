import type { Person } from '../../types/person'
import { StatusBadge } from './StatusBadge'

export function PeopleTable({
  people,
  onOpenPerson,
  query,
  onQueryChange,
  trainingFilter,
  onTrainingFilterChange,
  yearFilter,
  onYearFilterChange,
  specialtyFilter,
  onSpecialtyFilterChange,
  sortKey,
  onSortKeyChange,
  page,
  pageCount,
  onPrev,
  onNext,
}: {
  people: Person[]
  onOpenPerson: (personId: string) => void
  query: string
  onQueryChange: (value: string) => void
  trainingFilter: string
  onTrainingFilterChange: (value: string) => void
  yearFilter: string
  onYearFilterChange: (value: string) => void
  specialtyFilter: string
  onSpecialtyFilterChange: (value: string) => void
  sortKey: string
  onSortKeyChange: (value: string) => void
  page: number
  pageCount: number
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div className="table-panel">
      <div className="table-controls">
        <input type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search by name or email" />
        <select value={trainingFilter} onChange={(event) => onTrainingFilterChange(event.target.value)}>
          <option value="all">All training types</option>
          <option value="Resident">Residents</option>
          <option value="Fellow">Fellows</option>
        </select>
        <select value={yearFilter} onChange={(event) => onYearFilterChange(event.target.value)}>
          <option value="all">All years</option>
          <option value="PGY-1">PGY-1</option>
          <option value="PGY-2">PGY-2</option>
          <option value="PGY-3">PGY-3</option>
          <option value="PGY-5">PGY-5</option>
        </select>
        <select value={specialtyFilter} onChange={(event) => onSpecialtyFilterChange(event.target.value)}>
          <option value="all">All specialties</option>
          <option value="Internal Medicine">Internal Medicine</option>
          <option value="Cardiology">Cardiology</option>
        </select>
        <select value={sortKey} onChange={(event) => onSortKeyChange(event.target.value)}>
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
              <th>Specialty / Track</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Last Verified</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.id} onClick={() => onOpenPerson(person.id)} className="clickable-row">
                <td>{person.name}</td>
                <td>{person.trainingType ?? '—'}</td>
                <td>{person.year ?? '—'}</td>
                <td>{person.specialty ?? '—'}</td>
                <td>{person.email || '—'}</td>
                <td>{person.phone || '—'}</td>
                <td><StatusBadge status={person.status} /></td>
                <td>{person.lastVerified ?? '—'}</td>
                <td>{person.source ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination-row">
        <button className="secondary-button" disabled={page === 1} onClick={onPrev}>Previous</button>
        <span>Page {page} of {pageCount}</span>
        <button className="secondary-button" disabled={page === pageCount} onClick={onNext}>Next</button>
      </div>
    </div>
  )
}
