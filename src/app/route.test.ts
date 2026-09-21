import { describe, expect, it } from 'vitest'
import { parseHash, toHash } from './route'

describe('routes', () => {
  it('opens a crawl by its address', () => {
    expect(parseHash('#/run/run_abc123')).toEqual({ screen: 'run-monitor', runId: 'run_abc123' })
  })
  it('round-trips every screen', () => {
    for (const screen of ['main', 'queue', 'history', 'crawl'] as const) {
      expect(parseHash(toHash(screen)).screen).toBe(screen)
    }
    expect(parseHash(toHash('run-monitor', 'r 1'))).toEqual({ screen: 'run-monitor', runId: 'r 1' })
  })
  it('falls back to the main screen for anything it does not know', () => {
    expect(parseHash('')).toEqual({ screen: 'main' })
    expect(parseHash('#/nonsense')).toEqual({ screen: 'main' })
    expect(parseHash('#/run')).toEqual({ screen: 'main' })
  })
  it('sends a monitor without a run to the queue rather than a blank page', () => {
    expect(toHash('run-monitor')).toBe('#/queue')
  })
})
