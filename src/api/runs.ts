import { apiFetch, fetchAllPages, getApiBaseUrl, isMockMode, tokenStore } from './client'
import type { FeedItem, Run } from '../types/run'
import { mockRunStream, mockRuns } from '../mocks/runs'

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
  includeDirectory?: boolean
}

interface RunResponse {
  id: string
  status: string
  stop_reason?: string | null
  label?: string | null
  config?: { step_budget?: number }
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
  spend_usd: number
  max_spend_usd?: number | null
  max_records?: number | null
  max_trainees?: number | null
  max_emails?: number | null
  created_at: string
  started_at?: string | null
  finished_at?: string | null
  error_message?: string | null
}

const elapsed = (startedAt?: string | null, finishedAt?: string | null): number => {
  if (!startedAt) return 0
  const end = finishedAt ? Date.parse(finishedAt) : Date.now()
  return Math.max(0, Math.round((end - Date.parse(startedAt)) / 1000))
}

const toRun = (raw: RunResponse): Run => ({
  id: raw.id,
  status: raw.status === 'stopped_at_limit' ? 'completed' : (raw.status as Run['status']),
  startedAt: raw.started_at ?? undefined,
  schoolName: raw.label ?? undefined,
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
          label: payload.schoolName ?? null,
          modes: payload.includeDirectory ? ['crawl', 'directory'] : ['crawl'],
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

  async cancelRun(id: string): Promise<void> {
    if (isMockMode()) {
      const run = mockRuns[id]
      if (run) {
        run.status = 'cancelled'
        run.finishedAt = new Date().toISOString()
      }
      return
    }
    await apiFetch<void>(`/runs/${id}/cancel`, { method: 'POST' })
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
   * Delivers each event's type and raw payload; `applyRunEvent` folds them in.
   */
  subscribeToRun(runId: string, onEvent: (event: RunEvent) => void) {
    if (isMockMode()) {
      return mockRunStream(runId, (event) =>
        onEvent({ type: event.type, payload: (event.run ?? {}) as unknown as Record<string, unknown> }),
      )
    }

    const token = tokenStore.get()
    const source = new EventSource(
      `${getApiBaseUrl()}/runs/${runId}/events?token=${encodeURIComponent(token ?? '')}`,
    )

    const handle = (raw: MessageEvent) => {
      try {
        const payload = JSON.parse(raw.data) as Record<string, unknown>
        onEvent({ type: String(payload.type ?? 'progress'), payload })
      } catch {
        /* a malformed frame should not tear down the stream */
      }
    }

    source.onmessage = handle
    for (const type of RUN_EVENT_TYPES) {
      source.addEventListener(type, handle as EventListener)
    }

    // The stream can end without a completion event because the server is
    // stopped when idle. Callers poll getRun as the fallback.
    source.onerror = () => source.close()

    return () => source.close()
  },
}

export interface RunEvent {
  type: string
  payload: Record<string, unknown>
}

const RUN_EVENT_TYPES = [
  'heartbeat',
  'run_progress',
  'site_started',
  'site_step',
  'site_skipped',
  'site_completed',
  'site_failed',
  'site_rejected',
  'run_completed',
  'run_stopped_at_limit',
  'run_cancelled',
  'run_failed',
]

export const TERMINAL_EVENTS = new Set(['run_completed', 'run_stopped_at_limit', 'run_cancelled', 'run_failed'])
const FEED_LIMIT = 200
const STAGES = new Set(['discovering', 'directory', 'finalizing', 'complete'])

const num = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined
const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined

/** Fold one stream event into the run the monitor shows. */
export function applyRunEvent(run: Run, event: RunEvent): Run {
  const p = event.payload
  const at = str(p.at) ?? new Date().toISOString()
  const feed = run.feed ?? []
  const push = (item: Omit<FeedItem, 'id' | 'at'>): FeedItem[] =>
    [{ id: `${at}-${feed.length}`, at, ...item }, ...feed].slice(0, FEED_LIMIT)

  switch (event.type) {
    case 'heartbeat':
    case 'run_progress':
      return {
        ...run,
        spendUsd: num(p.spend_usd) ?? run.spendUsd,
        sitesTotal: num(p.sites_total) ?? run.sitesTotal,
        sitesCompleted: num(p.sites_completed) ?? run.sitesCompleted,
        sitesSkipped: num(p.sites_skipped) ?? run.sitesSkipped,
        sitesFailed: num(p.sites_failed) ?? run.sitesFailed,
        sitesPending: num(p.sites_pending) ?? run.sitesPending,
        counts: {
          ...(run.counts ?? EMPTY_COUNTS),
          peopleFound: num(p.records_found) ?? run.counts?.peopleFound ?? 0,
          newCount: num(p.records_new) ?? run.counts?.newCount ?? 0,
          changedCount: num(p.records_changed) ?? run.counts?.changedCount ?? 0,
          missingCount: num(p.records_missing) ?? run.counts?.missingCount ?? 0,
        },
        status: run.status === 'queued' ? 'running' : run.status,
      }
    case 'site_started':
      return {
        ...run,
        status: 'running',
        stage: 'discovering',
        feed: push({ kind: 'note', message: `Started crawling ${str(p.domain) ?? 'the school'}` }),
      }
    case 'site_step': {
      const stage = str(p.stage)
      if (stage && STAGES.has(stage)) {
        return {
          ...run,
          stage: stage as Run['stage'],
          progress: Math.max(run.progress ?? 0, num(p.progress) ?? 0),
        }
      }
      const message = str(p.message)
      if (str(p.action) === 'note') {
        const programs = num(p.programs)
        const coveredMatch = message?.match(/(\d+) of (\d+) programs covered/)
        return {
          ...run,
          programsTotal: programs ?? (coveredMatch ? Number(coveredMatch[2]) : run.programsTotal),
          programsCovered: coveredMatch ? Number(coveredMatch[1]) : run.programsCovered,
          feed: message ? push({ kind: 'note', message }) : feed,
        }
      }
      const records = num(p.records) ?? 0
      const trainees = num(p.trainees) ?? 0
      return {
        ...run,
        status: 'running',
        stage: run.stage === 'discovering' || !run.stage ? 'directory' : run.stage,
        pagesRead: (run.pagesRead ?? 0) + 1,
        traineesFound: (run.traineesFound ?? 0) + trainees,
        counts: {
          ...(run.counts ?? EMPTY_COUNTS),
          peopleFound: (run.counts?.peopleFound ?? 0) + records,
        },
        feed: push({
          kind: 'page',
          message: message ?? `Read ${str(p.url) ?? 'a page'}`,
          url: str(p.url),
          records,
          trainees,
        }),
      }
    }
    case 'site_skipped':
      return {
        ...run,
        skipped: true,
        skipReason: str(p.reason),
        feed: push({ kind: 'note', message: `Skipped: ${str(p.reason) ?? 'site unchanged since the last crawl'}` }),
      }
    case 'site_failed':
    case 'site_rejected':
      return {
        ...run,
        errorMessage: str(p.reason),
        feed: push({ kind: 'error', message: `Stopped: ${str(p.reason) ?? str(p.error_code) ?? 'site failed'}` }),
      }
    case 'site_completed':
      return { ...run, feed: push({ kind: 'note', message: 'Finished the site; reconciling records' }) }
    default:
      if (TERMINAL_EVENTS.has(event.type)) {
        return {
          ...run,
          status: event.type === 'run_cancelled' ? 'cancelled' : event.type === 'run_failed' ? 'failed' : 'completed',
          stage: 'complete',
          progress: 100,
          stoppedAtLimit: event.type === 'run_stopped_at_limit',
        }
      }
      return run
  }
}

export interface SiteRunSnapshot {
  id: string
  site_id: string
  domain?: string | null
  status: string
  error_code?: string | null
  error_message?: string | null
}

const EMPTY_COUNTS = {
  peopleFound: 0,
  peopleEnriched: 0,
  emailsFound: 0,
  newCount: 0,
  changedCount: 0,
  missingCount: 0,
}
