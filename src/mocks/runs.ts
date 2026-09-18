import type { FeedItem, Run } from '../types/run'
import arizonaRun from './arizona-run.json'

/**
 * The agent-driven crawl of Arizona on 17 September 2026, as recorded: its
 * activity feed is replayed from that run's log. The run was stopped at
 * 34 minutes when the model account ran out of credits.
 */
export const mockRuns: Record<string, Run> = {
  'run-arizona': {
    id: 'run-arizona',
    schoolId: 'arizona',
    schoolName: 'University of Arizona College of Medicine – Tucson',
    status: 'completed',
    stage: 'complete',
    progress: 100,
    startedAt: '2026-09-17T22:51:27-05:00',
    finishedAt: '2026-09-17T23:25:55-05:00',
    elapsedSeconds: 2068,
    pagesRead: 544,
    traineesFound: 894,
    programsTotal: arizonaRun.programs,
    programsCovered: arizonaRun.covered,
    counts: {
      peopleFound: 1918,
      peopleEnriched: 1918,
      emailsFound: 904,
      newCount: 1918,
      changedCount: 0,
      missingCount: 0,
      failedCount: 0,
    },
    feed: arizonaRun.feed as FeedItem[],
  },
}

/** Static build: there is no crawler behind it, so a stream never advances. */
export const mockRunStream = (...args: [string, (event: { type: string; run?: Run }) => void]) => {
  void args
  return () => undefined
}
