import type { Person } from '../types/person'

/** Confirmed roles are shared by the data table, filters, exports and detail. */
export function personRoles(person: Person): string[] {
  // A verifier returns one canonical role only when it has sufficient source
  // evidence. Preserve the crawl label for legacy/multi-role payloads.
  if (person.roles?.length === 1) {
    const role = person.roles[0]
    return [role[0].toUpperCase() + role.slice(1)]
  }
  if (person.trainingType) return [person.trainingType]
  const role = person.category ?? 'unknown'
  return [role[0].toUpperCase() + role.slice(1)]
}

export const roleLabel = (person: Person) => personRoles(person).join(', ')
