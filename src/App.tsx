import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { authApi } from './api/auth'
import { schoolsApi } from './api/schools'
import { programsApi } from './api/programs'
import { peopleApi } from './api/people'
import { runsApi } from './api/runs'
import { AppShell } from './components/layout/AppShell'
import { BackendUnavailableState } from './components/common/BackendUnavailableState'
import { LoadingState } from './components/common/LoadingState'
import { AdminSubmissionsPage } from './pages/AdminSubmissionsPage'
import { LoginPage } from './pages/LoginPage'
import { PastCrawlsPage } from './pages/PastCrawlsPage'
import { SubmitSchoolsPage } from './pages/SubmitSchoolsPage'
import { PersonPage } from './pages/PersonPage'
import { RunMonitorPage } from './pages/RunMonitorPage'
import type { School } from './types/school'
import type { Program } from './types/program'
import type { Person, PersonStatus } from './types/person'
import type { Run } from './types/run'

export type Screen =
  | 'main'
  | 'person'
  | 'run-monitor'
  | 'crawl'
  | 'submit'
  | 'history'
  | 'admin'

type WizardRunType = 'directory' | 'crawl' | 'both'
type GoalMode = 'target' | 'everyone'

type WizardDraft = {
  schoolId: string
  programId: string
  runType: WizardRunType
  directoryUrl: string
  startUrl: string
  goalMode: GoalMode
  peopleGoal: string
}

const createWizardDraft = (schoolId = '', programId = ''): WizardDraft => ({
  schoolId,
  programId,
  runType: 'both',
  directoryUrl: '',
  startUrl: '',
  goalMode: 'target',
  peopleGoal: '45',
})

