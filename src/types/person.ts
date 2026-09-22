export type TrainingType = 'Resident' | 'Fellow'
export type PersonStatus = 'new' | 'active' | 'changed' | 'stale'

/**
 * Everyone published on an institution's site is collected, so a person is not
 * necessarily a trainee. `category` is the coarse bucket for filtering and
 * `position` is their title exactly as the page printed it.
 */
export type PersonCategory =
  | 'resident'
  | 'fellow'
  | 'faculty'
  | 'staff'
  | 'student'
  | 'alumni'
  | 'unknown'

export interface PersonVersion {
  id: string
  date: string
  field: string
  oldValue?: string
  newValue?: string
  sourceUrl?: string
}

export interface Person {
  id: string
  schoolId?: string
  programId?: string
  name: string
  email?: string
  /** Set only for residents and fellows; everyone else uses `category`. */
  trainingType?: TrainingType
  category?: PersonCategory
  /** "Program Director", "PGY-2 Resident", "Associate Professor". */
  position?: string
  /** Training year as printed, e.g. "PGY-2". Never rolled forward. */
  year?: string
  /** Class-of year, only when the page stated one. */
  graduationYear?: string
  specialty?: string
  status: PersonStatus
  /** True when the person is no longer listed on the site. */
  isMissing?: boolean
  lastVerified?: string
  source?: string
  sourceUrl?: string
  sourceSnippet?: string
  capturedAt?: string
  extractedText?: string
  sourceAvailable?: boolean
  confidence?: number
  versionHistory?: PersonVersion[]
  /** Every role a verification pass confirmed the source page supports for
   * this person, e.g. both "faculty" and "fellow". Undefined until a
   * verification job has run for this record. */
  roles?: PersonCategory[]
  rolesCheckedAt?: string
}
