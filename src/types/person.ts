export type TrainingType = 'Resident' | 'Fellow'
export type PersonStatus = 'new' | 'active' | 'stale'

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
  programId: string
  schoolId?: string
  name: string
  email?: string
  phone?: string
  trainingType?: TrainingType
  year?: string
  specialty?: string
  track?: string
  department?: string
  role?: string
  graduationYear?: string
  profileUrl?: string
  status: PersonStatus
  lastVerified?: string
  source?: string
  sourceUrl?: string
  sourceSnippet?: string
  capturedAt?: string
  extractedText?: string
  versionHistory?: PersonVersion[]
}
