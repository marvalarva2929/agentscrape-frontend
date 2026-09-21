import { TERMINAL_EVENTS, type RunEvent } from './runEvents'

/**
 * A run's event stream that keeps itself open.
 *
 * `EventSource` gives up on some errors and the server is stopped and started
 * on demand, so a stream that closes on the first error goes quiet for good and
 * the monitor stops moving while still saying "Live". This one reopens with a
 * growing delay until the run is over or the person is signed out, and says
 * what state it is in so the page can show it.
 */

export type Connection = 'connecting' | 'live' | 'reconnecting' | 'stale'

interface SourceLike {
  onopen: ((event: Event) => void) | null
  onmessage: ((event: MessageEvent) => void) | null
  onerror: ((event: Event) => void) | null
  addEventListener(type: string, listener: EventListener): void
  close(): void
}

export interface StreamOptions {
  url: () => string
  eventTypes: string[]
  onEvent: (event: RunEvent) => void
  onConnection?: (state: Connection) => void
  /** Asked before each reconnect: false stops for good (the run is over, or signed out). */
  shouldReconnect?: () => Promise<boolean>
  createSource?: (url: string) => SourceLike
  /** No frame for this long and the stream is called stale. The server pings every 15 s. */
  staleAfterMs?: number
  backoffMs?: (attempt: number) => number
}

const defaultBackoff = (attempt: number) => Math.min(15000, 1000 * 2 ** Math.max(0, attempt - 1))

export function openRunStream(options: StreamOptions): () => void {
  const {
    url, eventTypes, onEvent, onConnection, shouldReconnect,
    createSource = (target: string) => new EventSource(target) as unknown as SourceLike,
    staleAfterMs = 25000,
    backoffMs = defaultBackoff,
  } = options

  let closed = false
  let source: SourceLike | null = null
  let attempt = 0
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let staleTimer: ReturnType<typeof setTimeout> | undefined
  let state: Connection = 'connecting'

  const setState = (next: Connection) => {
    if (next === state) return
    state = next
    onConnection?.(next)
  }
  const armStale = () => {
    clearTimeout(staleTimer)
    staleTimer = setTimeout(() => { if (!closed) setState('stale') }, staleAfterMs)
  }
  const stop = () => {
    closed = true
    clearTimeout(retryTimer)
    clearTimeout(staleTimer)
    source?.close()
    source = null
  }

  const open = () => {
    if (closed) return
    source?.close()
    const next = createSource(url())
    source = next

    next.onopen = () => {
      attempt = 0
      setState('live')
      armStale()
    }
    const handle = (raw: MessageEvent) => {
      // Any frame, even a heartbeat, proves the stream is alive.
      setState('live')
      armStale()
      try {
        const payload = JSON.parse(raw.data) as Record<string, unknown>
        const event: RunEvent = { type: String(payload.type ?? 'progress'), payload }
        onEvent(event)
        if (TERMINAL_EVENTS.has(event.type)) stop()
      } catch {
        /* a malformed frame should not tear down the stream */
      }
    }
    next.onmessage = handle
    for (const type of eventTypes) next.addEventListener(type, handle as EventListener)

    next.onerror = () => {
      next.close()
      if (closed) return
      attempt += 1
      setState('reconnecting')
      clearTimeout(staleTimer)
      retryTimer = setTimeout(async () => {
        if (closed) return
        let again = true
        try {
          again = shouldReconnect ? await shouldReconnect() : true
        } catch {
          again = true // could not even ask: the network is the problem, keep trying
        }
        if (!again) { stop(); return }
        open()
      }, backoffMs(attempt))
    }
  }

  open()
  return stop
}
