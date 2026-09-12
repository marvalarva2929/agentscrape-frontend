import { isMockMode } from './client'
import type { Person } from '../types/person'
import type { SourceProvenance } from '../types/source'
import { mockPeople } from '../mocks/people'

const normalizeStatus = (status: string | undefined): Person['status'] => {
  if (status === 'changed') return 'active'
  if (status === 'missing') return 'stale'
  if (status === 'new' || status === 'active' || status === 'stale') return status
  return 'active'
}

const normalizePerson = (person: Person): Person => ({
  ...person,
  status: normalizeStatus(person.status),
  sourceSnippet: person.sourceSnippet ?? person.extractedText ?? '',
  capturedAt: person.capturedAt ?? person.lastVerified ?? '',
})

export const peopleApi = {
  async listPeople(programId: string): Promise<Person[]> {
    if (isMockMode()) {
      return Promise.resolve((mockPeople[programId] ?? []).map(normalizePerson))
    }

    return []
  },

  async getPerson(id: string): Promise<Person> {
    if (isMockMode()) {
      const person = Object.values(mockPeople)
        .flat()
        .find((item) => item.id === id)

      if (!person) throw new Error('Person not found')
      return normalizePerson(person)
    }

    throw new Error('Backend API not connected')
  },

  async getVersions(personId: string) {
    const person = await this.getPerson(personId)
    return person.versionHistory ?? []
  },

  async getSource(personId: string): Promise<SourceProvenance> {
    if (isMockMode()) {
      const person = await this.getPerson(personId)
      return {
        sourceUrl: person.sourceUrl ?? '',
        capturedAt: person.capturedAt ?? person.lastVerified,
        sourceSnippet: person.sourceSnippet ?? person.extractedText ?? '',
        extractedText: person.extractedText,
      }
    }

    throw new Error('Backend API not connected')
  },
}
