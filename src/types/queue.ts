/** The run queue: what holds the model budget, and what is waiting for it. */

export interface QueueSite {
  site_id: string
  domain?: string | null
  hospital?: string | null
  status: string
  records_found: number
  steps_taken: number
  step_budget: number
}

export interface QueueEntry {
  run_id: string
  label?: string | null
  status: string
  queued: boolean
  running: boolean
  /** 1 is the run that starts next; null for one already running. */
  position?: number | null
  sites_total: number
  sites_completed: number
  sites_pending: number
  records_found: number
  spend_usd: number
  created_at: string
  started_at?: string | null
  sites: QueueSite[]
  /** `verify` is a verification pass: no schools, progress in rows checked. */
  kind?: 'crawl' | 'verify'
  records_total?: number
  records_checked?: number
}

export interface RunQueue {
  running: QueueEntry[]
  waiting: QueueEntry[]
  /** Claiming to run with no recent heartbeat, or created and never launched. */
  stalled: QueueEntry[]
}

export const EMPTY_QUEUE: RunQueue = { running: [], waiting: [], stalled: [] }

/** Nothing may start while a run still holds the model budget. */
export const queueIsBusy = (queue: RunQueue): boolean => queue.running.length > 0
