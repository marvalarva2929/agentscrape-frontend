import type { Person } from '../types/person'
import type { Program } from '../types/program'
import type { School } from '../types/school'

export function PersonPage({
  school,
  program,
  person,
  onBack,
}: {
  school?: School
  program?: Program
  person: Person
  onBack: () => void
}) {
  // Only fields the page actually stated. Nothing is inferred, so a blank
  // simply means the institution did not publish it.
  const sourceFields = [
    ['Name', person.name],
    ['Email', person.email],
    ['Role', person.trainingType ?? person.category],
    ['Position', person.position],
    ['Year', person.year],
    ['Specialty', person.specialty],
    ['Class of', person.graduationYear],
  ].filter(([, value]) => Boolean(value)) as Array<[string, string]>

  const sourceSnippet = person.sourceSnippet ?? person.extractedText ?? 'No source snippet available.'

  return (
    <main className="page-shell narrow-shell">
      <div className="person-header">
        <div>
          <div className="breadcrumb">Schools / {school?.name ?? 'School'} / {program?.name ?? 'Program'} / {person.name}</div>
          <h2>{person.name}</h2>
          <div className="subheader-meta">
            <span>{person.trainingType ?? '—'}</span>
            <span>{program?.name ?? 'Program'}</span>
            <span>{school?.name ?? 'School'}</span>
            <StatusBadge status={person.status} />
          </div>
        </div>
        <button className="secondary-button" onClick={onBack}>Back to program</button>
      </div>

      <section className="detail-section">
        <div className="section-title-row">
          <h3>Extracted Information</h3>
        </div>
        <div className="detail-grid">
          {sourceFields.map(([label, value]) => (
            <div key={label} className="detail-item">
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="detail-section">
        <div className="section-title-row">
          <h3>Source of Truth</h3>
          {person.sourceUrl ? <a href={person.sourceUrl} target="_blank" rel="noreferrer" className="primary-button small-button">Open Source</a> : null}
        </div>

        <div className="source-meta">
          <div><span>Captured</span><strong>{person.capturedAt ?? person.lastVerified ?? '—'}</strong></div>
          <div><span>Source</span><strong>{person.sourceUrl ?? '—'}</strong></div>
        </div>

        <div className="extracted-panel">
          <strong>HTML / Extracted Snippet</strong>
          <pre>{sourceSnippet}</pre>
        </div>
      </section>

      {person.versionHistory && person.versionHistory.length > 0 && (
        <section className="detail-section">
          <div className="section-title-row">
            <h3>History</h3>
          </div>

          <div className="timeline">
            {person.versionHistory.map((entry) => (
              <div key={entry.id} className="timeline-item">
                <div className="timeline-date">{entry.date}</div>
                <div className="timeline-content">
                  <strong>{entry.field}</strong>
                  <div className="history-values">
                    <span>{entry.oldValue || '—'}</span>
                    <span className="arrow">→</span>
                    <span>{entry.newValue || '—'}</span>
                  </div>
                  {entry.sourceUrl ? (
                    <div className="history-link">
                      <a href={entry.sourceUrl} target="_blank" rel="noreferrer">Source URL</a>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}

function StatusBadge({ status }: { status: Person['status'] }) {
  return <span className={`status-badge ${status}`}>{status}</span>
}
