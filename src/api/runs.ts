import { ApiError, apiFetch, fetchAllPages, getApiBaseUrl, isMockMode, tokenStore } from './client'
import type { FeedItem, Run } from '../types/run'
import type { RunQueue } from '../types/queue'
import { EMPTY_QUEUE } from '../types/queue'
import { mockRunStream, mockRuns } from '../mocks/runs'
import { EMPTY_COUNTS, FEED_LIMIT, isFinished, mergeRun as mergeRunRow, toStatus, type RunEvent } from './runEvents'
import { openRunStream, type Connection } from './runStream'

export { applyRunEvent, mergeRun, TERMINAL_EVENTS, type RunEvent } from './runEvents'
export type { Connection } from './runStream'

export interface StartRunRequest {
  /** The school to crawl. A run covers a whole institution. */
  schoolUrl?: string
  schoolId?: string
  /** Stop everything once estimated model spend reaches this, in dollars. */
  maxSpendUsd?: number | null
  /** Stop crawling once this many people have been collected. */
  maxPeople?: number | null
  /** Stop crawling once this many residents and fellows have been collected. */
  maxTrainees?: number | null
  /** Stop crawling once this many people with an email have been collected. */
  maxEmails?: number | null
  forceRescan?: boolean
  schoolName?: string
  /** The crawl's own name, as it appears in Past crawls. */
  label?: string
  includeDirectory?: boolean
}

interface RunResponse {
  id: string
  status: string
  stop_reason?: string | null
  label?: string | null
  school_name?: string | null
  config?: { step_budget?: number; modes?: string[] }
  sites_total: number
  sites_completed: number
  sites_skipped: number
  sites_failed: number
  sites_rejected?: number
  sites_pending?: number
  records_found: number
  records_new: number
  records_changed: number
  records_missing: number
  tokens_in?: number
  tokens_out?: number
  spend_usd: number
  max_spend_usd?: number | null
  max_records?: number | null
  max_trainees?: number | null
  max_emails?: number | null
  created_at: string
  started_at?: string | null
  finished_at?: string | null
  error_message?: string | null
  queued?: boolean
  queue_position?: number | null
}

const elapsed = (startedAt?: string | null, finishedAt?: string | null): number => {
  if (!startedAt) return 0
  const end = finishedAt ? Date.parse(finishedAt) : Date.now()
  return Math.max(0, Math.round((end - Date.parse(startedAt)) / 1000))
}

const toRunType = (modes?: string[]): Run['runType'] => {
  if (modes?.includes('directory') && modes.includes('crawl')) return 'New Crawl + Directory Search'
  if (modes?.includes('directory')) return 'Directory Search'
  return 'New Crawl'
}

export const toRun = (raw: RunResponse): Run => ({
  id: raw.id,
  status: toStatus(raw.status),
  label: raw.label ?? undefined,
  // The school, not the crawl's name: the name is `label`.
  schoolName: raw.school_name ?? undefined,
  runType: toRunType(raw.config?.modes),
  startedAt: raw.started_at ?? undefined,
  finishedAt: raw.finished_at ?? undefined,
  elapsedSeconds: elapsed(raw.started_at, raw.finished_at),
  counts: {
    peopleFound: raw.records_found,
    peopleEnriched: raw.records_found,
    emailsFound: 0,
    newCount: raw.records_new,
    changedCount: raw.records_changed,
    missingCount: raw.records_missing,
  },
  spendUsd: raw.spend_usd,
  tokensIn: raw.tokens_in,
  tokensOut: raw.tokens_out,
  maxSpendUsd: raw.max_spend_usd ?? undefined,
  maxPeople: raw.max_records ?? undefined,
  maxTrainees: raw.max_trainees ?? undefined,
  maxEmails: raw.max_emails ?? undefined,
  sitesTotal: raw.sites_total,
  sitesCompleted: raw.sites_completed,
  sitesSkipped: raw.sites_skipped,
  sitesFailed: raw.sites_failed,
  stepBudget: raw.config?.step_budget,
  sitesPending: raw.sites_pending,
  stopReason: raw.stop_reason ?? undefined,
  errorMessage: raw.error_message ?? undefined,
  // A run that hit one of its limits is finished with valid partial results, not failed.
  stoppedAtLimit: LIMIT_REASONS.has(raw.stop_reason ?? ''),
  // Waiting for its turn. (The backend's own `queued` is true for every run, so
  // it cannot say whether this one is still waiting.)
  queued: raw.status === 'pending',
  queuePosition: raw.status === 'pending' ? (raw.queue_position ?? undefined) : undefined,
})

const LIMIT_REASONS = new Set(['max_spend', 'max_records', 'max_trainees', 'max_emails'])

const LIMIT_LABELS: Record<string, string> = {
  max_spend: 'stopped at budget',
  max_records: 'stopped at people limit',
  max_trainees: 'stopped at residents & fellows limit',
  max_emails: 'stopped at email limit',
}

