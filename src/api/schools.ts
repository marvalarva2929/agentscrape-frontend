import { isMockMode } from './client'
import { mockSchools } from '../mocks/schools'
import type { School } from '../types/school'

export const schoolsApi = {
  async listSchools(): Promise<School[]> {
    if (isMockMode()) {
      return Promise.resolve(mockSchools)
    }

    return []
  },

  async getSchool(id: string): Promise<School> {
    if (isMockMode()) {
      const school = mockSchools.find((item) => item.id === id)
      if (!school) throw new Error('School not found')
      return school
    }

    throw new Error('Backend API not connected')
  },
}
