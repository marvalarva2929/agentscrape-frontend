import type { School } from '../types/school'

export const mockSchools: School[] = [
  {
    id: 'school-1',
    name: 'Texas Tech University Health Sciences Center',
    rootDomain: 'ttuhsc.edu',
    canonicalUrl: 'https://www.ttuhsc.edu/',
    location: 'Lubbock, TX',
    peopleCount: 132,
    lastUpdated: '2026-09-10',
  },
  {
    id: 'school-2',
    name: 'University of Michigan Health',
    rootDomain: 'uofmhealth.org',
    canonicalUrl: 'https://www.uofmhealth.org/',
    location: 'Ann Arbor, MI',
    peopleCount: 214,
    lastUpdated: '2026-09-09',
  },
  {
    id: 'school-3',
    name: 'Duke University School of Medicine',
    rootDomain: 'medschool.duke.edu',
    canonicalUrl: 'https://medschool.duke.edu/',
    location: 'Durham, NC',
    peopleCount: 176,
    lastUpdated: '2026-09-08',
  },
]
