import type { RunCounts } from './api'

export type RunStage = 'queued' | 'discovering' | 'directory' | 'finalizing' | 'complete' | 'failed' | 'cancelled'

export interface AgentActivity {
  id: string
  currentPage?: string
  currentAction?: string
  stepNumber?: number
  screenshotUrl?: string
  recordsFound?: number
  schoolName?: string
  timestamp?: string
}

/** One line of the live activity feed: what the agent just did. */
export interface FeedItem {
  id: string
  at: string
  kind: 'page' | 'note' | 'error'
  message: string
  url?: string
  records?: number
  trainees?: number
}

export interface Run {
  id: string
  schoolId?: string
  /**
   * `queued` is a run waiting its turn: the backend holds it as `pending`
   * until the model budget is free, and `toRun` maps it across.
   */
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  stage?: RunStage
  startedAt?: string
  finishedAt?: string
  counts?: RunCounts
  schoolName?: string
  elapsedSeconds?: number
  progress?: number
  peopleFound?: number
  peopleEnriched?: number
  emailsFound?: number
  warnings?: number
  runType?: 'Directory Search' | 'New Crawl' | 'New Crawl + Directory Search'
  agentActivity?: AgentActivity[]
  /** Live spend, metered as the run happens rather than totalled at the end. */
  spendUsd?: number
  maxSpendUsd?: number
  /** Crawl limits: stop once this many people / residents & fellows / emails are collected. */
  maxPeople?: number
  maxTrainees?: number
  maxEmails?: number
  /**
   * The run hit its budget and wound down cleanly. Partial results are valid
   * results, so this is not a failure state.
   */
  stoppedAtLimit?: boolean
  /** Set when the site was unchanged and the crawl was skipped entirely. */
  skipped?: boolean
  skipReason?: string
  lastScrapedAt?: string
  /** Newest first, capped. Built from the live event stream. */
  feed?: FeedItem[]
  /** Live tallies from the stream; the run row only updates when a site ends. */
  pagesRead?: number
  traineesFound?: number
  programsTotal?: number
  programsCovered?: number
  errorMessage?: string
  sitesTotal?: number
  sitesCompleted?: number
  sitesSkipped?: number
  sitesFailed?: number
  sitesPending?: number
  stopReason?: string
  /** Waiting for its turn rather than running. */
  queued?: boolean
  /** 1 is the run that starts next. Absent once it is no longer waiting. */
  queuePosition?: number
  /** Per-site page ceiling; the crawler may stop earlier once useful leads end. */
  stepBudget?: number
}
