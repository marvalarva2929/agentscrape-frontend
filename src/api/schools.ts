import { apiFetch, fetchAllPages, isMockMode } from './client'
import { mockSchools } from '../mocks/schools'
import type { School } from '../types/school'
import type { Program } from '../types/program'

/** The backend's school shape, which uses snake_case. */
interface SchoolResponse {
  id: string
  name: string
  location?: string | null
  root_domain: string
  canonical_url: string
  people_count?: number
  last_updated?: string | null
  directory_url?: string | null
  directory_search_available?: boolean
}

interface ProgramResponse {
  id: string
  school_id: string
  name: string
  specialty?: string | null
  type?: string | null
  resident_count?: number | null
  fellow_count?: number | null
  people_count?: number | null
  last_updated?: string | null
  start_url?: string | null
  directory_url?: string | null
}

const toSchool = (raw: SchoolResponse): School => ({
  id: raw.id,
  // Falls back to the domain so a school is never nameless in the list.
  name: raw.name || raw.root_domain,
  rootDomain: raw.root_domain,
  canonicalUrl: raw.canonical_url,
  location: raw.location ?? undefined,
  peopleCount: raw.people_count ?? 0,
  lastUpdated: raw.last_updated ?? undefined,
  directoryUrl: raw.directory_url ?? undefined,
  directorySearchAvailable: raw.directory_search_available ?? false,
})

const toProgram = (raw: ProgramResponse): Program => ({
  id: raw.id,
  schoolId: raw.school_id,
  name: raw.name,
  specialty: raw.specialty ?? undefined,
  type: raw.type ?? undefined,
  residentCount: raw.resident_count ?? undefined,
  fellowCount: raw.fellow_count ?? undefined,
  peopleCount: raw.people_count ?? undefined,
  lastUpdated: raw.last_updated ?? undefined,
  startUrl: raw.start_url ?? undefined,
  directoryUrl: raw.directory_url ?? undefined,
})

/** Alphabetical by name, so "St. Mary's" and " St mary" sort together. */
const byName = (a: School, b: School) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })

export const schoolsApi = {
  async listSchools(): Promise<School[]> {
    if (isMockMode()) {
      return [...mockSchools].sort(byName)
    }

    // The API pages in insertion order, which puts whatever was crawled first
    // at the top of every school list and search.
    const rows = await fetchAllPages<SchoolResponse>('/schools')
    return rows.map(toSchool).sort(byName)
  },

  async getSchool(id: string): Promise<School> {
    if (isMockMode()) {
      const school = mockSchools.find((item) => item.id === id)
      if (!school) throw new Error('School not found')
      return school
    }

    return toSchool(await apiFetch<SchoolResponse>(`/schools/${id}`))
  },

  async listPrograms(schoolId: string): Promise<Program[]> {
    if (isMockMode()) return []
    const rows = await fetchAllPages<ProgramResponse>(`/schools/${schoolId}/programs`)
    return rows.map(toProgram)
  },
}
