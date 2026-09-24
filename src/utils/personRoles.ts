import type { Person } from '../types/person'

/** Confirmed roles are shared by the data table, filters, exports and detail. */
export function personRoles(person: Person): string[] {
  if (person.trainingType) return [person.trainingType]
  const role = person.category ?? 'unknown'
  return [role[0].toUpperCase() + role.slice(1)]
}

export const roleLabel = (person: Person) => personRoles(person).join(', ')
