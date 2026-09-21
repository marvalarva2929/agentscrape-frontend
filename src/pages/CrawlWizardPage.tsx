import { useMemo, useState } from 'react'
import { QueuePanel } from '../components/run/QueuePanel'
import { SchoolPicker } from '../components/schools/SchoolPicker'
import type { School } from '../types/school'
import { defaultCrawlName } from '../utils/crawlName'

/** One school to crawl, as the wizard hands it on. Each becomes its own queued crawl. */
export interface CrawlRequest {
  schoolId: string
  schoolUrl: string
  schoolName: string
  label: string
  includeDirectory: boolean
  maxSpendUsd: number | null
  maxPeople: number | null
  maxTrainees: number | null
  maxEmails: number | null
}

interface Picked {
  id: string
  name: string
  url: string
  directoryUrl?: string
}

const LIMIT_FIELDS = [
  { key: 'maxPeople', label: 'People' },
  { key: 'maxTrainees', label: 'Residents & fellows' },
  { key: 'maxEmails', label: 'With an email' },
] as const

/** A whole-number limit from a form field; blank means no limit, anything else invalid. */
const parseLimit = (value: string): number | null | undefined => {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

const hostOf = (url: string) => {
  try { return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname } catch { return url }
}

export function CrawlWizardPage({
  schools,
  initialSchoolId,
  queueBusy,
  onCancel,
  onStart,
  onOpenRun,
}: {
  schools: School[]
  initialSchoolId?: string
  /** A crawl is running now, so what is started here waits behind it. */
  queueBusy: boolean
  onCancel: () => void
  /** Resolves once every crawl is queued; rejects with a message to show. */
  onStart: (requests: CrawlRequest[]) => Promise<void>
  onOpenRun?: (runId: string) => void
}) {
  const initial = schools.find((school) => school.id === initialSchoolId)
  const [picked, setPicked] = useState<Picked[]>(
    initial ? [{ id: initial.id, name: initial.name, url: initial.canonicalUrl ?? '', directoryUrl: initial.directoryUrl }] : [],
  )
  const [urlInput, setUrlInput] = useState('')
  const [crawlName, setCrawlName] = useState('')
  const [maxSpendUsd, setMaxSpendUsd] = useState('10')
  const [limits, setLimits] = useState({ maxPeople: '', maxTrainees: '', maxEmails: '' })
  const [includeDirectory, setIncludeDirectory] = useState(false)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const directoryAvailable = picked.length > 0 && picked.every((school) => Boolean(school.directoryUrl))
  const label = queueBusy || picked.length > 1 ? 'Add to Queue' : 'Start Crawl'
  const noun = picked.length === 1 ? 'school' : 'schools'
  const stops = useMemo(() => [
    maxSpendUsd && `$${maxSpendUsd}`,
    limits.maxPeople && `${limits.maxPeople} people`,
    limits.maxTrainees && `${limits.maxTrainees} residents & fellows`,
    limits.maxEmails && `${limits.maxEmails} emails`,
  ].filter(Boolean).join(' · ') || 'No limit', [maxSpendUsd, limits])

  const add = (school: Picked) => {
    setError('')
    setPicked((current) => current.some((item) => item.id && item.id === school.id) || current.some((item) => item.url === school.url)
      ? current
      : [...current, school])
  }
  const addUrl = () => {
    const text = urlInput.trim()
    if (!text) return
    if (!/^(https?:\/\/)?[^\s/]+\.[^\s/]+/i.test(text)) { setError('That does not look like a web address.'); return }
    add({ id: '', name: hostOf(text), url: /^https?:\/\//i.test(text) ? text : `https://${text}` })
    setUrlInput('')
  }

  const validate = (): CrawlRequest[] | null => {
    if (picked.length === 0) { setError('Choose at least one school, or add a school by its web address.'); return null }
    const budget = maxSpendUsd ? Number(maxSpendUsd) : null
    if (budget !== null && (!Number.isFinite(budget) || budget <= 0)) { setError('Budget must be greater than zero.'); return null }
    const maxPeople = parseLimit(limits.maxPeople)
    const maxTrainees = parseLimit(limits.maxTrainees)
    const maxEmails = parseLimit(limits.maxEmails)
    if (maxPeople === undefined || maxTrainees === undefined || maxEmails === undefined) {
      setError('Limits must be whole numbers above zero, or left blank for no limit.'); return null
    }
    const now = new Date()
    return picked.map((school) => ({
      schoolId: school.id,
      schoolUrl: school.url,
      schoolName: school.name,
      // One school can be named; several are named after themselves.
      label: picked.length === 1 && crawlName.trim() ? crawlName.trim() : defaultCrawlName(school.name, now),
      includeDirectory: includeDirectory && directoryAvailable,
      maxSpendUsd: budget, maxPeople, maxTrainees, maxEmails,
    }))
  }

  const review = () => {
    setError('')
    if (validate()) setConfirming(true)
  }

  const start = async () => {
    const requests = validate()
    if (!requests || submitting) return
    setSubmitting(true); setError('')
    try {
      await onStart(requests)
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : 'Could not start the crawl. Check the address and the backend connection, then try again.')
      setConfirming(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="page-shell narrow-shell">
      <div className="page-header-row"><h2>Start a new crawl</h2><button className="secondary-button" onClick={onCancel}>← Home</button></div>
      {queueBusy && <section className="panel-block"><QueuePanel compact onOpenRun={onOpenRun} /></section>}
      <section className="panel-block">
        <div className="field-group">
          <span className="input-label">Schools</span>
          <SchoolPicker
            schools={schools.filter((school) => !picked.some((item) => item.id === school.id))}
            value=""
            onSelect={(school) => add({ id: school.id, name: school.name, url: school.canonicalUrl ?? '', directoryUrl: school.directoryUrl })}
            onClear={() => undefined}
            showNewOption={false}
          />
          {picked.length > 0 ? (
            <ol className="picked-list" aria-label="Schools to crawl, in order">
              {picked.map((school, index) => (
                <li key={school.url || school.id}>
                  <span className="picked-number">{index + 1}</span>
                  <span className="picked-name">{school.name}</span>
                  <button type="button" className="text-button" aria-label={`Remove ${school.name}`} onClick={() => setPicked((current) => current.filter((item) => item !== school))}>Remove</button>
                </li>
              ))}
            </ol>
          ) : <p className="muted">No school chosen yet.</p>}
        </div>
        <div className="field-group">
          <label className="input-label" htmlFor="wizard-url">A school that is not in the list</label>
          <div className="inline-field">
            <input id="wizard-url" value={urlInput} onChange={(event) => setUrlInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addUrl() } }} placeholder="https://school.edu" />
            <button type="button" className="secondary-button" onClick={addUrl}>Add</button>
          </div>
        </div>
        {picked.length === 1 && (
          <div className="field-group">
            <label className="input-label" htmlFor="wizard-name">Crawl name</label>
            <input id="wizard-name" value={crawlName} onChange={(event) => setCrawlName(event.target.value)} placeholder={defaultCrawlName(picked[0].name)} />
          </div>
        )}
        {directoryAvailable && (
          <div className="field-group">
            <label className="input-label">Optional operation</label>
            <label className="checkbox-row"><input type="checkbox" checked={includeDirectory} onChange={(event) => setIncludeDirectory(event.target.checked)} /><span>Also search the school directory</span></label>
          </div>
        )}
        <div className="field-group"><label className="input-label" htmlFor="wizard-budget">Budget per school (USD)</label><input id="wizard-budget" type="number" min={1} value={maxSpendUsd} onChange={(event) => setMaxSpendUsd(event.target.value)} placeholder="10" /></div>
        <div className="field-group">
          <span className="input-label">Stop crawling after</span>
          <div className="limit-grid">
            {LIMIT_FIELDS.map((field) => (
              <label key={field.key} className="limit-field" htmlFor={`limit-${field.key}`}>
                <span>{field.label}</span>
                <input id={`limit-${field.key}`} type="number" min={1} step={1} inputMode="numeric" value={limits[field.key]} onChange={(event) => setLimits((current) => ({ ...current, [field.key]: event.target.value }))} placeholder="No limit" />
              </label>
            ))}
          </div>
        </div>
        <div className="review-box">
          <div className="review-row"><span>Operation</span><strong>{includeDirectory && directoryAvailable ? 'Crawl + Directory Search' : 'Crawl'}</strong></div>
          <div className="review-row"><span>{picked.length === 1 ? 'School' : 'Schools'}</span><strong>{picked.length ? picked.map((school) => school.name).join(', ') : '—'}</strong></div>
          <div className="review-row"><span>Each stops at</span><strong>{stops}</strong></div>
        </div>
        {error && <div className="error-banner" role="alert">{error}</div>}
        {confirming ? (
          <div className="confirm-box" role="alertdialog" aria-label="Confirm crawl">
            <p>Crawl <strong>{picked.length} {noun}</strong>? Each stops at <strong>{stops}</strong>.</p>
            <div className="modal-actions">
              <button className="secondary-button" disabled={submitting} onClick={() => setConfirming(false)}>Back</button>
              <button className="primary-button" disabled={submitting} onClick={() => void start()}>{submitting ? 'Starting…' : `Yes, ${label === 'Start Crawl' ? 'start the crawl' : 'add to the queue'}`}</button>
            </div>
          </div>
        ) : (
          <div className="modal-actions">
            <button className="primary-button" disabled={picked.length === 0} onClick={review}>{label}</button>
          </div>
        )}
      </section>
    </main>
  )
}
