import { apiFetch, artifactUrl, fetchAllPages, isMockMode } from './client'
import type { Person, PersonStatus, PersonVersion, TrainingType } from '../types/person'
import type { SourceProvenance } from '../types/source'
import { mockPeople } from '../mocks/people'

/**
 * The backend collects everyone published on a site, not only trainees, and
 * labels each person with a `category` plus their printed `position`.
 */
type Category = 'resident' | 'fellow' | 'faculty' | 'staff' | 'student' | 'alumni' | 'unknown'

interface PersonResponse {
  id: string
  site_id: string
  program_id?: string | null
  hospital?: string | null
  full_name?: string | null
  email?: string | null
  category: Category
  position?: string | null
  area?: string | null
  year?: number | null
  pgy?: number | null
  pgy_capture_date?: string | null
  status: string
  confidence: number
  version_count: number
  first_seen_at: string
  last_seen_at: string
  last_changed_at?: string | null
  missing_since?: string | null
  screenshot_available: boolean
  roles?: Category[] | null
  roles_checked_at?: string | null
}

interface VersionResponse {
  id: string
  version_no: number
  changed_fields: { field: string; previous?: unknown; current?: unknown }[]
  captured_at: string
  source_url: string
  screenshot_available: boolean
  screenshot_url?: string | null
}

interface SourceResponse {
  source_url: string
  page_title?: string | null
  captured_at: string
  extraction_method: string
  confidence: number
  screenshot_available: boolean
  screenshot_url?: string | null
  screenshot_width?: number | null
  screenshot_height?: number | null
  field_locations?: Record<string, { x: number; y: number; width: number; height: number }> | null
}

const TRAINING_TYPE: Partial<Record<Category, TrainingType>> = {
  resident: 'Resident',
  fellow: 'Fellow',
}

/** Backend statuses map onto the four the UI renders. `changed` is kept apart from `active`. */
const toStatus = (status: string): PersonStatus => {
  if (status === 'missing') return 'stale'
  if (status === 'new') return 'new'
  if (status === 'changed') return 'changed'
  return 'active'
}

const toPerson = (raw: PersonResponse): Person => ({
  id: raw.id,
  schoolId: raw.site_id,
  programId: raw.program_id ?? undefined,
  name: raw.full_name ?? '',
  email: raw.email ?? undefined,
  trainingType: TRAINING_TYPE[raw.category],
  category: raw.category,
  // Exactly what the page printed. Blank means the page did not say.
  position: raw.position ?? undefined,
  year: raw.pgy != null ? `PGY-${raw.pgy}` : undefined,
  graduationYear: raw.year != null ? String(raw.year) : undefined,
  specialty: raw.area ?? undefined,
  status: toStatus(raw.status),
  lastVerified: raw.last_seen_at,
  capturedAt: raw.pgy_capture_date ?? raw.last_seen_at,
  sourceAvailable: raw.screenshot_available,
  confidence: raw.confidence,
  isMissing: raw.status === 'missing',
  roles: raw.roles ?? undefined,
  rolesCheckedAt: raw.roles_checked_at ?? undefined,
})

/** Missing people stay in the table but sort to the bottom. */
const missingLast = (a: Person, b: Person) =>
  Number(a.isMissing ?? false) - Number(b.isMissing ?? false)

export const peopleApi = {
  async listPeopleForSchool(schoolId: string): Promise<Person[]> {
    if (isMockMode()) {
      return Promise.resolve(
        Object.values(mockPeople)
          .flat()
          .filter((person) => person.schoolId === schoolId)
          .sort(missingLast),
      )
    }

    const rows = await fetchAllPages<PersonResponse>(`/schools/${schoolId}/people`)
    return rows.map(toPerson).sort(missingLast)
  },

  async listPeopleForProgram(programId: string): Promise<Person[]> {
    if (isMockMode()) {
      return Promise.resolve(Object.values(mockPeople).flat().filter((person) => person.programId === programId).sort(missingLast))
    }
    const rows = await fetchAllPages<PersonResponse>(`/programs/${programId}/people`)
    return rows.map(toPerson).sort(missingLast)
  },

  async getPerson(id: string): Promise<Person> {
    if (isMockMode()) {
      const person = Object.values(mockPeople)
        .flat()
        .find((item) => item.id === id)
      if (!person) throw new Error('Person not found')
      return person
    }

    return toPerson(await apiFetch<PersonResponse>(`/people/${id}`))
  },

  async getVersions(personId: string): Promise<PersonVersion[]> {
    if (isMockMode()) {
      const person = await this.getPerson(personId)
      return person.versionHistory ?? []
    }

    const rows = await apiFetch<VersionResponse[]>(`/people/${personId}/versions`)
    return rows.flatMap((version) =>
      (version.changed_fields ?? []).map((change, index) => ({
        id: `${version.id}-${index}`,
        date: version.captured_at,
        field: `${change.field} changed`,
        oldValue: change.previous == null ? undefined : String(change.previous),
        newValue: change.current == null ? undefined : String(change.current),
        sourceUrl: version.source_url,
      })),
    )
  },

  async getSource(personId: string): Promise<SourceProvenance> {
    if (isMockMode()) {
      const person = await this.getPerson(personId)
      return {
        sourceUrl: person.sourceUrl ?? '',
        capturedAt: person.capturedAt ?? person.lastVerified,
        sourceSnippet: person.sourceSnippet ?? person.extractedText ?? '',
      }
    }

    const raw = await apiFetch<SourceResponse>(`/people/${personId}/source`)
    return {
      sourceUrl: raw.source_url,
      pageTitle: raw.page_title ?? undefined,
      capturedAt: raw.captured_at,
      extractionMethod: raw.extraction_method,
      confidence: raw.confidence,
      screenshotAvailable: raw.screenshot_available,
      // Already signed and time-limited, so it can go straight in an <img>.
      screenshotUrl: artifactUrl(raw.screenshot_url) ?? undefined,
      screenshotWidth: raw.screenshot_width ?? undefined,
      screenshotHeight: raw.screenshot_height ?? undefined,
      fieldLocations: raw.field_locations ?? undefined,
    }
  },

  /**
   * Re-check already-scraped records' role labels against their stored
   * source page. Manual only — give `siteId` to check everything currently
   * on file for that school, or `recordIds` to check just those rows.
   * Returns immediately with a job id; poll `getVerificationStatus`.
   */
  async startVerification(params: { siteId?: string; recordIds?: string[] }): Promise<VerificationJob> {
    if (isMockMode()) {
      return Promise.resolve({
        id: 'mock-verify-job', status: 'completed',
        recordsTotal: params.recordIds?.length ?? 0,
        recordsChecked: params.recordIds?.length ?? 0,
        recordsCorrected: 0, error: null,
      })
    }
    return toVerificationJob(
      await apiFetch<VerificationJobResponse>('/people/verify', {
        method: 'POST',
        body: JSON.stringify({ site_id: params.siteId, record_ids: params.recordIds }),
      }),
    )
  },

  async getVerificationStatus(jobId: string): Promise<VerificationJob> {
    if (isMockMode()) {
      return Promise.resolve({
        id: jobId, status: 'completed', recordsTotal: 0, recordsChecked: 0,
        recordsCorrected: 0, error: null,
      })
    }
    return toVerificationJob(await apiFetch<VerificationJobResponse>(`/people/verify/${jobId}`))
  },
}

