import { describe, expect, it } from 'vitest'
import { applyRunEvent, mergeRun, toStatus, type RunEvent } from './runEvents'
import type { Run } from '../types/run'

const run = (over: Partial<Run> = {}): Run => ({ id: 'run-a', status: 'running', ...over })
const ev = (type: string, payload: Record<string, unknown> = {}): RunEvent => ({ type, payload })

describe('a waiting run', () => {
  it('is not turned into a running one by opening its stream', () => {
    const waiting = run({ status: 'queued', queuePosition: 2 })
    const next = applyRunEvent(waiting, ev('run_progress', { snapshot: true, status: 'pending', spend_usd: 0 }))
    expect(next.status).toBe('queued')
  })

  it('starts running on the first heartbeat, and stops being numbered', () => {
    const waiting = run({ status: 'queued', queuePosition: 1 })
    const started = applyRunEvent(waiting, ev('run_started'))
    expect(started.status).toBe('running')
    expect(started.queuePosition).toBeUndefined()
    expect(applyRunEvent(waiting, ev('heartbeat', { spend_usd: 0.01 })).status).toBe('running')
  })

  it('maps the backend words the UI does not use', () => {
    expect(toStatus('pending')).toBe('queued')
    expect(toStatus('stopped_at_limit')).toBe('completed')
  })

  it('takes its place from the row, and forgets it once it runs', () => {
    const waiting = run({ status: 'queued', queuePosition: 3 })
    expect(mergeRun(waiting, run({ status: 'queued', queuePosition: 2 })).queuePosition).toBe(2)
    expect(mergeRun(waiting, run({ status: 'running' })).queuePosition).toBeUndefined()
  })
})

describe('live figures', () => {
  it('takes spend, tokens, people, residents and emails from the heartbeat', () => {
    const next = applyRunEvent(run(), ev('heartbeat', {
      spend_usd: 0.42, tokens_in: 1000, tokens_out: 250,
      records_collected: 37, trainees_collected: 30, emails_collected: 12, active_agents: 1,
    }))
    expect(next.spendUsd).toBe(0.42)
    expect([next.tokensIn, next.tokensOut]).toEqual([1000, 250])
    expect(next.counts?.peopleFound).toBe(37)
    expect(next.traineesFound).toBe(30)
    expect(next.counts?.emailsFound).toBe(12)
  })

  it('never lets a stale snapshot pull spend or people back down', () => {
    const live = run({ spendUsd: 1.5, counts: { peopleFound: 90, peopleEnriched: 0, emailsFound: 0, newCount: 0, changedCount: 0, missingCount: 0 } })
    const next = applyRunEvent(live, ev('run_progress', { snapshot: true, status: 'running', spend_usd: 0, records_found: 0 }))
    expect(next.spendUsd).toBe(1.5)
    expect(next.counts?.peopleFound).toBe(90)
  })

  it('does not add a person to the count each time a page mentions them', () => {
    let current = run()
    current = applyRunEvent(current, ev('heartbeat', { records_collected: 10 }))
    for (let i = 0; i < 5; i += 1) current = applyRunEvent(current, ev('site_step', { url: `https://x.edu/${i}`, records: 4, message: 'page' }))
    expect(current.counts?.peopleFound).toBe(10)
  })

  it('counts pages from the school step count, so a reload does not undercount', () => {
    const next = applyRunEvent(run(), ev('site_step', { url: 'https://x.edu/a', steps_taken: 137, step_budget: 5000, message: 'read' }))
    expect(next.pagesRead).toBe(137)
  })
})

describe('agents', () => {
  it('shows who is working on what', () => {
    let current = applyRunEvent(run(), ev('agent_spawned', { agent_id: 'agent-0' }))
    current = applyRunEvent(current, ev('site_step', {
      agent_id: 'agent-0', domain: 'towerhealth.org', url: 'https://towerhealth.org/residents',
      message: 'Read the residents page', steps_taken: 4, step_budget: 40,
    }))
    expect(current.agents).toHaveLength(1)
    expect(current.agents?.[0]).toMatchObject({
      id: 'agent-0', domain: 'towerhealth.org', url: 'https://towerhealth.org/residents',
      message: 'Read the residents page', stepsTaken: 4, stepBudget: 40,
    })
  })

  it('drops an agent that retires', () => {
    let current = applyRunEvent(run(), ev('agent_spawned', { agent_id: 'agent-0' }))
    current = applyRunEvent(current, ev('agent_retired', { agent_id: 'agent-0' }))
    expect(current.agents).toEqual([])
  })

  it('is refreshed by the heartbeat roster, which is authoritative', () => {
    const next = applyRunEvent(run({ agents: [{ id: 'gone' }] }), ev('heartbeat', {
      agents: [{ agent_id: 'agent-1', domain: 'a.edu', message: 'reading', steps_taken: 2, step_budget: 9 }],
    }))
    expect(next.agents?.map((a) => a.id)).toEqual(['agent-1'])
  })

  it('is cleared when the run ends', () => {
    const next = applyRunEvent(run({ agents: [{ id: 'agent-0' }] }), ev('run_completed'))
    expect(next.agents).toEqual([])
  })
})

