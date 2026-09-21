import type { Run } from '../types/run'

export const mockRuns: Record<string, Run> = {
  'run-1': {
    id: 'run-1',
    schoolId: 'school-1',
    status: 'running',
    stage: 'directory',
    startedAt: '2026-09-11T09:30:00Z',
    progress: 74,
    counts: {
      peopleFound: 34,
      peopleEnriched: 21,
      emailsFound: 19,
      newCount: 9,
      changedCount: 4,
      missingCount: 6,
      failedCount: 0,
    },
    schoolName: 'Texas Tech University Health Sciences Center',
    elapsedSeconds: 178,
    runType: 'New Crawl + Directory Search',
  },
  'run-2': {
    id: 'run-2',
    schoolId: 'school-1',
    status: 'completed',
    stage: 'complete',
    startedAt: '2026-09-10T08:00:00Z',
    finishedAt: '2026-09-10T08:18:00Z',
    progress: 100,
    counts: {
      peopleFound: 47,
      peopleEnriched: 38,
      emailsFound: 38,
      newCount: 9,
      changedCount: 4,
      missingCount: 6,
      failedCount: 0,
    },
    schoolName: 'Texas Tech University Health Sciences Center',
    elapsedSeconds: 1080,
    runType: 'New Crawl + Directory Search',
  },
}

/**
 * A stream shaped like the real one: heartbeats carrying the live figures and
 * the agent roster, and per-page steps. The events the real reducer folds in,
 * not a private format, so mock mode exercises the same code as production.
 */
export const mockRunStream = (runId: string, onEvent: (event: { type: string; run?: Run }) => void) => {
  const run = mockRuns[runId] ?? mockRuns['run-1']
  const emit = (type: string, payload: Record<string, unknown>) =>
    onEvent({ type, run: { type, ...payload } as unknown as Run })
  let step = 0
  let people = run.counts?.peopleFound ?? 0

  emit('run_started', { at: new Date().toISOString() })
  const timer = window.setInterval(() => {
    step += 1
    people = Math.min(47, people + 2)
    emit('site_step', {
      agent_id: 'agent-0', domain: 'www.ttuhsc.edu', url: `https://www.ttuhsc.edu/medicine/page-${step}`,
      message: `Read page ${step}`, records: 2, steps_taken: step, step_budget: 40, seq: step * 2,
    })
    emit('heartbeat', {
      spend_usd: step * 0.02, tokens_in: step * 900, tokens_out: step * 120, records_collected: people,
      trainees_collected: Math.floor(people * 0.8), emails_collected: Math.floor(people / 2), active_agents: 1,
      agents: [{ agent_id: 'agent-0', domain: 'www.ttuhsc.edu', url: `https://www.ttuhsc.edu/medicine/page-${step}`, message: `Read page ${step}`, steps_taken: step, step_budget: 40 }],
      seq: step * 2 + 1,
    })
    if (step >= 20) {
      window.clearInterval(timer)
      emit('run_completed', { status: 'completed', spend_usd: step * 0.02 })
    }
  }, 1200)

  return () => window.clearInterval(timer)
}