interface VerificationJobResponse {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  site_id?: string | null
  record_ids?: string[] | null
  run_id?: string | null
  queue_position?: number | null
  records_total: number
  records_checked: number
  records_corrected: number
  error?: string | null
}

export interface VerificationJob {
  id: string
  /** `pending` is waiting its turn in the run queue, like a crawl. */
  status: 'pending' | 'running' | 'completed' | 'failed'
  /** The queue entry this pass waits in. */
  runId?: string | null
  /** 1 when it starts next; absent once it has started. */
  queuePosition?: number | null
  recordsTotal: number
  recordsChecked: number
  recordsCorrected: number
  /** Why it failed, or on a completed pass, why some rows were not checked. */
  error?: string | null
}

const toVerificationJob = (raw: VerificationJobResponse): VerificationJob => ({
  id: raw.id, status: raw.status, runId: raw.run_id ?? null, queuePosition: raw.queue_position ?? null,
  recordsTotal: raw.records_total, recordsChecked: raw.records_checked,
  recordsCorrected: raw.records_corrected, error: raw.error ?? null,
})

export const verificationIsDone = (job: VerificationJob) => job.status === 'completed' || job.status === 'failed'

/**
 * Follow a verification job until it finishes, calling `onUpdate` with every
 * reply. It waits in the run queue behind any crawl, which can take a long
 * time, so there is no time limit: stop following it with `isCancelled`
 * (then this resolves to null). A few failed polls in a row end it with the error.
 */
export async function pollVerification(
  jobId: string,
  {
    intervalMs = 3000,
    onUpdate,
    isCancelled = () => false,
  }: { intervalMs?: number; onUpdate?: (job: VerificationJob) => void; isCancelled?: () => boolean } = {},
): Promise<VerificationJob | null> {
  let failures = 0
  for (;;) {
    if (isCancelled()) return null
    try {
      const job = await peopleApi.getVerificationStatus(jobId)
      failures = 0
      if (isCancelled()) return null
      onUpdate?.(job)
      if (verificationIsDone(job)) return job
    } catch (error) {
      failures += 1
      if (failures >= 3) throw error
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

/** One line for where a verification pass is, in words for a person. */
export function describeVerification(job: VerificationJob): string {
  const rows = (n: number) => `${n.toLocaleString()} row${n === 1 ? '' : 's'}`
  if (job.status === 'pending') {
    if (job.queuePosition === 1) return 'Added to the queue — it runs next, once the crawl ahead of it finishes.'
    if (job.queuePosition) return `Added to the queue — number ${job.queuePosition} in line. It runs when the work ahead of it finishes.`
    return 'Added to the queue.'
  }
  if (job.status === 'running') {
    return job.recordsTotal > 0
      ? `Verifying… ${job.recordsChecked.toLocaleString()} of ${rows(job.recordsTotal)} checked so far.`
      : 'Verifying…'
  }
  if (job.status === 'failed') return job.error || 'Verification failed. Please try again.'
  const done = `Checked ${job.recordsChecked.toLocaleString()} of ${rows(job.recordsTotal)} against their source page — `
    + `${job.recordsCorrected.toLocaleString()} label${job.recordsCorrected === 1 ? '' : 's'} corrected.`
  return job.error ? `${done} ${job.error}` : done
}

export interface PeopleStats {
  people: number
  trainees: number
  withEmail: number
}

/** Totals for the given schools only: the database also holds people from schools no longer listed. */
export async function getPeopleStats(schoolIds: string[]): Promise<PeopleStats> {
  const none = { people: 0, trainees: 0, withEmail: 0 }
  if (isMockMode() || schoolIds.length === 0) return none
  const body = await apiFetch<{
    total: number
    by_category: Record<string, number>
    with_email: number
  }>(`/people/stats?${schoolIds.map((id) => `site_id=${encodeURIComponent(id)}`).join('&')}`)
  return {
    people: body.total,
    trainees: (body.by_category.resident ?? 0) + (body.by_category.fellow ?? 0),
    withEmail: body.with_email,
  }
}
