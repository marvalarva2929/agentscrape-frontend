import type { Person } from '../types/person'
import arizonaPeople from './arizona-people.json'

/** Real crawl output for Arizona (see mocks/schools.ts). */
export const mockPeople: Record<string, Person[]> = {
  arizona: arizonaPeople as Person[],
}
