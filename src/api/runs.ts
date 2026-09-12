import { isMockMode } from './client'
import type { Run } from '../types/run'
import { mockRunStream, mockRuns } from '../mocks/runs'

export interface StartRunRequest {
  programId: string
  runDirectorySearch: boolean
  runNewCrawl: boolean
  directoryUrl?: string
  startUrl?: string
  peopleGoal?: number | null
  noFixedGoal?: boolean
}

export const runsApi = {
  async startRun(payload: StartRunRequest): Promise<Run> {
    if (isMockMode()) {
      const newRun: Run = {
        id: `run-${Date.now()}`,
        programId: payload.programId,
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
        runType: payload.runNewCrawl && payload.runDirectorySearch ? 'New Crawl + Directory Search' : payload.runNewCrawl ? 'New Crawl' : 'Directory Search',
        programUrl: payload.startUrl,
        directoryUrl: payload.directoryUrl,
        peopleGoal: payload.peopleGoal,
        noFixedGoal: payload.noFixedGoal,
      }
      mockRuns[newRun.id] = newRun
      return newRun
    }

    throw new Error('Backend API not connected')
  },

  async getRun(id: string): Promise<Run> {
    if (isMockMode()) {
      return mockRuns[id] ?? mockRuns['run-1']
    }

    throw new Error('Backend API not connected')
  },

  async cancelRun(id: string): Promise<void> {
    if (isMockMode()) {
      const run = mockRuns[id]
      if (run) {
        run.status = 'cancelled'
        run.stage = 'cancelled'
        run.finishedAt = new Date().toISOString()
      }
      return
    }

    throw new Error('Backend API not connected')
  },

  subscribeToRun(runId: string, onEvent: (event: { type: string; run?: Run }) => void) {
    if (isMockMode()) {
      return mockRunStream(runId, onEvent)
    }

    return () => undefined
  },
}
