import { useEffect, useState } from 'react'

import { peopleApi } from '../api/people'
import { SourceScreenshot } from '../components/source/SourceScreenshot'
import type { SourceProvenance } from '../types/source'
import type { Person, PersonVersion } from '../types/person'
import type { School } from '../types/school'

export function PersonPage({
  school,
  person,
  onBack,
}: {
  school?: School
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

  const [source, setSource] = useState<SourceProvenance | null>(null)
  const [sourceState, setSourceState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [history, setHistory] = useState<PersonVersion[]>(person.versionHistory ?? [])

  useEffect(() => {
    let cancelled = false
    setSource(null); setSourceState('loading'); setHistory(person.versionHistory ?? [])
    peopleApi
      .getSource(person.id)
      .then((loaded) => {
        if (!cancelled) { setSource(loaded); setSourceState('ready') }
      })
      .catch(() => {
        // Provenance is supporting detail; the page still works without it, but
        // it must say so rather than sit on "Loading source…" for good.
        if (!cancelled) setSourceState('failed')
      })
    // What changed about this person between crawls.
    peopleApi
      .getVersions(person.id)
      .then((versions) => { if (!cancelled) setHistory(versions) })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [person.id, person.versionHistory])

  return (
    <main className="page-shell narrow-shell">
      <div className="person-header">
        <div>
          <div className="breadcrumb">Schools / {school?.name ?? 'School'} / {person.name}</div>
          <h2>{person.name}</h2>
          <div className="subheader-meta">
            <span>{person.trainingType ?? '—'}</span>
            <span>{person.specialty ?? 'Specialty not stated'}</span>
            <span>{school?.name ?? 'School'}</span>
            <StatusBadge status={person.status} />
          </div>
        </div>
        <button className="secondary-button" onClick={onBack}>Back to school</button>
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
          {(source?.sourceUrl ?? person.sourceUrl) ? (
            <a
              href={source?.sourceUrl ?? person.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="primary-button small-button"
            >
              Open Source
            </a>
          ) : null}
        </div>

        <div className="source-meta">
          <div><span>Captured</span><strong>{formatWhen(source?.capturedAt ?? person.capturedAt)}</strong></div>
          <div><span>Page</span><strong>{source?.pageTitle ?? '—'}</strong></div>
          <div><span>Source</span><strong>{source?.sourceUrl ?? person.sourceUrl ?? '—'}</strong></div>
          <div><span>Method</span><strong>{source?.extractionMethod ?? '—'}</strong></div>
        </div>

        {/* The screenshot replaces the old text snippet: it shows the page as
            it looked, with boxes over the exact fields that were read. */}
        {source
          ? <SourceScreenshot source={source} />
          : sourceState === 'failed'
            ? <p className="muted">The source for this person could not be loaded. The details above are still what the page stated.</p>
            : <p className="muted">Loading source…</p>}
      </section>

      {history.length > 0 && (
        <section className="detail-section">
          <div className="section-title-row">
            <h3>History</h3>
          </div>

          <div className="timeline">
            {history.map((entry) => (
              <div key={entry.id} className="timeline-item">
                <div className="timeline-date">{formatWhen(entry.date)}</div>
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

function formatWhen(value?: string) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function StatusBadge({ status }: { status: Person['status'] }) {
  return <span className={`status-badge ${status}`}>{status}</span>
}
