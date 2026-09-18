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
    agentActivity: [
      { id: 'agent-1', currentPage: 'https://www.ttuhsc.edu/medicine', currentAction: 'Indexing school pages', stepNumber: 7, recordsFound: 23 },
      { id: 'agent-2', currentPage: 'https://www.ttuhsc.edu/medicine/directory', currentAction: 'Parsing directory records', stepNumber: 16, recordsFound: 18 },
    ],
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

export const mockRunStream = (runId: string, onEvent: (event: { type: string; run?: Run }) => void) => {
  const run = mockRuns[runId] ?? mockRuns['run-1']
  let progress = run.progress ?? 0

  const timer = window.setInterval(() => {
    progress = Math.min(100, progress + 5)
    onEvent({
      type: 'progress',
      run: {
        ...run,
        progress,
        status: progress >= 100 ? 'completed' : 'running',
        stage: progress < 35 ? 'discovering' : progress < 80 ? 'directory' : 'finalizing',
        counts: {
          peopleFound: Math.min(47, (run.counts?.peopleFound ?? 0) + 2),
          peopleEnriched: Math.min(38, (run.counts?.peopleEnriched ?? 0) + 2),
          emailsFound: Math.min(38, (run.counts?.emailsFound ?? 0) + 1),
          newCount: run.counts?.newCount ?? 0,
          changedCount: run.counts?.changedCount ?? 0,
          missingCount: run.counts?.missingCount ?? 0,
          failedCount: run.counts?.failedCount ?? 0,
        },
      },
    })

    if (progress >= 100) {
      window.clearInterval(timer)
    }
  }, 1200)

  return () => window.clearInterval(timer)
}
