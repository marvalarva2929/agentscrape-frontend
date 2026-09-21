import type { AgentInfo, FeedItem, Run } from '../types/run'

/**
 * How a run's live state is built from the backend's event stream.
 *
 * Pure functions, kept apart from the network code so they can be tested: the
 * bugs here (a run showing another run's numbers, a page counted twice after a
 * reconnect, a waiting run reading as running) are exactly the ones a browser
 * never shows you until a client does.
 */

export interface RunEvent {
  type: string
  payload: Record<string, unknown>
}

export const TERMINAL_EVENTS = new Set(['run_completed', 'run_stopped_at_limit', 'run_cancelled', 'run_failed'])
export const FEED_LIMIT = 200
const STAGES = new Set(['discovering', 'directory', 'finalizing', 'complete'])
const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled'])

export const EMPTY_COUNTS = {
  peopleFound: 0,
  peopleEnriched: 0,
  emailsFound: 0,
  newCount: 0,
  changedCount: 0,
  missingCount: 0,
}

/**
 * The backend holds a waiting run as `pending`, and reports a run that hit one
 * of its limits as `stopped_at_limit`. Neither word exists in the UI's own
 * vocabulary, so both are translated here rather than leaking into every
 * status check: an untranslated `pending` read as "not finished", which kept
 * the stop button live on a run that was only waiting.
 */
export const toStatus = (raw: string): Run['status'] => {
  if (raw === 'stopped_at_limit') return 'completed'
  if (raw === 'pending') return 'queued'
  return raw as Run['status']
}

export const isFinished = (status?: string): boolean =>
  status !== undefined && (TERMINAL_STATUSES.has(status) || status === 'stopped_at_limit')

const num = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined
const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined

const toAgent = (raw: Record<string, unknown>): AgentInfo | null => {
  const id = str(raw.agent_id)
  if (!id) return null
  return {
    id,
    domain: str(raw.domain),
    url: str(raw.url),
    message: str(raw.message) ?? str(raw.action),
    title: str(raw.title),
    program: str(raw.program),
    pageType: str(raw.page_type),
    stepsTaken: num(raw.steps_taken),
    stepBudget: num(raw.step_budget),
    at: str(raw.at),
  }
}

const withoutUndefined = <T extends object>(value: T): Partial<T> =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>

/** Add or update one agent, keeping what it already reported for fields the event lacks. */
const upsertAgent = (agents: AgentInfo[] | undefined, next: AgentInfo): AgentInfo[] => {
  const list = agents ?? []
  const found = list.some((agent) => agent.id === next.id)
  const merged = found
    ? list.map((agent) => (agent.id === next.id ? { ...agent, ...withoutUndefined(next) } : agent))
    : [...list, next]
  return merged.sort((a, b) => a.id.localeCompare(b.id))
}

/** Fold one stream event into the run the monitor shows. */
export function applyRunEvent(run: Run, event: RunEvent): Run {
  const seq = num(event.payload.seq)
  // A reconnect replays the recent activity. Anything already applied is
  // skipped, so pages and the feed are not counted twice.
  if (seq !== undefined && seq > 0 && run.lastSeq !== undefined && seq <= run.lastSeq) return run
  const next = applyOne(run, event)
  return seq !== undefined && seq > 0 ? { ...next, lastSeq: Math.max(seq, next.lastSeq ?? 0) } : next
}

