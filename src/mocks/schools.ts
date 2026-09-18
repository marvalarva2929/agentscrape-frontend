import type { School } from '../types/school'

/**
 * Static demo build: the University of Arizona results from the agent-driven
 * crawl of 17 September 2026, baked in so the app runs with no backend.
 */
export const mockSchools: School[] = [
  {
    id: 'arizona',
    name: 'University of Arizona College of Medicine – Tucson',
    rootDomain: 'medicine.arizona.edu',
    canonicalUrl: 'https://medicine.arizona.edu/education/residency-fellowship',
    location: 'Tucson, AZ',
    peopleCount: 1918,
    lastUpdated: '2026-09-17T23:25:55-05:00',
  },
]
