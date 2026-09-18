export type ApiErrorCode =
  | 'NETWORK'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'UNAVAILABLE'
  | 'VALIDATION'
  | 'UNKNOWN'

export interface ApiError extends Error {
  code: ApiErrorCode
  status?: number
  details?: Record<string, unknown>
}

export interface PaginatedResponse<T> {
  items: T[]
  total?: number
  nextCursor?: string | null
  prevCursor?: string | null
}

export interface RunResponse {
  id: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  stage?: 'discovering' | 'directory' | 'finalizing' | 'complete'
  startedAt?: string
  finishedAt?: string
  counts?: RunCounts
}

export interface SourceResponse {
  sourceUrl: string
  pageTitle?: string
  capturedAt?: string
  extractionMethod?: string
  confidence?: number
  screenshotUrl?: string
  screenshotAvailable: boolean
  extractedText?: string
  fieldLocations?: Record<string, { x: number; y: number; width: number; height: number }>
}

export interface RunCounts {
  peopleFound: number
  peopleEnriched: number
  emailsFound: number
  newCount: number
  changedCount: number
  missingCount: number
  failedCount?: number
}

export interface ServerStatus {
  online: boolean
  message?: string
}
