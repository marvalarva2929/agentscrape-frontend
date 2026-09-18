import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { authApi } from './api/auth'
import { schoolsApi } from './api/schools'
import { peopleApi } from './api/people'
import { applyRunEvent, runsApi, TERMINAL_EVENTS } from './api/runs'
import { AppShell } from './components/layout/AppShell'
import { BackendUnavailableState } from './components/common/BackendUnavailableState'
import { LoadingState } from './components/common/LoadingState'
import { LoginPage } from './pages/LoginPage'
import { PastCrawlsPage } from './pages/PastCrawlsPage'
import { PersonPage } from './pages/PersonPage'
import { RunMonitorPage } from './pages/RunMonitorPage'
import type { School } from './types/school'
import type { Person, PersonStatus } from './types/person'
import type { Run } from './types/run'

export type Screen =
  | 'main'
  | 'person'
  | 'run-monitor'
  | 'crawl'
  | 'history'

type WizardDraft = {
  schoolId: string
  schoolUrl: string
  maxSpendUsd: string
  forceRescan: boolean
}

const createWizardDraft = (schoolId = '', schoolUrl = ''): WizardDraft => ({
  schoolId,
  schoolUrl,
  maxSpendUsd: '',
  forceRescan: false,
})

function App() {
  const [screen, setScreen] = useState<Screen>('main')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [schools, setSchools] = useState<School[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('')
  const [selectedPersonId, setSelectedPersonId] = useState<string>('')
  const [run, setRun] = useState<Run | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [wizardDraft, setWizardDraft] = useState<WizardDraft>(createWizardDraft())
  const [query, setQuery] = useState('')
  const [trainingFilter, setTrainingFilter] = useState<'all' | 'Resident' | 'Fellow'>('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | PersonStatus>('all')
  const stopWatching = useRef<(() => void) | null>(null)

  useEffect(() => () => stopWatching.current?.(), [])

  useEffect(() => {
    const init = async () => {
      try {
        const session = await authApi.getSession()
        setIsAuthenticated(session.authenticated)
        setIsAdmin(session.user?.scope === 'admin')
        if (session.authenticated) {
          const schoolList = await schoolsApi.listSchools()
          setSchools(schoolList)
          if (schoolList[0]) {
            setSelectedSchoolId(schoolList[0].id)
          }
        }
      } catch {
        setError('Could not establish session.')
      } finally {
        setLoading(false)
      }
    }

    void init()
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return

    const loadSchools = async () => {
      const schoolList = await schoolsApi.listSchools()
      setSchools(schoolList)
    }

    void loadSchools()
  }, [isAuthenticated])

  useEffect(() => {
    if (!selectedSchoolId) {
      setPeople([])
      return
    }

    const loadPeople = async () => {
      const personList = await peopleApi.listPeopleForSchool(selectedSchoolId)
      setPeople(personList)
    }

    void loadPeople()
  }, [selectedSchoolId])

  const selectedSchool = useMemo(
    () => schools.find((school) => school.id === selectedSchoolId) ?? null,
    [schools, selectedSchoolId],
  )

  const selectedPerson = useMemo(
    () => people.find((person) => person.id === selectedPersonId) ?? null,
    [people, selectedPersonId],
  )

  const filteredPeople = useMemo(() => {
    if (!selectedSchoolId) return []

    return people.filter((person) => {
      const matchesText =
        person.name.toLowerCase().includes(query.toLowerCase()) ||
        (person.email ?? '').toLowerCase().includes(query.toLowerCase())
      const matchesTraining = trainingFilter === 'all' || person.trainingType === trainingFilter
      const matchesYear = yearFilter === 'all' || person.year === yearFilter
      const matchesStatus = statusFilter === 'all' || person.status === statusFilter

      return matchesText && matchesTraining && matchesYear && matchesStatus
    })
  }, [people, query, selectedSchoolId, statusFilter, trainingFilter, yearFilter])

  const handleLogin = async (password: string) => {
    try {
      const session = await authApi.login({ password })
      if (!session.authenticated) return false

      setIsAuthenticated(true)
      setScreen('main')
      setLoading(true)
      const schoolList = await schoolsApi.listSchools()
      setSchools(schoolList)
      if (schoolList[0]) {
        setSelectedSchoolId(schoolList[0].id)
      }
      setLoading(false)
      return true
    } catch {
      return false
    }
  }

  const handleLogout = async () => {
    await authApi.logout()
    setIsAuthenticated(false)
    setScreen('main')
    setRun(null)
    setSelectedSchoolId('')
    setSelectedPersonId('')
  }

  const wizardErrors = useMemo(() => {
    const errors: Record<string, string> = {}
    const hasSchool = !!wizardDraft.schoolId
    const schoolUrl = wizardDraft.schoolUrl.trim()

    // A school already in the list is optional: a URL alone starts a crawl of
    // a new school, which is how the first school gets in on a fresh install.
    if (!schoolUrl) {
      errors.schoolUrl = hasSchool ? 'School URL is required.' : 'Choose a school or enter its URL.'
    } else if (!/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(schoolUrl) && !/^[^\s.]+\.[^\s]+$/.test(schoolUrl)) {
      errors.schoolUrl = 'Enter a web address, e.g. https://medicine.arizona.edu'
    }

    if (wizardDraft.maxSpendUsd.trim()) {
      const amount = Number(wizardDraft.maxSpendUsd)
      if (!Number.isFinite(amount) || amount <= 0) {
        errors.maxSpendUsd = 'Enter a dollar amount greater than zero.'
      }
    }

    return errors
  }, [wizardDraft])

  const canStartUpdate = Object.keys(wizardErrors).length === 0

  const handleSubmitWizard = async () => {
    if (!canStartUpdate) return

    const payload = {
      schoolId: wizardDraft.schoolId,
      schoolUrl: wizardDraft.schoolUrl.trim(),
      maxSpendUsd: wizardDraft.maxSpendUsd.trim() ? Number(wizardDraft.maxSpendUsd) : null,
      forceRescan: wizardDraft.forceRescan,
    }

    const school = schools.find((item) => item.id === wizardDraft.schoolId)
    const job = await runsApi.startRun(payload)
    if (wizardDraft.schoolId) setSelectedSchoolId(wizardDraft.schoolId)
    setRun({
      ...job,
      schoolId: wizardDraft.schoolId || undefined,
      schoolName: school?.name ?? hostOf(payload.schoolUrl),
    })
    setScreen('run-monitor')

    watchRun(job.id)
  }

  /**
   * Follow a run until it ends: the event stream drives the live feed and
   * tallies, and a slow poll catches the end even if the stream drops (the
   * server may be stopped when idle). At the end the run row is authoritative.
   */
  const watchRun = (runId: string) => {
    stopWatching.current?.()
    let finished = false

    const finish = async () => {
      if (finished) return
      finished = true
      cleanup()
      try {
        const final = await runsApi.getRun(runId)
        setRun((current) => ({
          ...(current ?? final),
          status: final.status === 'running' || final.status === 'queued' ? 'completed' : final.status,
          stage: final.status === 'failed' ? 'failed' : 'complete',
          progress: 100,
          finishedAt: final.finishedAt,
          elapsedSeconds: final.elapsedSeconds,
          spendUsd: final.spendUsd ?? current?.spendUsd,
          stoppedAtLimit: final.stoppedAtLimit,
          counts: {
            ...(current?.counts ?? final.counts!),
            ...(final.counts ?? {}),
            // The run row only counts people once a site finishes; never show
            // fewer than the stream already reported.
            peopleFound: Math.max(final.counts?.peopleFound ?? 0, current?.counts?.peopleFound ?? 0),
          },
        }))
      } catch {
        setRun((current) => (current ? { ...current, progress: 100, stage: 'complete' } : current))
      }
    }

    const unsubscribe = runsApi.subscribeToRun(runId, (event) => {
      setRun((current) => (current ? applyRunEvent(current, event) : current))
      if (TERMINAL_EVENTS.has(event.type)) void finish()
    })

    const poll = window.setInterval(async () => {
      try {
        const latest = await runsApi.getRun(runId)
        if (['completed', 'failed', 'cancelled'].includes(latest.status)) void finish()
      } catch {
        /* transient; the next poll retries */
      }
    }, 5000)

    const cleanup = () => {
      window.clearInterval(poll)
      if (typeof unsubscribe === 'function') unsubscribe()
      stopWatching.current = null
    }
    stopWatching.current = cleanup
  }

  const handleViewResults = async () => {
    if (!run) return
    const finished = run
    setRun(null)
    setScreen('main')
    const schoolList = await schoolsApi.listSchools().catch(() => schools)
    setSchools(schoolList)
    const crawledHost = finished.schoolName?.toLowerCase()
    const target =
      finished.schoolId ||
      schoolList.find((item) => item.rootDomain?.toLowerCase() === crawledHost)?.id ||
      selectedSchoolId ||
      schoolList[0]?.id ||
      ''
    // Reload people even when the selection does not change.
    setSelectedSchoolId('')
    window.setTimeout(() => setSelectedSchoolId(target), 0)
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />
  }

  if (loading) {
    return <LoadingState message="Loading residency data…" />
  }

  if (error) {
    return <BackendUnavailableState />
  }

  const navigateToCrawl = async () => {
    // The list may have changed since login (a seed or another crawl).
    const schoolList = await schoolsApi.listSchools().catch(() => schools)
    setSchools(schoolList)
    const schoolId = selectedSchoolId || schoolList[0]?.id || ''
    const school = schoolList.find((item) => item.id === schoolId)
    setWizardDraft(createWizardDraft(schoolId, school?.canonicalUrl ?? ''))
    setScreen('crawl')
  }

  return (
    <AppShell
      onLogout={handleLogout}
      onNavigateSchools={() => setScreen('main')}
      onNavigateHistory={() => setScreen('history')}
      isAdmin={isAdmin}
      onNavigateCrawl={isAdmin ? navigateToCrawl : undefined}
      statusText="Backend online"
    >
      {screen === 'main' && (
        <main className="page-shell">
          <div className="page-header-row">
            <div>
              <div className="breadcrumb">Main Data</div>
              <h2>Residency Data</h2>
            </div>
          </div>

          <div className="panel-block">
            <div className="table-controls" style={{ gridTemplateColumns: '1fr' }}>
              <div className="field-group" style={{ marginTop: 0 }}>
                <label className="input-label">School</label>
                <select
                  value={selectedSchoolId}
                  onChange={(event) => {
                    setSelectedSchoolId(event.target.value)
                    setPeople([])
                  }}
                >
                  <option value="">Select a school</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>{school.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {!selectedSchoolId && (
            <div className="empty-state">
              {schools.length === 0
                ? isAdmin
                  ? 'No schools yet. Use Crawl to add one by its web address.'
                  : 'No schools yet. Sign in as an admin to crawl the first one.'
                : 'Select a school to view people.'}
            </div>
          )}

          {selectedSchoolId && selectedSchool && (
            <>
              <div className="summary-row">
                <div className="summary-card"><div className="summary-label">Total People</div><div className="summary-value">{filteredPeople.length}</div></div>
                <div className="summary-card"><div className="summary-label">Residents</div><div className="summary-value">{filteredPeople.filter((person) => person.trainingType === 'Resident').length}</div></div>
                <div className="summary-card"><div className="summary-label">Fellows</div><div className="summary-value">{filteredPeople.filter((person) => person.trainingType === 'Fellow').length}</div></div>
                <div className="summary-card"><div className="summary-label">Emails Found</div><div className="summary-value">{filteredPeople.filter((person) => person.email).length}</div></div>
                <div className="summary-card"><div className="summary-label">Last Updated</div><div className="summary-value">{formatDate(selectedSchool.lastUpdated)}</div></div>
              </div>

              <div className="table-panel">
                <div className="table-controls">
                  <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" />
                  <select value={trainingFilter} onChange={(event) => setTrainingFilter(event.target.value as 'all' | 'Resident' | 'Fellow')}>
                    <option value="all">All</option>
                    <option value="Resident">Resident</option>
                    <option value="Fellow">Fellow</option>
                  </select>
                  <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
                    <option value="all">All years</option>
                    <option value="PGY-1">PGY-1</option>
                    <option value="PGY-2">PGY-2</option>
                    <option value="PGY-3">PGY-3</option>
                    <option value="PGY-5">PGY-5</option>
                  </select>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | PersonStatus)}>
                    <option value="all">All statuses</option>
                    <option value="new">New</option>
                    <option value="active">Active</option>
                    <option value="stale">Stale</option>
                  </select>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Role</th>
                        <th>Position</th>
                        <th>Year</th>
                        <th>Specialty</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Last seen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPeople.map((person) => (
                        <tr key={person.id} onClick={() => {
                          setSelectedPersonId(person.id)
                          setScreen('person')
                        }} className="clickable-row">
                          <td>{person.name}</td>
                          <td className="capitalise">
                            {person.trainingType ?? person.category ?? '—'}
                          </td>
                          {/* The title exactly as the site printed it. */}
                          <td>{person.position ?? '—'}</td>
                          <td>{person.year ?? '—'}</td>
                          <td>{person.specialty ?? '—'}</td>
                          <td>{person.email || '—'}</td>
                          <td><StatusBadge status={person.status} /></td>
                          <td>{formatDate(person.lastVerified)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </main>
      )}

      {screen === 'history' && (
        <PastCrawlsPage
          onBack={() => setScreen('main')}
          onOpenRun={(runId) => {
            void runsApi.getRun(runId).then((loaded) => {
              setRun(loaded)
              setScreen('run-monitor')
            })
          }}
        />
      )}

      {screen === 'person' && selectedPerson && (
        <PersonPage
          school={selectedSchool ?? undefined}
          person={selectedPerson}
          onBack={() => setScreen('main')}
        />
      )}

      {screen === 'run-monitor' && run && (
        <RunMonitorPage
          run={run}
          onBack={() => {
            setRun(null)
            setScreen('main')
          }}
          onViewResults={handleViewResults}
          onStartGame={() => undefined}
        />
      )}

      {screen === 'crawl' && (
        <main className="page-shell narrow-shell">
          <div className="page-header-row">
            <div>
              <div className="breadcrumb">Crawl</div>
              <h2>Update School</h2>
            </div>
          </div>

          <section className="panel-block">
            <div className="field-group">
              <label className="input-label">School</label>
              <select
                value={wizardDraft.schoolId}
                onChange={(event) => {
                  const nextSchoolId = event.target.value
                  const school = schools.find((item) => item.id === nextSchoolId)

                  setWizardDraft((current) => ({
                    ...current,
                    schoolId: nextSchoolId,
                    schoolUrl: school?.canonicalUrl ?? '',
                  }))
                }}
              >
                <option value="">New school — enter its URL below</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>{school.name}</option>
                ))}
              </select>
            </div>

            <div className="field-group">
              <label className="input-label">School URL</label>
              <input
                value={wizardDraft.schoolUrl}
                onChange={(event) => setWizardDraft((current) => ({ ...current, schoolUrl: event.target.value }))}
                placeholder="https://school.edu"
              />
              {wizardErrors.schoolUrl ? <div className="form-error">{wizardErrors.schoolUrl}</div> : null}
            </div>

            <div className="field-group">
              <label className="input-label">Budget</label>
              <input
                type="number"
                min={1}
                step={1}
                value={wizardDraft.maxSpendUsd}
                onChange={(event) => setWizardDraft((current) => ({ ...current, maxSpendUsd: event.target.value }))}
                placeholder="No cap"
              />
              {wizardErrors.maxSpendUsd ? <div className="form-error">{wizardErrors.maxSpendUsd}</div> : null}
            </div>

            <div className="field-group">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={wizardDraft.forceRescan}
                  onChange={(event) => setWizardDraft((current) => ({ ...current, forceRescan: event.target.checked }))}
                />
                <span>Force rescan</span>
              </label>
            </div>

            <div className="review-box" style={{ marginTop: '1.2rem' }}>
              <div className="review-row"><span>School</span><strong>{schools.find((school) => school.id === wizardDraft.schoolId)?.name ?? (wizardDraft.schoolUrl ? `New: ${hostOf(wizardDraft.schoolUrl)}` : '—')}</strong></div>
              <div className="review-row"><span>URL</span><strong>{wizardDraft.schoolUrl || '—'}</strong></div>
              <div className="review-row"><span>Budget</span><strong>{wizardDraft.maxSpendUsd ? `$${wizardDraft.maxSpendUsd}` : 'No cap'}</strong></div>
              <div className="review-row"><span>Force rescan</span><strong>{wizardDraft.forceRescan ? 'Yes' : 'No'}</strong></div>
            </div>

            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setScreen('main')}>Cancel</button>
              <button className="primary-button" onClick={handleSubmitWizard} disabled={!canStartUpdate}>
                Start Update
              </button>
            </div>
          </section>
        </main>
      )}
    </AppShell>
  )
}

function StatusBadge({ status }: { status: Person['status'] }) {
  return <span className={`status-badge ${status}`}>{status}</span>
}

export default App

/** ISO timestamps from the API; the UI wants a plain date. */
function formatDate(value?: string | null) {
  if (!value) return '\u2014'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString()
}

function hostOf(url: string): string {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname
  } catch {
    return url
  }
}
