import { describe, expect, it } from 'vitest'
import { personRoles, roleLabel } from './personRoles'
import type { Person } from '../types/person'

const person: Person = { id: '1', name: 'Jane Doe', status: 'active', category: 'resident', trainingType: 'Resident' }

describe('verified role display', () => {
  it('uses the correction instead of the original category and training type', () => {
    expect(roleLabel({ ...person, roles: ['fellow'] })).toBe('Fellow')
  })
  it('uses the single canonical category after verification', () => {
    const verified = { ...person, roles: ['faculty', 'fellow'] } as Person
    expect(personRoles(verified)).toEqual(['Resident'])
    expect(roleLabel(verified)).toBe('Resident')
  })
  it('keeps the original classification when nothing was confirmed', () => {
    expect(roleLabel(person)).toBe('Resident')
    expect(roleLabel({ ...person, roles: [] })).toBe('Resident')
  })
})
