import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { authApi } from './api/auth'
import { schoolsApi } from './api/schools'
import { peopleApi } from './api/people'
import { applyRunEvent, mergeRun, rememberRun, restoreRun, runsApi, TERMINAL_EVENTS, type Connection } from './api/runs'
import { isFinished } from './api/runEvents'
import { ApiError, setUnauthorizedHandler } from './api/client'
import { AppShell } from './components/layout/AppShell'
import type { NavItem } from './components/layout/TopNav'
import { BackendUnavailableState } from './components/common/BackendUnavailableState'
import { LoadingState } from './components/common/LoadingState'
import { CrawlWizardPage, type CrawlRequest } from './pages/CrawlWizardPage'
import { HomePage } from './pages/HomePage'
import { LoginPage, type LoginResult } from './pages/LoginPage'
import { PastCrawlsPage } from './pages/PastCrawlsPage'
import { PersonPage } from './pages/PersonPage'
import { RunMonitorPage } from './pages/RunMonitorPage'
import { QueuePanel } from './components/run/QueuePanel'
import { useQueue } from './api/useQueue'
import { parseHash, toHash, type Route } from './app/route'
import type { School } from './types/school'
import type { Program } from './types/program'
import type { Person, PersonStatus } from './types/person'
import type { Run } from './types/run'
import { downloadWorkbook } from './utils/excel'

export type Screen = 'home' | 'data' | 'person' | 'run-monitor' | 'crawl' | 'history' | 'queue'

const roleOf = (person: Person) => person.trainingType ?? (person.category ? person.category[0].toUpperCase() + person.category.slice(1) : 'Unknown')

