import { apiFetch, fetchAllPages, isMockMode } from './client'
import { mockSchools } from '../mocks/schools'
import type { School } from '../types/school'

/** The backend's school shape, which uses snake_case. */
interface SchoolResponse {
  id: string
  name: string
  location?: string | null
  root_domain: string
  program_count?: number
  people_count?: number
  last_updated?: string | null
}

const toSchool = (raw: SchoolResponse): School => ({
  id: raw.id,
  // Falls back to the domain so a school is never nameless in the list.
  name: raw.name || raw.root_domain,
  location: raw.location ?? undefined,
  programCount: raw.program_count ?? 0,
  peopleCount: raw.people_count ?? 0,
  lastUpdated: raw.last_updated ?? undefined,
})

export const schoolsApi = {
  async listSchools(): Promise<School[]> {
    if (isMockMode()) {
      return Promise.resolve(mockSchools)
    }

    const rows = await fetchAllPages<SchoolResponse>('/schools')
    return rows.map(toSchool)
  },

  async getSchool(id: string): Promise<School> {
    if (isMockMode()) {
      const school = mockSchools.find((item) => item.id === id)
      if (!school) throw new Error('School not found')
      return school
    }

    return toSchool(await apiFetch<SchoolResponse>(`/schools/${id}`))
  },
}
