import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { authApi } from './api/auth'
import { schoolsApi } from './api/schools'
import { peopleApi } from './api/people'
import { applyRunEvent, runsApi, TERMINAL_EVENTS } from './api/runs'
import { ApiError } from './api/client'
import { AppShell } from './components/layout/AppShell'
import { BackendUnavailableState } from './components/common/BackendUnavailableState'
import { LoadingState } from './components/common/LoadingState'
import { LoginPage } from './pages/LoginPage'
import { PastCrawlsPage } from './pages/PastCrawlsPage'
import { PersonPage } from './pages/PersonPage'
import { RunMonitorPage } from './pages/RunMonitorPage'
import { DirectoryDashGame } from './components/game/DirectoryDashGame'
import type { School } from './types/school'
import type { Program } from './types/program'
import type { Person, PersonStatus } from './types/person'
import type { Run } from './types/run'
import { downloadWorkbook } from './utils/excel'

export type Screen = 'main' | 'person' | 'run-monitor' | 'crawl' | 'history' | 'game'
type WizardDraft = { schoolId: string; schoolUrl: string; maxSpendUsd: string; maxPeople: string; maxTrainees: string; maxEmails: string; forceRescan: boolean; includeDirectory: boolean }
const createWizardDraft = (schoolId = '', schoolUrl = ''): WizardDraft => ({ schoolId, schoolUrl, maxSpendUsd: '10', maxPeople: '', maxTrainees: '', maxEmails: '', forceRescan: false, includeDirectory: false })
/** A whole-number limit from a form field; blank means no limit, anything else invalid. */
const parseLimit = (value: string): number | null | undefined => {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}
const LIMIT_FIELDS = [
  { key: 'maxPeople', label: 'People', hint: 'Everyone collected' },
  { key: 'maxTrainees', label: 'Residents & fellows', hint: 'Trainees collected' },
  { key: 'maxEmails', label: 'With an email', hint: 'People with an address' },
] as const
const terminal = (status?: string) => ['completed', 'failed', 'cancelled', 'stopped_at_limit'].includes(status ?? '')