function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [schools, setSchools] = useState<School[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [peopleLoading, setPeopleLoading] = useState(false)
  const [selectedSchoolId, setSelectedSchoolId] = useState('')
  const [selectedProgramId, setSelectedProgramId] = useState('')
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [run, setRun] = useState<Run | null>(null)
  const [connection, setConnection] = useState<Connection>('connecting')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dataError, setDataError] = useState('')
  const [notice, setNotice] = useState('')
  const [exporting, setExporting] = useState(false)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | PersonStatus>('all')
  const stopWatching = useRef<(() => void) | null>(null)
  const watchingRunId = useRef<string | null>(null)
  // Schools run one at a time, so a crawl started while one is going joins the
  // queue. `busy` is what decides which of those the button offers.
  const { queue, busy: queueBusy, refresh: refreshQueue } = useQueue(isAuthenticated)

  const selectedSchool = useMemo(() => schools.find((school) => school.id === selectedSchoolId) ?? null, [schools, selectedSchoolId])
  const selectedPerson = useMemo(() => people.find((person) => person.id === selectedPersonId) ?? null, [people, selectedPersonId])
  const roles = useMemo(() => Array.from(new Set(people.map(roleOf))).sort(), [people])
  const filteredPeople = useMemo(() => people.filter((person) => {
    const term = query.toLowerCase()
    return (!term || person.name.toLowerCase().includes(term) || (person.email ?? '').toLowerCase().includes(term))
      && (roleFilter === 'all' || roleOf(person) === roleFilter)
      && (statusFilter === 'all' || person.status === statusFilter)
  }), [people, query, roleFilter, statusFilter])

  const syncQuery = (schoolId: string, programId: string) => {
    const url = new URL(window.location.href)
    if (schoolId) url.searchParams.set('school', schoolId)
    else url.searchParams.delete('school')
    if (programId) url.searchParams.set('program', programId)
    else url.searchParams.delete('program')
    window.history.replaceState(null, '', url)
  }

  /** Change screen and put it in the address bar, so a reload or the back button returns here. */
  const go = (next: Screen, runId?: string) => {
    setScreen(next)
    const hash = toHash(next, runId)
    if (window.location.hash !== hash) {
      window.history.pushState(null, '', `${window.location.pathname}${window.location.search}${hash}`)
    }
  }

  useEffect(() => () => stopWatching.current?.(), [])

  // The backend rejected the token mid-session: without this the page stayed
  // signed in while every request failed quietly and the live monitor went still.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      stopWatching.current?.()
      setIsAuthenticated(false)
      setRun(null)
      setNotice('Your session ended. Please sign in again.')
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  useEffect(() => {
    const init = async () => {
      try {
        const session = await authApi.getSession()
        setIsAuthenticated(session.authenticated)
        if (session.authenticated) {
          setSchools(await schoolsApi.listSchools())
          const params = new URLSearchParams(window.location.search)
          setSelectedSchoolId(params.get('school') ?? '')
          setSelectedProgramId(params.get('program') ?? '')
          routeRef.current(parseHash(window.location.hash), false)
        }
      } catch { setError('Could not establish a session with the backend.') } finally { setLoading(false) }
    }
    void init()
  }, [])

  useEffect(() => {
    if (!selectedSchoolId) { setPrograms([]); setPeople([]); return }
    syncQuery(selectedSchoolId, selectedProgramId)
    let cancelled = false
    setDataError(''); setPeople([]); setPeopleLoading(true)
    void Promise.all([
      schoolsApi.listPrograms(selectedSchoolId),
      selectedProgramId ? peopleApi.listPeopleForProgram(selectedProgramId) : peopleApi.listPeopleForSchool(selectedSchoolId),
    ])
      .then(([nextPrograms, nextPeople]) => {
        if (cancelled) return
        setPrograms(nextPrograms)
        if (selectedProgramId && !nextPrograms.some((program) => program.id === selectedProgramId)) {
          setSelectedProgramId('')
          return
        }
        setPeople(nextPeople)
      })
      .catch(() => { if (!cancelled) setDataError(`Could not load people for this ${selectedProgramId ? 'program' : 'school'}. Check the connection and try again.`) })
      .finally(() => { if (!cancelled) setPeopleLoading(false) })
    return () => { cancelled = true }
  }, [selectedSchoolId, selectedProgramId])

  const handleLogin = async (password: string): Promise<LoginResult> => {
    try {
      const session = await authApi.login({ password })
      if (!session.authenticated) return 'invalid'
      setNotice(''); setIsAuthenticated(true); setLoading(true)
      try {
        setSchools(await schoolsApi.listSchools())
      } finally { setLoading(false) }
      routeRef.current(parseHash(window.location.hash), false)
      return 'ok'
    } catch (caught) {
      setLoading(false)
      // A wrong password and an unreachable backend need different advice.
      return caught instanceof ApiError && (caught.status === 401 || caught.status === 403) ? 'invalid' : 'unreachable'
    }
  }
  const handleLogout = async () => {
    try { await authApi.logout() } catch { /* the token is dropped locally either way */ }
    stopWatching.current?.()
    setIsAuthenticated(false); setScreen('home'); setRun(null); setPeople([]); setPrograms([])
    setSelectedSchoolId(''); setSelectedProgramId(''); setNotice('')
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  }

  /**
   * Stop the run being watched, or take a waiting one out of the queue.
   *
   * The backend records the intent and returns; the workers then unwind on
   * their own clock, so the row can still read `running` for a moment after.
   * Polling briefly for a settled status keeps the monitor from sitting on a
   * stale "running" — and because `cancelRun` treats an already-stopped run
   * as success, pressing stop twice is not an error either.
   */
  const stopRun = async () => {
    if (!run) return
    const runId = run.id
    await runsApi.cancelRun(runId)

    const apply = (latest: Run) => setRun((current) => {
      if (!current || current.id !== runId) return current
      const next = { ...mergeRun(current, latest), progress: 100 }
      rememberRun(next)
      return next
    })

    let latest = await runsApi.getRun(runId)
    apply(latest)
    for (let attempt = 0; attempt < 10 && !isFinished(latest.status); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      latest = await runsApi.getRun(runId)
      apply(latest)
    }
    // Whatever was waiting behind it may now have started.
    refreshQueue()
  }
  const selectSchool = (id: string) => { setSelectedSchoolId(id); setSelectedProgramId(''); setQuery(''); setRoleFilter('all'); setStatusFilter('all'); setDataError(''); syncQuery(id, '') }

  /**
   * Follow a run's event stream. The subscription lives here rather than in the
   * monitor page so that leaving the page does not end it; returning to an
   * already-watched run re-uses the open stream instead of restarting it.
   *
   * Everything a watcher does is scoped to the run it was opened for. Starting a
   * second crawl while the first is being watched used to leave the first
   * watcher running, and its events and polls were applied to whichever run was
   * on screen — the monitor showed one crawl's spend under another's name.
   */
  const watchRun = (runId: string) => {
    if (watchingRunId.current === runId && stopWatching.current) return
    stopWatching.current?.()
    setConnection('connecting')
    let closed = false
    const apply = (update: (current: Run) => Run) =>
      setRun((current) => (!closed && current && current.id === runId ? update(current) : current))

    const refresh = async () => {
      const latest = await runsApi.getRun(runId)
      if (closed) return
      apply((current) => {
        const merged = mergeRun(current, latest)
        const settled = isFinished(latest.status) ? { ...merged, progress: 100 } : merged
        rememberRun(settled)
        return settled
      })
      if (isFinished(latest.status)) cleanup()
    }
    const unsubscribe = runsApi.subscribeToRun(
      runId,
      (event) => {
        apply((current) => {
          const next = applyRunEvent(current, event)
          rememberRun(next)
          return next
        })
        if (TERMINAL_EVENTS.has(event.type)) void refresh().catch(() => undefined)
        if (event.type === 'run_started' || TERMINAL_EVENTS.has(event.type)) refreshQueue()
      },
      (state) => { if (!closed) setConnection(state) },
    )
    const poll = window.setInterval(() => { void refresh().catch(() => undefined) }, 5000)
    const cleanup = () => {
      if (closed) return
      closed = true
      window.clearInterval(poll)
      unsubscribe()
      if (watchingRunId.current === runId) watchingRunId.current = null
      if (stopWatching.current === cleanup) stopWatching.current = null
    }
    watchingRunId.current = runId
    stopWatching.current = cleanup
    void refresh().catch(() => undefined)
  }

  const openRun = async (runId: string, push = true) => {
    const loaded = await runsApi.getRun(runId)
    // The feed and the per-page tallies are not in the row, so a run reopened
    // from history is rebuilt from what the stream last showed for it.
    const restored = restoreRun(loaded)
    if (watchingRunId.current && watchingRunId.current !== runId) stopWatching.current?.()
    setRun((current) => mergeRun(current, restored))
    if (push) go('run-monitor', runId)
    else setScreen('run-monitor')
    if (!isFinished(loaded.status)) watchRun(runId)
  }

  const openFromRoute = (runId: string, push: boolean) => {
    void openRun(runId, push).catch(() => {
      setDataError('Could not open that crawl. It may have been removed.')
      go('history')
    })
  }

  const navigateToCrawl = async (push = true) => {
    const nextSchools = await schoolsApi.listSchools().catch(() => schools)
    setSchools(nextSchools)
    if (push) go('crawl')
    else setScreen('crawl')
  }

  /** Put the app on the screen an address names: the first load, and the back button. */
  const applyRoute = (route: Route, push: boolean) => {
    if (route.screen === 'run-monitor' && route.runId) { openFromRoute(route.runId, push); return }
    if (route.screen === 'crawl') { void navigateToCrawl(push); return }
    setScreen(route.screen)
  }
  // The latest `applyRoute`, for the listeners registered once above.
  const routeRef = useRef(applyRoute)
  routeRef.current = applyRoute
  useEffect(() => {
    const onPop = () => { if (isAuthenticated) routeRef.current(parseHash(window.location.hash), false) }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [isAuthenticated])

  /**
   * Queue one crawl per school, in the order chosen, then show the first: its
   * monitor when there is one, the queue when there are several. A run that is
   * only waiting is still watched, so it flips to running on its own.
   */
  const startCrawls = async (requests: CrawlRequest[]) => {
    const started: Run[] = []
    try {
      for (const request of requests) {
        const job = await runsApi.startRun({
          schoolId: request.schoolId, schoolUrl: request.schoolUrl, schoolName: request.schoolName, label: request.label,
          maxSpendUsd: request.maxSpendUsd, maxPeople: request.maxPeople, maxTrainees: request.maxTrainees, maxEmails: request.maxEmails,
          includeDirectory: request.includeDirectory,
          priorityUrls: request.priorityUrls,
        })
        started.push({
          ...job, schoolId: request.schoolId || undefined, schoolName: request.schoolName, label: request.label,
          runType: request.includeDirectory ? 'New Crawl + Directory Search' : 'New Crawl',
        })
      }
    } catch (caught) {
      refreshQueue()
      const reason = caught instanceof ApiError && caught.message ? caught.message : 'the backend could not be reached'
      // Say what did get queued: those crawls exist and will run.
      throw new Error(started.length
        ? `${started.length} of ${requests.length} schools were queued, then it stopped: ${reason}. See the queue for what was added.`
        : reason)
    }
    refreshQueue()
    const [first] = started
    if (started.length === 1) {
      stopWatching.current?.()
      setRun(first); rememberRun(first)
      go('run-monitor', first.id)
      watchRun(first.id)
    } else {
      go('queue')
    }
  }

  const exportPeople = () => {
    setExporting(true)
    try {
      const program = selectedProgramId ? (programs.find((p) => p.id === selectedProgramId)?.name ?? 'program') : 'all-programs'
      downloadWorkbook('People', [
        { label: 'Name', value: (person: Person) => person.name }, { label: 'Role', value: (person: Person) => roleOf(person) },
        { label: 'Position', value: (person: Person) => person.position }, { label: 'Year', value: (person: Person) => person.year },
        { label: 'Specialty', value: (person: Person) => person.specialty }, { label: 'Email', value: (person: Person) => person.email },
        { label: 'Status', value: (person: Person) => person.status }, { label: 'Last seen', value: (person: Person) => person.lastVerified },
      ], filteredPeople, `${safeFileName(`${selectedSchool?.name ?? 'school'}-${program}-people`)}.xlsx`)
    } catch { setDataError('Could not create the Excel workbook. Please try again.') } finally { setExporting(false) }
  }

  if (!isAuthenticated) return <LoginPage onLogin={handleLogin} notice={notice} />
  if (loading) return <LoadingState message="Loading residency data…" />
  if (error) return <BackendUnavailableState />

  const viewResults = () => {
    const id = run?.schoolId ?? schools.find((school) => school.name === run?.schoolName)?.id
    go('data')
    if (id) selectSchool(id)
  }

  const active: NavItem | undefined = ({ home: 'home', data: 'data', person: 'data', history: 'history', queue: 'queue', 'run-monitor': 'queue', crawl: 'crawl' } as const)[screen]

  return <AppShell active={active} onLogout={handleLogout} onNavigateHome={() => go('home')} onNavigateSchools={() => go('data')} onNavigateHistory={() => go('history')} onNavigateCrawl={() => { void navigateToCrawl() }} onNavigateQueue={() => go('queue')} crawlLabel={queueBusy ? 'Add to Queue' : 'Run Crawl'} statusText="Backend online">
    {screen === 'home' && <HomePage
      schools={schools} queue={queue} onOpenRun={(id) => openFromRoute(id, true)}
      onViewData={() => go('data')} onViewCrawls={() => go('queue')} onStartCrawl={() => { void navigateToCrawl() }}
    />}
    {screen === 'data' && <main className="page-shell">
      <div className="page-header-row"><h2>Past data</h2><div className="modal-actions">
        <button className="secondary-button" onClick={() => go('history')}>Past crawls</button>
        <button className="secondary-button" onClick={() => go('home')}>← Home</button>
      </div></div>
      <div className="panel-block"><div className="table-controls" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="field-group" style={{ marginTop: 0 }}>
          <label className="input-label" htmlFor="school-select">School</label>
          <select id="school-select" value={selectedSchoolId} onChange={(event) => selectSchool(event.target.value)}>
            <option value="">Select a school</option>
            {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
          </select>
        </div>
        {selectedSchoolId && <div className="field-group" style={{ marginTop: 0 }}>
          <label className="input-label" htmlFor="program-select">Program</label>
          <select id="program-select" value={selectedProgramId} onChange={(event) => setSelectedProgramId(event.target.value)}>
            <option value="">All programs</option>
            {programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
          </select>
          {programs.length === 0 && !peopleLoading && <span className="muted">No programs are available for this school.</span>}
        </div>}
      </div></div>
      {!selectedSchoolId && <div className="empty-state">Select a school to view people.</div>}
      {dataError && <div className="error-banner">{dataError}</div>}
      {selectedSchoolId && selectedSchool && <>
        <div className="summary-row">
          <div className="summary-card"><div className="summary-label">People shown</div><div className="summary-value">{filteredPeople.length}</div></div>
          <div className="summary-card"><div className="summary-label">Residents</div><div className="summary-value">{filteredPeople.filter((person) => person.trainingType === 'Resident').length}</div></div>
          <div className="summary-card"><div className="summary-label">Fellows</div><div className="summary-value">{filteredPeople.filter((person) => person.trainingType === 'Fellow').length}</div></div>
        </div>
        <div className="table-panel">
          <div className="table-controls">
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" aria-label="Search name or email" />
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Role">
              <option value="all">All roles</option>
              {roles.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | PersonStatus)} aria-label="Status">
              <option value="all">All statuses</option><option value="new">New</option><option value="active">Active</option><option value="changed">Changed</option><option value="stale">Stale</option>
            </select>
            <button className="secondary-button" onClick={exportPeople} disabled={exporting || filteredPeople.length === 0}>{exporting ? 'Preparing Excel…' : 'Download Excel'}</button>
          </div>
          {peopleLoading && <div className="empty-state">Loading people…</div>}
          {!peopleLoading && !dataError && people.length === 0 && (
            <div className="empty-state">No people have been collected for this {selectedProgramId ? 'program' : 'school'} yet. <button type="button" className="text-button" onClick={() => { void navigateToCrawl() }}>Start a new crawl</button></div>
          )}
          {!peopleLoading && people.length > 0 && filteredPeople.length === 0 && <div className="empty-state">No one matches these filters.</div>}
          {filteredPeople.length > 0 && <div className="table-wrap"><table>
            <thead><tr><th>Name</th><th>Role</th><th>Position</th><th>Year</th><th>Specialty</th><th>Email</th><th>Status</th><th>Last seen</th></tr></thead>
            <tbody>{filteredPeople.map((person) => <tr key={person.id} className="clickable-row" onClick={() => { setSelectedPersonId(person.id); setScreen('person') }}>
              <td>{person.name}</td><td>{roleOf(person)}</td><td>{person.position ?? '—'}</td><td>{person.year ?? '—'}</td><td>{person.specialty ?? '—'}</td><td>{person.email ?? '—'}</td>
              <td><span className={`status-badge ${person.status}`}>{person.status}</span></td><td>{formatDate(person.lastVerified)}</td>
            </tr>)}</tbody>
          </table></div>}
        </div>
      </>}
    </main>}
    {screen === 'queue' && <main className="page-shell">
      <div className="page-header-row"><h2>Running crawls</h2><div className="modal-actions">
        <button className="primary-button" onClick={() => { void navigateToCrawl() }}>Start a new crawl</button>
        <button className="secondary-button" onClick={() => go('home')}>← Home</button>
      </div></div>
      <section className="panel-block"><QueuePanel onOpenRun={(id) => openFromRoute(id, true)} /></section>
    </main>}
    {screen === 'history' && <>
      {dataError && <div className="page-shell"><div className="error-banner">{dataError}</div></div>}
      <PastCrawlsPage activeRun={run} onBack={() => go('data')} onOpenRun={(id) => openFromRoute(id, true)} />
    </>}
    {screen === 'person' && selectedPerson && <PersonPage school={selectedSchool ?? undefined} person={selectedPerson} onBack={() => setScreen('data')} />}
    {screen === 'run-monitor' && run && <RunMonitorPage
      run={run} connection={connection}
      onBack={() => go('home')} onOpenQueue={() => go('queue')} onViewResults={viewResults}
      onResume={() => watchRun(run.id)} onStop={stopRun}
    />}
    {screen === 'run-monitor' && !run && <main className="page-shell"><div className="empty-state">Opening the crawl…</div></main>}
    {screen === 'crawl' && <CrawlWizardPage
      schools={schools} initialSchoolId={selectedSchoolId} queueBusy={queueBusy}
      onCancel={() => go('home')} onStart={startCrawls} onOpenRun={(id) => openFromRoute(id, true)}
    />}
  </AppShell>
}
function formatDate(value?: string | null) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString() }
function safeFileName(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'export' }
export default App
