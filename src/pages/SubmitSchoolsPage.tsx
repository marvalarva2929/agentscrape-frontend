import { useRef, useState } from 'react'
import { submissionsApi, type Submission } from '../api/submissions'
import { ApiError } from '../api/client'

/**
 * Clients request schools here; they cannot start a crawl. Staff review the
 * submission and launch it, because billing is per school.
 */
export function SubmitSchoolsPage({ onBack }: { onBack: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<Submission | null>(null)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const submit = async () => {
    if (!file) return
    setSubmitting(true)
    setError('')
    try {
      setResult(await submissionsApi.submit(file, note.trim() || undefined))
      setFile(null)
      setNote('')
      if (inputRef.current) inputRef.current.value = ''
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Could not submit that file.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="page-shell">
      <div className="page-header-row">
        <div>
          <div className="breadcrumb">Schools / Request</div>
          <h2>Request Schools</h2>
        </div>
        <button className="secondary-button" onClick={onBack}>Back</button>
      </div>

      <section className="detail-section">
        <p className="muted">
          Upload a CSV of the schools you would like collected — one URL per row.
          We review each request and run it for you.
        </p>

        <div className="upload-row">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <input
            type="text"
            placeholder="Note (optional)"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <button className="primary-button" disabled={!file || submitting} onClick={submit}>
            {submitting ? 'Submitting…' : 'Submit request'}
          </button>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}
      </section>

      {result ? (
        <section className="detail-section">
          <div className="section-title-row">
            <h3>Request received</h3>
            <span className="status-pill">{result.status}</span>
          </div>
          <div className="summary-row">
            <div className="summary-card">
              <div className="summary-label">Rows</div>
              <div className="summary-value">{result.row_count}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Usable</div>
              <div className="summary-value">{result.valid_count}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Already known</div>
              <div className="summary-value">
                {result.rows.filter((row) => row.known_site).length}
              </div>
            </div>
          </div>

          <div className="table-panel">
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Previously collected</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.row}>
                    <td>{row.row}</td>
                    <td>{row.input}</td>
                    <td>
                      {row.valid ? (
                        row.known_site ? 'Already in your library' : 'New school'
                      ) : (
                        <span className="muted">{row.error ?? 'Not usable'}</span>
                      )}
                    </td>
                    <td>{row.known_site ? `${row.previous_record_count} people` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  )
}
