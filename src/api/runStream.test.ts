import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openRunStream, type Connection } from './runStream'

class FakeSource {
  static all: FakeSource[] = []
  onopen: ((e: Event) => void) | null = null
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((e: Event) => void) | null = null
  closed = false
  listeners = new Map<string, EventListener>()
  url: string
  constructor(url: string) { this.url = url; FakeSource.all.push(this) }
  addEventListener(type: string, listener: EventListener) { this.listeners.set(type, listener) }
  close() { this.closed = true }
  send(payload: Record<string, unknown>) {
    const frame = { data: JSON.stringify(payload) } as MessageEvent
    this.listeners.get(String(payload.type))?.(frame as unknown as Event)
  }
}

const open = (extra: Partial<Parameters<typeof openRunStream>[0]> = {}) => {
  const events: string[] = []
  const states: Connection[] = []
  const stop = openRunStream({
    url: () => 'http://api/runs/r/events',
    eventTypes: ['heartbeat', 'site_step', 'run_completed'],
    onEvent: (e) => events.push(e.type),
    onConnection: (s) => states.push(s),
    createSource: (u) => new FakeSource(u),
    backoffMs: (attempt) => attempt * 100,
    staleAfterMs: 1000,
    ...extra,
  })
  return { events, states, stop, source: () => FakeSource.all[FakeSource.all.length - 1] }
}

beforeEach(() => { FakeSource.all = []; vi.useFakeTimers() })
afterEach(() => vi.useRealTimers())

describe('the run stream', () => {
  it('reports live once it opens and delivers events', () => {
    const { events, states, source } = open()
    source().onopen?.(new Event('open'))
    source().send({ type: 'heartbeat', spend_usd: 1 })
    expect(states).toEqual(['live'])
    expect(events).toEqual(['heartbeat'])
  })

  it('reopens after an error instead of going quiet for good', async () => {
    const { states, source } = open()
    source().onopen?.(new Event('open'))
    source().onerror?.(new Event('error'))
    expect(states.at(-1)).toBe('reconnecting')
    await vi.advanceTimersByTimeAsync(150)
    expect(FakeSource.all).toHaveLength(2)
    source().onopen?.(new Event('open'))
    expect(states.at(-1)).toBe('live')
  })

  it('waits longer after each failure', async () => {
    const { source } = open()
    source().onerror?.(new Event('error'))
    await vi.advanceTimersByTimeAsync(100)
    expect(FakeSource.all).toHaveLength(2)
    source().onerror?.(new Event('error'))
    await vi.advanceTimersByTimeAsync(150)
    expect(FakeSource.all).toHaveLength(2) // second wait is 200 ms
    await vi.advanceTimersByTimeAsync(100)
    expect(FakeSource.all).toHaveLength(3)
  })

  it('stops for good when the run is over or the person is signed out', async () => {
    const { source } = open({ shouldReconnect: async () => false })
    source().onerror?.(new Event('error'))
    await vi.advanceTimersByTimeAsync(500)
    expect(FakeSource.all).toHaveLength(1)
  })

  it('keeps trying when it cannot even check', async () => {
    const { source } = open({ shouldReconnect: async () => { throw new Error('offline') } })
    source().onerror?.(new Event('error'))
    await vi.advanceTimersByTimeAsync(150)
    expect(FakeSource.all).toHaveLength(2)
  })

  it('closes on the run ending', () => {
    const { source, events } = open()
    const first = source()
    first.send({ type: 'run_completed' })
    expect(events).toEqual(['run_completed'])
    expect(first.closed).toBe(true)
  })

  it('calls itself stale when nothing arrives', async () => {
    const { states, source } = open()
    source().onopen?.(new Event('open'))
    await vi.advanceTimersByTimeAsync(1100)
    expect(states.at(-1)).toBe('stale')
    source().send({ type: 'heartbeat' })
    expect(states.at(-1)).toBe('live')
  })

  it('does not reopen after it is closed by the caller', async () => {
    const { source, stop } = open()
    const first = source()
    stop()
    first.onerror?.(new Event('error'))
    await vi.advanceTimersByTimeAsync(1000)
    expect(FakeSource.all).toHaveLength(1)
  })
})
