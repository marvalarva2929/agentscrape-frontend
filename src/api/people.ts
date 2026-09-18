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

/** Backend statuses map onto the three the UI renders. */
const toStatus = (status: string): PersonStatus => {
  if (status === 'missing') return 'stale'
  if (status === 'new') return 'new'
  return 'active'
}

const toPerson = (raw: PersonResponse): Person => ({
  id: raw.id,
  schoolId: raw.site_id,
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
}