function applyOne(run: Run, event: RunEvent): Run {
  const p = event.payload
  const at = str(p.at) ?? new Date().toISOString()
  const feed = run.feed ?? []
  const push = (item: Omit<FeedItem, 'id' | 'at'>): FeedItem[] =>
    [{ id: `${at}-${num(p.seq) ?? feed.length}`, at, ...item }, ...feed].slice(0, FEED_LIMIT)
  const counts = run.counts ?? EMPTY_COUNTS

  switch (event.type) {
    case 'run_started':
      return { ...run, status: isFinished(run.status) ? run.status : 'running', startedAt: run.startedAt ?? at, queuePosition: undefined }

    case 'agent_spawned': {
      const agent = toAgent(p)
      return agent ? { ...run, agents: upsertAgent(run.agents, { id: agent.id, at }) } : run
    }

    case 'agent_retired':
      return { ...run, agents: (run.agents ?? []).filter((agent) => agent.id !== str(p.agent_id)) }

    case 'heartbeat':
    case 'run_progress': {
      const snapshot = p.snapshot === true
      const reported = str(p.status)
      // A snapshot says what the run is, so a waiting run is not turned into a
      // running one by opening its stream. Every other frame comes from a run
      // that is being worked on.
      const status = snapshot && reported
        ? toStatus(reported)
        : run.status === 'queued' ? 'running' : run.status
      // The server restarted if it reports being behind us; forget what we have
      // seen so its new events are not mistaken for old ones.
      const lastSeq = snapshot && num(p.last_seq) !== undefined && run.lastSeq !== undefined && (num(p.last_seq) as number) < run.lastSeq
        ? undefined
        : run.lastSeq
      const collected = num(p.records_collected) ?? num(p.records_found)
      const agents = Array.isArray(p.agents)
        ? (p.agents as Record<string, unknown>[]).map(toAgent).filter((a): a is AgentInfo => a !== null)
        : run.agents
      return {
        ...run,
        status,
        lastSeq,
        stoppedAtLimit: reported === 'stopped_at_limit' ? true : run.stoppedAtLimit,
        stopReason: str(p.stop_reason) ?? run.stopReason,
        // Spend, people and tokens only ever climb within a run, so the larger
        // of what is shown and what arrives is the later one whichever source
        // it came from. (The row a snapshot reads can be a heartbeat behind.)
        spendUsd: Math.max(num(p.spend_usd) ?? 0, run.spendUsd ?? 0),
        tokensIn: Math.max(num(p.tokens_in) ?? 0, run.tokensIn ?? 0),
        tokensOut: Math.max(num(p.tokens_out) ?? 0, run.tokensOut ?? 0),
        sitesTotal: num(p.sites_total) ?? run.sitesTotal,
        sitesCompleted: num(p.sites_completed) ?? run.sitesCompleted,
        sitesFailed: num(p.sites_failed) ?? run.sitesFailed,
        sitesPending: num(p.sites_pending) ?? run.sitesPending,
        traineesFound: Math.max(num(p.trainees_collected) ?? 0, run.traineesFound ?? 0) || undefined,
        agents,
        counts: {
          ...counts,
          peopleFound: Math.max(collected ?? 0, counts.peopleFound),
          emailsFound: Math.max(num(p.emails_collected) ?? 0, counts.emailsFound),
          newCount: num(p.records_new) ?? counts.newCount,
          changedCount: num(p.records_changed) ?? counts.changedCount,
          missingCount: num(p.records_missing) ?? counts.missingCount,
        },
      }
    }

    case 'site_started': {
      const agent = toAgent({ ...p, message: 'Starting the crawl' })
      return {
        ...run,
        status: 'running',
        stage: 'discovering',
        queuePosition: undefined,
        agents: agent ? upsertAgent(run.agents, agent) : run.agents,
        feed: push({ kind: 'note', message: `Started crawling ${str(p.domain) ?? 'the school'}` }),
      }
    }

    case 'site_step': {
      const agent = toAgent(p)
      const agents = agent ? upsertAgent(run.agents, agent) : run.agents
      const stage = str(p.stage)
      if (stage && STAGES.has(stage)) {
        return {
          ...run,
          agents,
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
          agents,
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
        agents,
        stage: run.stage === 'discovering' || !run.stage ? 'directory' : run.stage,
        // Pages read is the school's own step count, not a tally of events, so
        // it is right after a reload or a reconnect too. The heartbeat, not a
        // sum over pages, is what says how many people there are.
        pagesRead: Math.max(run.pagesRead ?? 0, num(p.steps_taken) ?? (run.pagesRead ?? 0) + 1),
        feed: push({
          kind: 'page',
          message: message ?? `Read ${str(p.url) ?? 'a page'}`,
          url: str(p.url),
          records,
          trainees,
        }),
      }
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
          agents: [],
          queuePosition: undefined,
          errorMessage: event.type === 'run_failed' ? (str(p.error) ?? run.errorMessage) : run.errorMessage,
          stoppedAtLimit: event.type === 'run_stopped_at_limit',
          spendUsd: Math.max(num(p.spend_usd) ?? 0, run.spendUsd ?? 0),
        }
      }
      return run
  }
}

/**
 * Fold a freshly fetched run row into what the live stream has already shown.
 *
 * The stream owns what only it knows: the feed, the agents, the per-page
 * tallies. The row owns what is settled: status, queue position, name. Spend and
 * people only climb, so the larger of the two wins whichever source it came from.
 */
export function mergeRun(current: Run | null | undefined, latest: Run): Run {
  if (!current || current.id !== latest.id) return latest
  const finished = TERMINAL_STATUSES.has(latest.status)
  const merged: Run = { ...current, ...withoutUndefined(latest) }
  return {
    ...merged,
    // A row read between "created" and "started" still says queued; the stream
    // has already proved otherwise.
    status: current.status === 'running' && latest.status === 'queued' ? 'running' : merged.status,
    // No longer waiting is a fact about the row, and `withoutUndefined` above
    // would keep the stale position.
    queuePosition: latest.status === 'queued' ? latest.queuePosition : undefined,
    stage: finished ? (latest.stage ?? current.stage ?? 'complete') : (current.stage ?? latest.stage),
    feed: current.feed?.length ? current.feed : latest.feed,
    agents: finished ? [] : current.agents,
    pagesRead: Math.max(current.pagesRead ?? 0, latest.pagesRead ?? 0) || undefined,
    traineesFound: Math.max(current.traineesFound ?? 0, latest.traineesFound ?? 0) || undefined,
    programsTotal: current.programsTotal ?? latest.programsTotal,
    programsCovered: current.programsCovered ?? latest.programsCovered,
    lastSeq: current.lastSeq,
    spendUsd: Math.max(current.spendUsd ?? 0, latest.spendUsd ?? 0),
    tokensIn: Math.max(current.tokensIn ?? 0, latest.tokensIn ?? 0) || undefined,
    tokensOut: Math.max(current.tokensOut ?? 0, latest.tokensOut ?? 0) || undefined,
    counts: {
      ...(current.counts ?? EMPTY_COUNTS),
      ...withoutUndefined(latest.counts ?? {}),
      // The row is deduplicated across schools and pages, so once the run is
      // over it is the honest number; while it runs the larger is the later.
      peopleFound: finished
        ? (latest.counts?.peopleFound ?? current.counts?.peopleFound ?? 0)
        : Math.max(current.counts?.peopleFound ?? 0, latest.counts?.peopleFound ?? 0),
      emailsFound: Math.max(current.counts?.emailsFound ?? 0, latest.counts?.emailsFound ?? 0),
    },
  }
}
