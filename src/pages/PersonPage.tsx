import { useEffect, useRef, useState } from 'react'

import { describeVerification, peopleApi, pollVerification, verificationIsDone } from '../api/people'
import { SourceScreenshot } from '../components/source/SourceScreenshot'
import type { SourceProvenance } from '../types/source'
import type { Person, PersonVersion } from '../types/person'
import type { School } from '../types/school'

import { roleLabel } from '../utils/personRoles'

export function PersonPage({
  school,
  person,
  onBack,
  onVerified,
}: {
  school?: School
  person: Person
  onBack: () => void
  /** Called after a verification job for this person finishes, so the caller
   * can refetch and pass down the (possibly corrected) record. */
  onVerified?: () => void
}) {
  // Only fields the page actually stated. Nothing is inferred, so a blank
  // simply means the institution did not publish it.
  const sourceFields = [
    ['Name', person.name],
    ['Email', person.email],
    ['Role', roleLabel(person)],
    ['Position', person.position],
    ['PGY', person.year],
    ['Specialty', person.specialty],
    ['Class year', person.graduationYear],
  ].filter(([, value]) => Boolean(value)) as Array<[string, string]>

  const [verifying, setVerifying] = useState(false)
  const [verifyNotice, setVerifyNotice] = useState('')
  // Stop following the job when this page closes or shows someone else.
  const followingFor = useRef<string | null>(null)
  useEffect(() => () => { followingFor.current = null }, [person.id])

  const verifyPerson = async () => {
    const id = person.id
    followingFor.current = id
    const stale = () => followingFor.current !== id
    setVerifying(true); setVerifyNotice('')
    try {
      const job = await peopleApi.startVerification({ recordIds: [id] })
      setVerifyNotice(describeVerification(job))
      const finished = await pollVerification(job.id, {
        isCancelled: stale,
        onUpdate: (update) => { if (!verificationIsDone(update)) setVerifyNotice(describeVerification(update)) },
      })
      if (!finished) return
      if (finished.status === 'failed') {
        setVerifyNotice(finished.error || 'Could not check this record. Please try again.')
      } else if (finished.recordsChecked === 0) {
        setVerifyNotice(finished.error || 'Could not re-read the source page for this record.')
      } else {
        setVerifyNotice(finished.recordsCorrected > 0 ? 'Role label updated from the source page.' : 'Confirmed: the source page supports no other role.')
        onVerified?.()
      }
    } catch {
      if (!stale()) setVerifyNotice('Could not check this record. Please try again.')
    } finally {
      setVerifying(false)
    }
  }

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
        <div style={{ display: 'flex', gap: '0.8rem' }}>
          <button className="secondary-button" onClick={() => { void verifyPerson() }} disabled={verifying}>
            {verifying ? 'Verifying…' : 'Verify against source'}
          </button>
          <button className="secondary-button" onClick={onBack}>Back to school</button>
        </div>
      </div>

      {verifyNotice && <div className="info-banner">{verifyNotice}</div>}

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
