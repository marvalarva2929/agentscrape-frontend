import { isMockMode } from './client'
import type { Program } from '../types/program'
import { mockPrograms } from '../mocks/programs'

export const programsApi = {
  async listPrograms(schoolId: string): Promise<Program[]> {
    if (isMockMode()) {
      return Promise.resolve(mockPrograms[schoolId] ?? [])
    }

    return []
  },

  async getProgram(id: string): Promise<Program> {
    if (isMockMode()) {
      const program = Object.values(mockPrograms)
        .flat()
        .find((item) => item.id === id)

      if (!program) throw new Error('Program not found')
      return program
    }

    throw new Error('Backend API not connected')
  },
}
