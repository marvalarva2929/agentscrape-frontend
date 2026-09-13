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
  agentActivity?: AgentActivity[]
  /** Live spend, metered as the run happens rather than totalled at the end. */
  spendUsd?: number
  maxSpendUsd?: number
  /**
   * The run hit its budget and wound down cleanly. Partial results are valid
   * results, so this is not a failure state.
   */
  stoppedAtLimit?: boolean
  /** Set when the site was unchanged and the crawl was skipped entirely. */
  skipped?: boolean
  skipReason?: string
  lastScrapedAt?: string
}
