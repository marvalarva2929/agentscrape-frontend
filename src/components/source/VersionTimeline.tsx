import type { PersonVersion } from '../../types/person'

export function VersionTimeline({ versions }: { versions: PersonVersion[] }) {
  return (
    <section className="detail-section">
      <div className="section-title-row">
        <h3>History</h3>
      </div>

      <div className="timeline">
        {versions.map((entry) => (
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
  )
}