/** The status to show for a run, naming the limit it stopped at. */
export function runStatusLabel(run: Run): string {
  if (run.stoppedAtLimit) return LIMIT_LABELS[run.stopReason ?? ''] ?? 'stopped at limit'
  if (run.status === 'queued') return run.queuePosition ? `waiting · #${run.queuePosition}` : 'waiting'
  return run.status
}

export const runsApi = {
  async startRun(payload: StartRunRequest): Promise<Run> {
    if (isMockMode()) {
      const newRun: Run = {
        id: `run-${Date.now()}`,
        schoolId: payload.schoolId,
        status: 'running',
        stage: 'discovering',
        startedAt: new Date().toISOString(),
        progress: 8,
        counts: {
          peopleFound: 0,
          peopleEnriched: 0,
          emailsFound: 0,
          newCount: 0,
          changedCount: 0,
          missingCount: 0,
        },
      }
      mockRuns[newRun.id] = newRun
      return newRun
    }

    const body = await apiFetch<RunResponse>('/runs', {
      method: 'POST',
      body: JSON.stringify({
        sites: payload.schoolUrl ? [payload.schoolUrl] : [],
        config: {
          max_spend_usd: payload.maxSpendUsd ?? null,
          max_records: payload.maxPeople ?? null,
          max_trainees: payload.maxTrainees ?? null,
          max_emails: payload.maxEmails ?? null,
          force_rescan: payload.forceRescan ?? false,
          label: payload.label?.trim() || payload.schoolName || null,
          modes: payload.includeDirectory ? ['crawl', 'directory'] : ['crawl'],
          // Schools run one at a time. The model budget is one process-wide
          // allowance, so runs started side by side split it between them and
          // each still pays its own discovery and ranking startup in full.
          queued: true,
        },
      }),
    })
    return toRun(body)
  },

  async getRun(id: string): Promise<Run> {
    if (isMockMode()) {
      return mockRuns[id] ?? mockRuns['run-1']
    }
    return toRun(await apiFetch<RunResponse>(`/runs/${id}`))
  },

  async listRuns(): Promise<Run[]> {
    if (isMockMode()) {
      return Object.values(mockRuns)
    }
    const rows = await fetchAllPages<RunResponse>('/runs', { pageSize: 50, maxPages: 4 })
    return rows.map(toRun)
  },

  /**
   * Stop a run. Succeeds when the run has already stopped.
   *
   * A run can finish between the stop button being drawn and pressed, and an
   * older backend answers that with 409 RUN_NOT_CANCELLABLE. Either way the
   * crawl is stopped, which is what was asked for, so it is not an error to
   * report. The timeout is generous because the request returns only once the
   * backend has recorded the intent.
   */
  async cancelRun(id: string): Promise<void> {
    if (isMockMode()) {
      const run = mockRuns[id]
      if (run) {
        run.status = 'cancelled'
        run.finishedAt = new Date().toISOString()
      }
      return
    }
    try {
      await apiFetch<void>(`/runs/${id}/cancel`, { method: 'POST', timeoutMs: 60000 })
    } catch (error) {
      const alreadyStopped =
        error instanceof ApiError &&
        (error.backendCode === 'RUN_NOT_CANCELLABLE' || error.status === 409)
      if (!alreadyStopped) throw error
    }
  },

  /** The whole queue: what is running, what is waiting, and in what order. */
  async getQueue(): Promise<RunQueue> {
    if (isMockMode()) return EMPTY_QUEUE
    return apiFetch<RunQueue>('/runs/queue')
  },

  /** Move a waiting run up, down or to the front. Returns the queue afterwards. */
  async moveRun(id: string, direction: 'up' | 'down' | 'top'): Promise<RunQueue> {
    return apiFetch<RunQueue>(`/runs/${id}/move`, { method: 'POST', body: JSON.stringify({ direction }) })
  },

  /** Per-site status. The authoritative snapshot for resyncing after a reconnect. */
  async getRunSites(id: string): Promise<SiteRunSnapshot[]> {
    if (isMockMode()) return []
    return fetchAllPages<SiteRunSnapshot>(`/runs/${id}/sites`)
  },

  /** Re-queues one finished site as a forced rescan. Useful after a 429. */
  async retrySite(runId: string, siteId: string): Promise<SiteRunSnapshot> {
    return apiFetch<SiteRunSnapshot>(`/runs/${runId}/sites/${siteId}/retry`, { method: 'POST' })
  },

  /**
   * Live progress. EventSource cannot set an Authorization header, so the token
   * goes in the query string — the one endpoint that accepts it that way.
   * The stream reopens itself after an error until the run is over or the
   * person is signed out; `onConnection` says which state it is in.
   */
  subscribeToRun(
    runId: string,
    onEvent: (event: RunEvent) => void,
    onConnection?: (state: Connection) => void,
  ) {
    if (isMockMode()) {
      return mockRunStream(runId, (event) =>
        onEvent({ type: event.type, payload: (event.run ?? {}) as unknown as Record<string, unknown> }),
      )
    }
    return openRunStream({
      url: () => `${getApiBaseUrl()}/runs/${runId}/events?token=${encodeURIComponent(tokenStore.get() ?? '')}`,
      eventTypes: RUN_EVENT_TYPES,
      onEvent,
      onConnection,
      // Before each retry: is the run still going, and are we still signed in?
      // A 401 clears the token and tells the app (see `setUnauthorizedHandler`).
      shouldReconnect: async () => {
        try {
          return !isFinished((await runsApi.getRun(runId)).status)
        } catch (error) {
          if (error instanceof ApiError && (error.status === 401 || error.status === 404)) return false
          return true
        }
      },
    })
  },
}