function App() {
  const [screen, setScreen] = useState<Screen>('main')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [schools, setSchools] = useState<School[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [selectedSchoolId, setSelectedSchoolId] = useState('')
  const [selectedProgramId, setSelectedProgramId] = useState('')
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [run, setRun] = useState<Run | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dataError, setDataError] = useState('')
  const [wizardError, setWizardError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [wizardDraft, setWizardDraft] = useState<WizardDraft>(createWizardDraft())
  const [query, setQuery] = useState('')
  const [trainingFilter, setTrainingFilter] = useState<'all' | 'Resident' | 'Fellow'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | PersonStatus>('all')
  const stopWatching = useRef<(() => void) | null>(null)

  const selectedSchool = useMemo(() => schools.find((school) => school.id === selectedSchoolId) ?? null, [schools, selectedSchoolId])
  const selectedPerson = useMemo(() => people.find((person) => person.id === selectedPersonId) ?? null, [people, selectedPersonId])
  const filteredPeople = useMemo(() => people.filter((person) => {
    const term = query.toLowerCase()
    return (!term || person.name.toLowerCase().includes(term) || (person.email ?? '').toLowerCase().includes(term))
      && (trainingFilter === 'all' || person.trainingType === trainingFilter)
      && (statusFilter === 'all' || person.status === statusFilter)
  }), [people, query, trainingFilter, statusFilter])

  const syncQuery = (schoolId: string, programId: string) => {
    const url = new URL(window.location.href)
    if (schoolId) url.searchParams.set('school', schoolId)
    else url.searchParams.delete('school')
    if (programId) url.searchParams.set('program', programId)
    else url.searchParams.delete('program')
    window.history.replaceState(null, '', url)
  }

  useEffect(() => () => stopWatching.current?.(), [])
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
        }
      } catch { setError('Could not establish a session with the backend.') } finally { setLoading(false) }
    }
    void init()
  }, [])

  useEffect(() => {
    if (!selectedSchoolId) { setPrograms([]); setPeople([]); return }
    syncQuery(selectedSchoolId, selectedProgramId)
    let cancelled = false
    setDataError(''); setPeople([])
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
      .catch(() => { if (!cancelled) setDataError('Could not load people for this program.') })
    return () => { cancelled = true }
  }, [selectedSchoolId, selectedProgramId])

  const handleLogin = async (password: string) => {
    try {
      const session = await authApi.login({ password })
      if (!session.authenticated) return false
      setIsAuthenticated(true); setScreen('main'); setLoading(true)
      setSchools(await schoolsApi.listSchools()); setLoading(false)
      return true
    } catch { setLoading(false); return false }
  }
  const handleLogout = async () => { await authApi.logout(); stopWatching.current?.(); setIsAuthenticated(false); setScreen('main'); setRun(null); setPeople([]); setPrograms([]); setSelectedSchoolId(''); setSelectedProgramId('') }
  const stopRun = async () => {
    if (!run) return
    await runsApi.cancelRun(run.id)
    const latest = await runsApi.getRun(run.id)
    setRun((current) => ({ ...(current ?? latest), ...latest, progress: 100 }))
  }
  const selectSchool = (id: string) => { setSelectedSchoolId(id); setSelectedProgramId(''); setQuery(''); setDataError(''); syncQuery(id, '') }

  const watchRun = (runId: string) => {
    stopWatching.current?.()
    let closed = false
    const refresh = async () => {
      const latest = await runsApi.getRun(runId)
      setRun((current) => ({ ...(current ?? latest), ...latest, progress: terminal(latest.status) ? 100 : current?.progress }))
      if (terminal(latest.status)) cleanup()
    }
    const unsubscribe = runsApi.subscribeToRun(runId, (event) => {
      setRun((current) => current ? applyRunEvent(current, event) : current)
      if (TERMINAL_EVENTS.has(event.type)) void refresh()
    })
    const poll = window.setInterval(() => { void refresh().catch(() => undefined) }, 5000)
    const cleanup = () => { if (closed) return; closed = true; window.clearInterval(poll); unsubscribe(); if (stopWatching.current === cleanup) stopWatching.current = null }
    stopWatching.current = cleanup
  }

  const navigateToCrawl = async () => {
    const nextSchools = await schoolsApi.listSchools().catch(() => schools)
    setSchools(nextSchools)
    const school = nextSchools.find((item) => item.id === selectedSchoolId)
    setWizardDraft(createWizardDraft(selectedSchoolId, school?.canonicalUrl ?? ''))
    setWizardError(''); setScreen('crawl')
  }
  const handleSubmitWizard = async () => {
    const schoolUrl = wizardDraft.schoolUrl.trim()
    if (!schoolUrl) { setWizardError('Choose a school or enter a school URL.'); return }
    const budget = wizardDraft.maxSpendUsd ? Number(wizardDraft.maxSpendUsd) : null
    if (budget !== null && (!Number.isFinite(budget) || budget <= 0)) { setWizardError('Budget must be greater than zero.'); return }
    const maxPeople = parseLimit(wizardDraft.maxPeople)
    const maxTrainees = parseLimit(wizardDraft.maxTrainees)
    const maxEmails = parseLimit(wizardDraft.maxEmails)
    if (maxPeople === undefined || maxTrainees === undefined || maxEmails === undefined) { setWizardError('Limits must be whole numbers above zero, or left blank for no limit.'); return }
    try {
      setWizardError('')
      const school = schools.find((item) => item.id === wizardDraft.schoolId)
      const schoolName = school?.name ?? hostOf(schoolUrl)
      const includeDirectory = wizardDraft.includeDirectory && Boolean(school?.directoryUrl)
      const job = await runsApi.startRun({ schoolId: wizardDraft.schoolId, schoolUrl, schoolName, maxSpendUsd: budget, maxPeople, maxTrainees, maxEmails, forceRescan: wizardDraft.forceRescan, includeDirectory })
      setRun({ ...job, schoolId: wizardDraft.schoolId || undefined, schoolName, runType: includeDirectory ? 'New Crawl + Directory Search' : 'New Crawl' })
      setScreen('run-monitor'); watchRun(job.id)
    } catch (caught) {
      // Anyone signed in can start a crawl; show what the backend said went
      // wrong (an uncrawled school for a directory search, a bad URL) instead.
      setWizardError(caught instanceof ApiError && caught.message ? caught.message : 'Could not start the crawl. Check the URL and backend connection, then try again.')
    }
  }
  const exportPeople = () => {
    setExporting(true)
    try {
      downloadWorkbook('People', [
        { label: 'Name', value: (person: Person) => person.name }, { label: 'Role', value: (person: Person) => person.trainingType ?? person.category },
        { label: 'Position', value: (person: Person) => person.position }, { label: 'Year', value: (person: Person) => person.year },
        { label: 'Specialty', value: (person: Person) => person.specialty }, { label: 'Email', value: (person: Person) => person.email },
        { label: 'Status', value: (person: Person) => person.status }, { label: 'Last seen', value: (person: Person) => person.lastVerified },
      ], filteredPeople, safeFileName(`${selectedSchool?.name ?? 'school'}-${selectedProgramId ? programs.find((p) => p.id === selectedProgramId)?.name ?? 'program' : 'all-programs'}-people.xlsx`))
    } catch { setDataError('Could not create the Excel workbook. Please try again.') } finally { setExporting(false) }
  }

  if (!isAuthenticated) return <LoginPage onLogin={handleLogin} />
  if (loading) return <LoadingState message="Loading residency data…" />
  if (error) return <BackendUnavailableState />
  return <AppShell onLogout={handleLogout} onNavigateSchools={() => setScreen('main')} onNavigateHistory={() => setScreen('history')} onNavigateGame={() => setScreen('game')} onNavigateCrawl={() => { void navigateToCrawl() }} statusText="Backend online">
    {screen === 'main' && <main className="page-shell">
      <div className="page-header-row"><div><div className="breadcrumb">Schools</div><h2>Residency Data</h2></div></div>
      <div className="panel-block"><div className="table-controls" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="field-group" style={{ marginTop: 0 }}><label className="input-label">School</label><select value={selectedSchoolId} onChange={(event) => selectSchool(event.target.value)}><option value="">Select a school</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></div>
        {selectedSchoolId && <div className="field-group" style={{ marginTop: 0 }}><label className="input-label">Program</label><select value={selectedProgramId} onChange={(event) => setSelectedProgramId(event.target.value)}><option value="">All programs</option>{programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select>{programs.length === 0 && <span className="muted">No programs are available for this school.</span>}</div>}
      </div></div>
      {!selectedSchoolId && <div className="empty-state">Select a school to view people.</div>}
      {dataError && <div className="error-banner">{dataError}</div>}
      {selectedSchoolId && selectedSchool && <><div className="summary-row"><div className="summary-card"><div className="summary-label">People shown</div><div className="summary-value">{filteredPeople.length}</div></div><div className="summary-card"><div className="summary-label">Residents</div><div className="summary-value">{filteredPeople.filter((person) => person.trainingType === 'Resident').length}</div></div><div className="summary-card"><div className="summary-label">Fellows</div><div className="summary-value">{filteredPeople.filter((person) => person.trainingType === 'Fellow').length}</div></div></div>
        <div className="table-panel"><div className="table-controls"><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" /><select value={trainingFilter} onChange={(event) => setTrainingFilter(event.target.value as 'all' | 'Resident' | 'Fellow')}><option value="all">All roles</option><option value="Resident">Resident</option><option value="Fellow">Fellow</option></select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | PersonStatus)}><option value="all">All statuses</option><option value="new">New</option><option value="active">Active</option><option value="stale">Stale</option></select><button className="secondary-button" onClick={exportPeople} disabled={exporting}>{exporting ? 'Preparing Excel…' : 'Download Excel'}</button></div><div className="table-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Position</th><th>Year</th><th>Specialty</th><th>Email</th><th>Status</th><th>Last seen</th></tr></thead><tbody>{filteredPeople.map((person) => <tr key={person.id} className="clickable-row" onClick={() => { setSelectedPersonId(person.id); setScreen('person') }}><td>{person.name}</td><td>{person.trainingType ?? person.category ?? '—'}</td><td>{person.position ?? '—'}</td><td>{person.year ?? '—'}</td><td>{person.specialty ?? '—'}</td><td>{person.email ?? '—'}</td><td><span className={`status-badge ${person.status}`}>{person.status}</span></td><td>{formatDate(person.lastVerified)}</td></tr>)}</tbody></table></div></div></>}
    </main>}
    {screen === 'history' && <PastCrawlsPage activeRun={run} onBack={() => setScreen('main')} onOpenRun={(id) => { void runsApi.getRun(id).then((loaded) => { setRun(loaded); setScreen('run-monitor'); if (!terminal(loaded.status)) watchRun(id) }).catch(() => setDataError('Could not open crawl details.')) }} />}
    {screen === 'person' && selectedPerson && <PersonPage school={selectedSchool ?? undefined} person={selectedPerson} onBack={() => setScreen('main')} />}
    {screen === 'game' && <DirectoryDashGame schoolName={selectedSchool?.name ?? 'Directory Dash'} status="ready" peopleFound={0} emailsFound={0} runFinished={false} onClose={() => setScreen('main')} />}
    {screen === 'run-monitor' && run && <RunMonitorPage run={run} onBack={() => setScreen('main')} onViewResults={() => { setScreen('main'); if (run.schoolId) selectSchool(run.schoolId) }} onStartGame={() => undefined} onResume={() => watchRun(run.id)} onStop={stopRun} />}
    {screen === 'crawl' && (() => {
      const crawlSchool = schools.find((school) => school.id === wizardDraft.schoolId)
      return <main className="page-shell narrow-shell">
        <div className="page-header-row"><div><div className="breadcrumb">Run Crawl</div><h2>Run Crawl</h2></div></div>
        <section className="panel-block">
          <div className="field-group"><label className="input-label">School</label><select value={wizardDraft.schoolId} onChange={(event) => { const school = schools.find((item) => item.id === event.target.value); setWizardDraft((current) => ({ ...current, schoolId: event.target.value, schoolUrl: school?.canonicalUrl ?? '', includeDirectory: false })) }}><option value="">New school — enter URL below</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></div>
          <div className="field-group"><label className="input-label">School URL</label><input value={wizardDraft.schoolUrl} onChange={(event) => setWizardDraft((current) => ({ ...current, schoolUrl: event.target.value, includeDirectory: false }))} placeholder="https://school.edu" /></div>
          {crawlSchool?.directoryUrl && <div className="field-group"><label className="input-label">Optional operation</label><label className="checkbox-row"><input type="checkbox" checked={wizardDraft.includeDirectory} onChange={(event) => setWizardDraft((current) => ({ ...current, includeDirectory: event.target.checked }))} /><span>Also search the school directory</span></label></div>}
          <div className="field-group"><label className="input-label">Budget (USD)</label><input type="number" min={1} value={wizardDraft.maxSpendUsd} onChange={(event) => setWizardDraft((current) => ({ ...current, maxSpendUsd: event.target.value }))} placeholder="10" /></div>
          <div className="field-group"><span className="input-label">Stop crawling after</span><div className="limit-grid">{LIMIT_FIELDS.map((field) => <label key={field.key} className="limit-field" htmlFor={`limit-${field.key}`}><span>{field.label}</span><input id={`limit-${field.key}`} type="number" min={1} step={1} inputMode="numeric" value={wizardDraft[field.key]} onChange={(event) => setWizardDraft((current) => ({ ...current, [field.key]: event.target.value }))} placeholder="No limit" /><small>{field.hint}</small></label>)}</div><small>Whichever limit is reached first ends the crawl. A directory search still runs on the people already found; the budget stops everything.</small></div>
          <label className="checkbox-row"><input type="checkbox" checked={wizardDraft.forceRescan} onChange={(event) => setWizardDraft((current) => ({ ...current, forceRescan: event.target.checked }))} /><span>Force rescan</span></label>
          <div className="review-box"><div className="review-row"><span>Operation</span><strong>{wizardDraft.includeDirectory && crawlSchool?.directoryUrl ? 'Crawl + Directory Search' : 'Crawl'}</strong></div><div className="review-row"><span>School</span><strong>{crawlSchool?.name ?? wizardDraft.schoolUrl ?? '—'}</strong></div><div className="review-row"><span>Stops at</span><strong>{[wizardDraft.maxSpendUsd && `$${wizardDraft.maxSpendUsd}`, wizardDraft.maxPeople && `${wizardDraft.maxPeople} people`, wizardDraft.maxTrainees && `${wizardDraft.maxTrainees} residents & fellows`, wizardDraft.maxEmails && `${wizardDraft.maxEmails} emails`].filter(Boolean).join(' · ') || 'No limit'}</strong></div></div>
          {wizardError && <div className="error-banner">{wizardError}</div>}
          <div className="modal-actions"><button className="secondary-button" onClick={() => setScreen('main')}>Cancel</button><button className="primary-button" onClick={() => void handleSubmitWizard()}>Start Crawl</button></div>
        </section>
      </main>
    })()}
  </AppShell>
}
function formatDate(value?: string | null) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString() }
function hostOf(url: string) { try { return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname } catch { return url } }
function safeFileName(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'export.xlsx' }
export default App