function App() {
  const [screen, setScreen] = useState<Screen>('main')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [schools, setSchools] = useState<School[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('')
  const [selectedProgramId, setSelectedProgramId] = useState<string>('')
  const [selectedPersonId, setSelectedPersonId] = useState<string>('')
  const [run, setRun] = useState<Run | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [wizardDraft, setWizardDraft] = useState<WizardDraft>(createWizardDraft())
  const [query, setQuery] = useState('')
  const [trainingFilter, setTrainingFilter] = useState<'all' | 'Resident' | 'Fellow'>('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | PersonStatus>('all')

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
      setPrograms([])
      setSelectedProgramId('')
      return
    }

    const loadPrograms = async () => {
      const programList = await programsApi.listPrograms(selectedSchoolId)
      setPrograms(programList)
    }

    void loadPrograms()
  }, [selectedSchoolId])

  useEffect(() => {
    if (!selectedProgramId) {
      setPeople([])
      return
    }

    const loadPeople = async () => {
      const personList = await peopleApi.listPeople(selectedProgramId)
      setPeople(personList)
    }

    void loadPeople()
  }, [selectedProgramId])

  useEffect(() => {
    if (!selectedSchoolId) return

    const schoolPrograms = programs.filter((program) => program.schoolId === selectedSchoolId)
    if (schoolPrograms.length === 0) {
      setSelectedProgramId('')
      return
    }

    setSelectedProgramId((current) => {
      if (current && schoolPrograms.some((program) => program.id === current)) {
        return current
      }
      return schoolPrograms[0].id
    })
  }, [programs, selectedSchoolId])

  const selectedSchool = useMemo(
    () => schools.find((school) => school.id === selectedSchoolId) ?? null,
    [schools, selectedSchoolId],
  )

  const selectedProgram = useMemo(
    () => programs.find((program) => program.id === selectedProgramId) ?? null,
    [programs, selectedProgramId],
  )

  const selectedPerson = useMemo(
    () => people.find((person) => person.id === selectedPersonId) ?? null,
    [people, selectedPersonId],
  )

  const filteredPeople = useMemo(() => {
    if (!selectedProgramId) return []

    return people.filter((person) => {
      const matchesText =
        person.name.toLowerCase().includes(query.toLowerCase()) ||
        (person.email ?? '').toLowerCase().includes(query.toLowerCase())
      const matchesTraining = trainingFilter === 'all' || person.trainingType === trainingFilter
      const matchesYear = yearFilter === 'all' || person.year === yearFilter
      const matchesStatus = statusFilter === 'all' || person.status === statusFilter

      return matchesText && matchesTraining && matchesYear && matchesStatus
    })
  }, [people, query, selectedProgramId, statusFilter, trainingFilter, yearFilter])

  const schoolPrograms = useMemo(
    () => (selectedSchoolId ? programs.filter((program) => program.schoolId === selectedSchoolId) : []),
    [programs, selectedSchoolId],
  )

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
    setSelectedProgramId('')
    setSelectedPersonId('')
  }

  const wizardSchoolOptions = useMemo(
    () => schools,
    [schools],
  )

  const wizardProgramOptions = useMemo(
    () => programs.filter((program) => program.schoolId === wizardDraft.schoolId),
    [programs, wizardDraft.schoolId],
  )

  const wizardErrors = useMemo(() => {
    const errors: Record<string, string> = {}
    const hasSchool = !!wizardDraft.schoolId
    const hasProgram = !!wizardDraft.programId

    if (!hasSchool) errors.school = 'School is required.'
    if (!hasProgram) errors.program = 'Program is required.'

    if (wizardDraft.runType === 'directory' || wizardDraft.runType === 'both') {
      if (!wizardDraft.directoryUrl.trim()) {
        errors.directoryUrl = 'Directory URL is required.'
      }
    }

    if (wizardDraft.runType === 'crawl' || wizardDraft.runType === 'both') {
      if (!wizardDraft.startUrl.trim()) {
        errors.startUrl = 'Program URL is required.'
      }
    }

    if (wizardDraft.goalMode === 'target') {
      const goalValue = Number(wizardDraft.peopleGoal)
      if (!wizardDraft.peopleGoal || Number.isNaN(goalValue) || goalValue <= 0 || !Number.isInteger(goalValue)) {
        errors.peopleGoal = 'A positive integer is required.'
      }
    }

    return errors
  }, [wizardDraft])

  const canStartUpdate = Object.keys(wizardErrors).length === 0

  const handleSubmitWizard = async () => {
    if (!canStartUpdate) return

    const payload = {
      programId: wizardDraft.programId,
      runDirectorySearch: wizardDraft.runType === 'directory' || wizardDraft.runType === 'both',
      runNewCrawl: wizardDraft.runType === 'crawl' || wizardDraft.runType === 'both',
      directoryUrl: wizardDraft.directoryUrl,
      startUrl: wizardDraft.startUrl,
      peopleGoal: wizardDraft.goalMode === 'target' ? Number(wizardDraft.peopleGoal) : null,
      noFixedGoal: wizardDraft.goalMode === 'everyone',
    }

    const job = await runsApi.startRun(payload)
    setSelectedSchoolId(wizardDraft.schoolId)
    setSelectedProgramId(wizardDraft.programId)
    setRun(job)
    setScreen('run-monitor')

    const unsubscribe = runsApi.subscribeToRun(job.id, (event) => {
      if (event.run) {
        setRun(event.run)
      }
    })

    if (typeof unsubscribe === 'function') {
      window.setTimeout(unsubscribe, 4000)
    }
  }

  const handleViewResults = () => {
    if (!run) return
    setRun(null)
    if (run.programId) {
      setSelectedProgramId(run.programId)
    }
    if (run.schoolId) {
      setSelectedSchoolId(run.schoolId)
    }
    setScreen('main')
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

  const navigateToCrawl = () => {
    const schoolId = selectedSchoolId || schools[0]?.id || ''
    const schoolOptions = programs.filter((program) => program.schoolId === schoolId)
    const programId = selectedProgramId || schoolOptions[0]?.id || ''
    const programMatch = programId ? programs.find((program) => program.id === programId) : undefined

    setWizardDraft({
      schoolId,
      programId,
      runType: 'both',
      directoryUrl: programMatch?.directoryUrl ?? '',
      startUrl: programMatch?.startUrl ?? '',
      goalMode: 'target',
      peopleGoal: '45',
    })
    setScreen('crawl')
  }

  return (
    <AppShell
      onLogout={handleLogout}
      onNavigateSchools={() => setScreen('main')}
      onNavigateSubmit={() => setScreen('submit')}
      onNavigateHistory={() => setScreen('history')}
      onNavigateAdmin={() => setScreen('admin')}
      isAdmin={isAdmin}
      onNavigateCrawl={navigateToCrawl}
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
            <div className="table-controls" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="field-group" style={{ marginTop: 0 }}>
                <label className="input-label">School</label>
                <select
                  value={selectedSchoolId}
                  onChange={(event) => {
                    setSelectedSchoolId(event.target.value)
                    setSelectedProgramId('')
                    setPeople([])
                  }}
                >
                  <option value="">Select a school</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>{school.name}</option>
                  ))}
                </select>
              </div>

              <div className="field-group" style={{ marginTop: 0 }}>
                <label className="input-label">Program</label>
                <select
                  value={selectedProgramId}
                  onChange={(event) => setSelectedProgramId(event.target.value)}
                  disabled={!selectedSchoolId}
                >
                  {!selectedSchoolId && <option value="">Select a school first</option>}
                  {selectedSchoolId && <option value="">Select a program</option>}
                  {schoolPrograms.map((program) => (
                    <option key={program.id} value={program.id}>{program.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {!selectedSchoolId && (
            <div className="empty-state">Select a school and program to view people.</div>
          )}

          {selectedSchoolId && !selectedProgramId && (
            <div className="empty-state">Select a program to view people.</div>
          )}

          {selectedSchoolId && selectedProgramId && selectedProgram && (
            <>
              <div className="summary-row">
                <div className="summary-card"><div className="summary-label">Total People</div><div className="summary-value">{filteredPeople.length}</div></div>
                <div className="summary-card"><div className="summary-label">Residents</div><div className="summary-value">{filteredPeople.filter((person) => person.trainingType === 'Resident').length}</div></div>
                <div className="summary-card"><div className="summary-label">Fellows</div><div className="summary-value">{filteredPeople.filter((person) => person.trainingType === 'Fellow').length}</div></div>
                <div className="summary-card"><div className="summary-label">Emails Found</div><div className="summary-value">{filteredPeople.filter((person) => person.email).length}</div></div>
                <div className="summary-card"><div className="summary-label">Last Updated</div><div className="summary-value">{formatDate(selectedProgram.lastUpdated)}</div></div>
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

      {screen === 'submit' && <SubmitSchoolsPage onBack={() => setScreen('main')} />}

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

      {screen === 'admin' && (
        <AdminSubmissionsPage
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
          program={selectedProgram ?? undefined}
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
              <h2>Start Crawl / Update</h2>
            </div>
          </div>

          <section className="panel-block">
            <div className="field-group">
              <label className="input-label">School</label>
              <select
                value={wizardDraft.schoolId}
                onChange={(event) => {
                  const nextSchoolId = event.target.value
                  const nextProgramOptions = programs.filter((program) => program.schoolId === nextSchoolId)
                  const nextProgramId = nextProgramOptions[0]?.id ?? ''
                  const selectedProgram = nextProgramOptions.find((program) => program.id === nextProgramId)

                  setWizardDraft((current) => ({
                    ...current,
                    schoolId: nextSchoolId,
                    programId: nextProgramId,
                    directoryUrl: selectedProgram?.directoryUrl ?? '',
                    startUrl: selectedProgram?.startUrl ?? '',
                  }))
                }}
              >
                <option value="">Select a school</option>
                {wizardSchoolOptions.map((school) => (
                  <option key={school.id} value={school.id}>{school.name}</option>
                ))}
              </select>
              {wizardErrors.school ? <div className="form-error">{wizardErrors.school}</div> : null}
            </div>

            <div className="field-group">
              <label className="input-label">Program</label>
              <select
                value={wizardDraft.programId}
                onChange={(event) => {
                  const nextProgramId = event.target.value
                  const selectedProgram = programs.find((program) => program.id === nextProgramId)
                  setWizardDraft((current) => ({
                    ...current,
                    programId: nextProgramId,
                    directoryUrl: selectedProgram?.directoryUrl ?? current.directoryUrl,
                    startUrl: selectedProgram?.startUrl ?? current.startUrl,
                  }))
                }}
                disabled={!wizardDraft.schoolId}
              >
                {!wizardDraft.schoolId && <option value="">Select a school first</option>}
                {wizardDraft.schoolId && <option value="">Select a program</option>}
                {wizardProgramOptions.map((program) => (
                  <option key={program.id} value={program.id}>{program.name}</option>
                ))}
              </select>
              {wizardErrors.program ? <div className="form-error">{wizardErrors.program}</div> : null}
            </div>

            <div className="wizard-step" style={{ marginTop: '1.2rem' }}>What would you like to run?</div>
            <div className="run-options">
              {(['directory', 'crawl', 'both'] as WizardRunType[]).map((runType) => (
                <button
                  key={runType}
                  className={`option-card ${wizardDraft.runType === runType ? 'selected' : ''}`}
                  onClick={() => setWizardDraft((current) => ({ ...current, runType }))}
                >
                  <strong>{runType === 'directory' ? 'DIRECTORY SEARCH' : runType === 'crawl' ? 'NEW CRAWL' : 'BOTH'}</strong>
                  <span>
                    {runType === 'directory'
                      ? 'Search the official school or health system directory for additional information about known people.'
                      : runType === 'crawl'
                        ? 'Crawl the residency or fellowship program website to discover residents and fellows.'
                        : 'Discover residents and fellows from the website and then search the directory for additional details.'}
                  </span>
                </button>
              ))}
            </div>

            {(wizardDraft.runType === 'directory' || wizardDraft.runType === 'both') && (
              <div className="field-group">
                <label className="input-label">Directory URL</label>
                <input
                  value={wizardDraft.directoryUrl}
                  onChange={(event) => setWizardDraft((current) => ({ ...current, directoryUrl: event.target.value }))}
                  placeholder="https://school.edu/directory"
                />
                {wizardErrors.directoryUrl ? <div className="form-error">{wizardErrors.directoryUrl}</div> : null}
              </div>
            )}

            {(wizardDraft.runType === 'crawl' || wizardDraft.runType === 'both') && (
              <div className="field-group">
                <label className="input-label">Program Start URL</label>
                <input
                  value={wizardDraft.startUrl}
                  onChange={(event) => setWizardDraft((current) => ({ ...current, startUrl: event.target.value }))}
                  placeholder="https://school.edu/program"
                />
                {wizardErrors.startUrl ? <div className="form-error">{wizardErrors.startUrl}</div> : null}
              </div>
            )}

            {(wizardDraft.runType === 'crawl' || wizardDraft.runType === 'both') && (
              <div className="field-group">
                <label className="input-label">Stopping Behavior</label>
                <div className="radio-set">
                  <label>
                    <input
                      type="radio"
                      checked={wizardDraft.goalMode === 'target'}
                      onChange={() => setWizardDraft((current) => ({ ...current, goalMode: 'target' }))}
                    />
                    <span>Target number of people</span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      checked={wizardDraft.goalMode === 'everyone'}
                      onChange={() => setWizardDraft((current) => ({ ...current, goalMode: 'everyone' }))}
                    />
                    <span>No fixed goal / find everyone</span>
                  </label>
                </div>
                {wizardDraft.goalMode === 'target' && (
                  <>
                    <label className="input-label">People Goal</label>
                    <input
                      type="number"
                      min={1}
                      value={wizardDraft.peopleGoal}
                      onChange={(event) => setWizardDraft((current) => ({ ...current, peopleGoal: event.target.value }))}
                      placeholder="45"
                    />
                    {wizardErrors.peopleGoal ? <div className="form-error">{wizardErrors.peopleGoal}</div> : null}
                  </>
                )}
              </div>
            )}

            <div className="review-box" style={{ marginTop: '1.2rem' }}>
              <div className="review-row"><span>School</span><strong>{schools.find((school) => school.id === wizardDraft.schoolId)?.name ?? '—'}</strong></div>
              <div className="review-row"><span>Program</span><strong>{programs.find((program) => program.id === wizardDraft.programId)?.name ?? '—'}</strong></div>
              <div className="review-row"><span>Run</span><strong>{wizardDraft.runType === 'directory' ? 'Directory Search' : wizardDraft.runType === 'crawl' ? 'New Crawl' : 'New Crawl + Directory Search'}</strong></div>
              {(wizardDraft.runType === 'crawl' || wizardDraft.runType === 'both') && (
                <div className="review-row"><span>Program URL</span><strong>{wizardDraft.startUrl || '—'}</strong></div>
              )}
              {(wizardDraft.runType === 'directory' || wizardDraft.runType === 'both') && (
                <div className="review-row"><span>Directory URL</span><strong>{wizardDraft.directoryUrl || '—'}</strong></div>
              )}
              <div className="review-row"><span>Stopping Rule</span><strong>{wizardDraft.goalMode === 'everyone' ? 'No fixed goal / find everyone' : `Approximately ${wizardDraft.peopleGoal || '0'} people`}</strong></div>
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
