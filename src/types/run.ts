import type { RunCounts } from './api'

export type RunStage = 'queued' | 'discovering' | 'directory' | 'finalizing' | 'complete' | 'failed' | 'cancelled'

export interface AgentActivity {
  id: string
  currentPage?: string
  currentAction?: string
  stepNumber?: number
  screenshotUrl?: string
  recordsFound?: number
}

export interface Run {
  id: string
  programId: string
  schoolId?: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  stage?: RunStage
  startedAt?: string
  finishedAt?: string
  counts?: RunCounts
  programName?: string
  schoolName?: string
  elapsedSeconds?: number
  progress?: number
  peopleFound?: number
  peopleEnriched?: number
  emailsFound?: number
  warnings?: number
  runType?: 'Directory Search' | 'New Crawl' | 'New Crawl + Directory Search'
  programUrl?: string
  directoryUrl?: string
  peopleGoal?: number | null
  noFixedGoal?: boolean
  agentActivity?: AgentActivity[]
}
