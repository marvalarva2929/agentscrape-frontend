import { apiFetch, fetchAllPages, isMockMode } from './client'
import { mockPrograms } from '../mocks/programs'
import type { Program } from '../types/program'

interface ProgramResponse {
  id: string
  school_id: string
  name: string
  specialty: string
  type?: string | null
  resident_count?: number
  fellow_count?: number
  people_count?: number
  last_updated?: string | null
  start_url?: string | null
  directory_url?: string | null
}

const toProgram = (raw: ProgramResponse): Program => ({
  id: raw.id,
  schoolId: raw.school_id,
  name: raw.name,
  type: raw.type ?? undefined,
  residentCount: raw.resident_count ?? 0,
  fellowCount: raw.fellow_count ?? 0,
  peopleCount: raw.people_count ?? 0,
  lastUpdated: raw.last_updated ?? undefined,
  startUrl: raw.start_url ?? undefined,
  directoryUrl: raw.directory_url ?? undefined,
})

export const programsApi = {
  async listPrograms(schoolId: string): Promise<Program[]> {
    if (isMockMode()) {
      return Promise.resolve(mockPrograms[schoolId] ?? [])
    }

    const rows = await fetchAllPages<ProgramResponse>(`/schools/${schoolId}/programs`)
    return rows.map(toProgram)
  },

  async getProgram(id: string): Promise<Program> {
    if (isMockMode()) {
      const program = Object.values(mockPrograms)
        .flat()
        .find((item) => item.id === id)

      if (!program) throw new Error('Program not found')
      return program
    }

    return toProgram(await apiFetch<ProgramResponse>(`/programs/${id}`))
  },
}
