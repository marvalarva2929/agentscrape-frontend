import { useEffect, useState } from 'react'
import { ApiError } from '../api/client'
import { submissionsApi, type Submission } from '../api/submissions'

/**
 * Staff queue. Clients submit CSVs; nothing is crawled until someone here
 * launches it with a budget, because each school is billable.
 */
export function AdminSubmissionsPage({
  onBack,
  onOpenRun,
}: {
  onBack: () => void
  onOpenRun: (runId: string) => void
}) {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [budget, setBudget] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      setSubmissions(await submissionsApi.list())
      setError('')
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.code === 'FORBIDDEN'
          ? 'This area needs the admin password.'
          : 'Could not load the queue.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const launch = async (submission: Submission) => {
    const raw = budget[submission.id]
    const amount = raw ? Number(raw) : null
    if (raw && (!Number.isFinite(amount) || (amount ?? 0) <= 0)) {
      setError('Enter a dollar amount greater than zero.')
      return
    }

    setBusy(submission.id)
    setError('')
    try {
      const updated = await submissionsApi.run(submission.id, { maxSpendUsd: amount })
      setSubmissions((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      )
      if (updated.run_id) onOpenRun(updated.run_id)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not start that run.')
    } finally {
      setBusy('')
    }
  }

  return (
    <main className="page-shell">
      <div className="page-header-row">
        <div>
          <div className="breadcrumb">Admin / Requests</div>
          <h2>Submitted CSVs</h2>
        </div>
        <div className="monitor-actions">
          <button className="secondary-button" onClick={() => void load()}>Refresh</button>
          <button className="secondary-button" onClick={onBack}>Back</button>
        </div>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}
      {loading ? <div className="muted">Loading…</div> : null}
      {!loading && submissions.length === 0 && !error ? (
        <div className="muted">No requests yet.</div>
      ) : null}

      <div className="card-grid">
        {submissions.map((submission) => (
          <div key={submission.id} className="school-card static-card">
            <div className="card-header-row">
              <div>
                <div className="eyebrow">Request</div>
                <h3>{submission.filename ?? submission.id}</h3>
              </div>
              <span className="status-pill">{submission.status}</span>
            </div>

            <div className="meta-list">
              <div><span>Submitted</span><strong>{formatDate(submission.created_at)}</strong></div>
              <div><span>Schools requested</span><strong>{submission.valid_count}</strong></div>
              <div><span>Unusable rows</span><strong>{submission.row_count - submission.valid_count}</strong></div>
              <div>
                <span>Already known</span>
                <strong>{submission.rows.filter((row) => row.known_site).length}</strong>
              </div>
              {submission.note ? (
                <div><span>Note</span><strong>{submission.note}</strong></div>
              ) : null}
            </div>

            {submission.status === 'pending' ? (
              <div className="upload-row">
                <label className="budget-field">
                  <span>$</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Budget"
                    value={budget[submission.id] ?? ''}
                    onChange={(event) =>
                      setBudget((current) => ({
                        ...current,
                        [submission.id]: event.target.value,
                      }))
                    }
                  />
                </label>
                <button
                  className="primary-button"
                  disabled={busy === submission.id}
                  onClick={() => void launch(submission)}
                >
                  {busy === submission.id ? 'Starting…' : 'Run'}
                </button>
              </div>
            ) : submission.run_id ? (
              <button
                className="secondary-button"
                onClick={() => onOpenRun(submission.run_id as string)}
              >
                View run
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </main>
  )
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString()
}