const RUN_EVENT_TYPES = [
  'heartbeat',
  'run_started',
  'run_progress',
  'agent_spawned',
  'agent_retired',
  'site_started',
  'site_step',
  'site_skipped',
  'known_path_hit',
  'site_completed',
  'site_failed',
  'site_rejected',
  'run_completed',
  'run_stopped_at_limit',
  'run_cancelled',
  'run_failed',
]

/**
 * The live state of a run, kept per run id so leaving the monitor and coming
 * back — or reloading the tab — does not start from an empty feed. Only the
 * stream produces this; nothing on the server can replay it.
 */
interface LiveRunState {
  feed?: FeedItem[]
  stage?: Run['stage']
  progress?: number
  pagesRead?: number
  traineesFound?: number
  programsTotal?: number
  programsCovered?: number
  spendUsd?: number
  peopleFound?: number
  lastSeq?: number
  schoolId?: string
  schoolName?: string
  runType?: Run['runType']
  savedAt: string
}

const LIVE_STATE_PREFIX = 'agentscrape.live-run.'
const LIVE_STATE_MAX_AGE_MS = 12 * 60 * 60 * 1000

const liveStore = (): Storage | null => {
  try {
    return window.sessionStorage
  } catch {
    // Blocked storage costs the feed on the next visit and nothing else.
    return null
  }
}

/** Save the stream-only parts of a run. Called on every event. */
export function rememberRun(run: Run): void {
  const store = liveStore()
  if (!store) return
  const state: LiveRunState = {
    feed: run.feed?.slice(0, FEED_LIMIT),
    stage: run.stage,
    progress: run.progress,
    pagesRead: run.pagesRead,
    traineesFound: run.traineesFound,
    programsTotal: run.programsTotal,
    programsCovered: run.programsCovered,
    spendUsd: run.spendUsd,
    peopleFound: run.counts?.peopleFound,
    lastSeq: run.lastSeq,
    schoolId: run.schoolId,
    schoolName: run.schoolName,
    runType: run.runType,
    savedAt: new Date().toISOString(),
  }
  try {
    store.setItem(LIVE_STATE_PREFIX + run.id, JSON.stringify(state))
  } catch {
    pruneLiveRuns(store)
    try {
      store.setItem(LIVE_STATE_PREFIX + run.id, JSON.stringify(state))
    } catch {
      /* out of room: the monitor still works, it just starts from the row */
    }
  }
}

/** Put a run row back together with whatever the stream last showed for it. */
export function restoreRun(run: Run): Run {
  const store = liveStore()
  if (!store) return run
  let state: LiveRunState | null = null
  try {
    const raw = store.getItem(LIVE_STATE_PREFIX + run.id)
    state = raw ? (JSON.parse(raw) as LiveRunState) : null
  } catch {
    state = null
  }
  if (!state) return run
  const remembered: Run = {
    ...run,
    feed: state.feed,
    stage: state.stage,
    progress: state.progress,
    pagesRead: state.pagesRead,
    traineesFound: state.traineesFound,
    programsTotal: state.programsTotal,
    programsCovered: state.programsCovered,
    spendUsd: state.spendUsd,
    lastSeq: state.lastSeq,
    schoolId: run.schoolId ?? state.schoolId,
    schoolName: run.schoolName ?? state.schoolName,
    runType: run.runType ?? state.runType,
    counts: { ...(run.counts ?? EMPTY_COUNTS), peopleFound: state.peopleFound ?? run.counts?.peopleFound ?? 0 },
  }
  return mergeRunRow(remembered, run)
}

function pruneLiveRuns(store: Storage): void {
  const cutoff = Date.now() - LIVE_STATE_MAX_AGE_MS
  for (const key of Object.keys(store)) {
    if (!key.startsWith(LIVE_STATE_PREFIX)) continue
    try {
      const saved = Date.parse((JSON.parse(store.getItem(key) ?? '{}') as LiveRunState).savedAt ?? '')
      if (!Number.isFinite(saved) || saved < cutoff) store.removeItem(key)
    } catch {
      store.removeItem(key)
    }
  }
}

export interface SiteRunSnapshot {
  id: string
  site_id: string
  domain?: string | null
  hospital?: string | null
  status: string
  agent_id?: string | null
  steps_taken?: number
  step_budget?: number
  records_found?: number
  skip_reason?: string | null
  error_code?: string | null
  error_message?: string | null
}
