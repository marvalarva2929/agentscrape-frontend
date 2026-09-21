import { apiFetch, fetchAllPages, getApiBaseUrl, isMockMode, tokenStore } from './client'
import type { AgentActivity, Run } from '../types/run'
import { mockRunStream, mockRuns } from '../mocks/runs'

export interface StartRunRequest {
  /** The school to crawl. A run covers a whole institution. */
  schoolUrl?: string
  schoolId?: string
  programId?: string
  /** The one control the user sets: a budget in dollars. */
  maxSpendUsd?: number | null
  forceRescan?: boolean
}

interface RunResponse {
  id: string
  status: string
  stop_reason?: string | null
  label?: string | null
  sites_total: number
  sites_completed: number
  sites_skipped: number
  sites_failed: number
  records_found: number
  records_new: number
  records_changed: number
  records_missing: number
  spend_usd: number
  max_spend_usd?: number | null
  created_at: string
  started_at?: string | null
  finished_at?: string | null
}

const elapsed = (startedAt?: string | null, finishedAt?: string | null): number => {
  if (!startedAt) return 0
  const end = finishedAt ? Date.parse(finishedAt) : Date.now()
  return Math.max(0, Math.round((end - Date.parse(startedAt)) / 1000))
}

const toRun = (raw: RunResponse): Run => ({
  id: raw.id,
  programId: '',
  status: raw.status === 'stopped_at_limit' ? 'completed' : (raw.status as Run['status']),
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
  schoolName: raw.label ?? undefined,
  maxSpendUsd: raw.max_spend_usd ?? undefined,
  // A run that hit its budget is finished with valid partial results, not failed.
  stoppedAtLimit: raw.stop_reason === 'max_spend' || raw.stop_reason === 'max_records',
})

export const runsApi = {
  async startRun(payload: StartRunRequest): Promise<Run> {
    if (isMockMode()) {
      const newRun: Run = {
        id: `run-${Date.now()}`,
        programId: payload.programId ?? '',
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
          force_rescan: payload.forceRescan ?? false,
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
  async getRunSites(id: string) {
    if (isMockMode()) return []
    return fetchAllPages<Record<string, unknown>>(`/runs/${id}/sites`)
  },

  /**
   * Live progress. EventSource cannot set an Authorization header, so the token
   * goes in the query string — the one endpoint that accepts it that way.
   */
  subscribeToRun(runId: string, onEvent: (event: RunEvent) => void) {
    if (isMockMode()) {
      return mockRunStream(runId, (event) =>
        onEvent({ type: event.type, payload: event.run as unknown as Record<string, unknown> }),
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
    for (const type of [
      'heartbeat',
      'run_progress',
      'site_started',
      'site_step',
      'site_skipped',
      'site_completed',
      'site_failed',
      'run_completed',
      'run_stopped_at_limit',
      'run_cancelled',
    ]) {
      source.addEventListener(type, handle as EventListener)
    }

    // The stream can end without a completion event because the server is
    // stopped when idle. Callers fall back to the /sites snapshot.
    source.onerror = () => source.close()

    return () => source.close()
  },
}

export interface RunEvent {
  type: string
  payload: Record<string, unknown>
}

/** Merge a partial SSE frame into the displayed run without discarding state. */
export const applyRunEvent = (current: Run, event: RunEvent): Run => {
  const p = event.payload
  const value = (key: string, fallback: number) =>
    typeof p[key] === 'number' ? p[key] : fallback
  const activity: AgentActivity | null = p.agent_id ? {
    id: String(p.agent_id),
    currentPage: typeof p.url === 'string' ? p.url : undefined,
    currentAction: typeof p.action === 'string' ? p.action : event.type,
    stepNumber: typeof p.progress === 'number' ? p.progress : undefined,
    recordsFound: value('records_found', 0),
    schoolName: typeof p.school_name === 'string' ? p.school_name : (typeof p.domain === 'string' ? p.domain : undefined),
    timestamp: typeof p.at === 'string' ? p.at : new Date().toISOString(),
  } : null
  const prior = current.agentActivity ?? []
  return {
    ...current,
    status: typeof p.status === 'string' ? p.status as Run['status'] : current.status,
    stage: typeof p.stage === 'string' ? p.stage as Run['stage'] : current.stage,
    progress: value('progress', current.progress ?? 0),
    schoolName: typeof p.school_name === 'string' ? p.school_name : current.schoolName,
    spendUsd: value('spend_usd', current.spendUsd ?? 0),
    counts: {
      emailsFound: current.counts?.emailsFound ?? 0,
      newCount: current.counts?.newCount ?? 0,
      changedCount: current.counts?.changedCount ?? 0,
      missingCount: current.counts?.missingCount ?? 0,
      failedCount: current.counts?.failedCount,
      peopleFound: value('records_found', current.counts?.peopleFound ?? 0),
      peopleEnriched: value('records_found', current.counts?.peopleEnriched ?? 0),
    },
    agentActivity: activity ? [activity, ...prior.filter((item) => item.id !== activity.id)].slice(0, 50) : prior,
  }
}