describe('a reconnect', () => {
  it('does not apply the replayed activity twice', () => {
    let current = run()
    current = applyRunEvent(current, ev('site_step', { seq: 7, url: 'https://x.edu/a', message: 'one', steps_taken: 1 }))
    current = applyRunEvent(current, ev('site_step', { seq: 8, url: 'https://x.edu/b', message: 'two', steps_taken: 2 }))
    const feedLength = current.feed?.length
    // The server replays what it remembers when the stream reopens.
    current = applyRunEvent(current, ev('site_step', { seq: 7, url: 'https://x.edu/a', message: 'one', steps_taken: 1 }))
    current = applyRunEvent(current, ev('site_step', { seq: 8, url: 'https://x.edu/b', message: 'two', steps_taken: 2 }))
    expect(current.feed).toHaveLength(feedLength ?? -1)
    // ...and something genuinely new is applied.
    current = applyRunEvent(current, ev('site_step', { seq: 9, url: 'https://x.edu/c', message: 'three', steps_taken: 3 }))
    expect(current.feed).toHaveLength((feedLength ?? 0) + 1)
  })

  it('takes new events from a server that restarted and counts from the start again', () => {
    let current = run({ lastSeq: 500 })
    current = applyRunEvent(current, ev('run_progress', { snapshot: true, status: 'running', last_seq: 3 }))
    current = applyRunEvent(current, ev('site_step', { seq: 4, url: 'https://x.edu/a', message: 'fresh', steps_taken: 1 }))
    expect(current.feed?.[0].message).toBe('fresh')
  })
})

describe('the end of a run', () => {
  it('reports a failure with its reason', () => {
    const next = applyRunEvent(run(), ev('run_failed', { error: 'MemoryCeilingExceeded: too much' }))
    expect(next.status).toBe('failed')
    expect(next.errorMessage).toContain('MemoryCeilingExceeded')
  })

  it('treats a run that hit its limit as finished, not failed', () => {
    const next = applyRunEvent(run(), ev('run_stopped_at_limit', { spend_usd: 9.9 }))
    expect(next.status).toBe('completed')
    expect(next.stoppedAtLimit).toBe(true)
    expect(next.spendUsd).toBe(9.9)
  })
})

describe('merging a fetched row', () => {
  it('keeps what only the stream knows', () => {
    const live = run({ feed: [{ id: '1', at: 'x', kind: 'note', message: 'hi' }], agents: [{ id: 'agent-0' }], pagesRead: 40, spendUsd: 2 })
    const merged = mergeRun(live, run({ spendUsd: 0 }))
    expect(merged.feed).toHaveLength(1)
    expect(merged.agents).toHaveLength(1)
    expect(merged.pagesRead).toBe(40)
    expect(merged.spendUsd).toBe(2)
  })

  it('is another run: it replaces, it never blends', () => {
    const merged = mergeRun(run({ id: 'run-a', spendUsd: 5 }), run({ id: 'run-b', spendUsd: 0 }))
    expect(merged.id).toBe('run-b')
    expect(merged.spendUsd).toBe(0)
  })

  it('takes the settled numbers once the run is over', () => {
    const live = run({ counts: { peopleFound: 300, peopleEnriched: 0, emailsFound: 0, newCount: 0, changedCount: 0, missingCount: 0 } })
    const done = run({ status: 'completed', counts: { peopleFound: 280, peopleEnriched: 0, emailsFound: 0, newCount: 0, changedCount: 0, missingCount: 0 } })
    expect(mergeRun(live, done).counts?.peopleFound).toBe(280)
  })
})
