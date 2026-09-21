/**
 * Where the app is, written into the address bar, so a reload, a bookmark or the
 * back button brings the same screen back. A crawl has an address of its own
 * (`#/run/<id>`) because the monitor used to be lost on every reload.
 */
export type RoutableScreen = 'main' | 'queue' | 'history' | 'crawl' | 'run-monitor'

export interface Route {
  screen: RoutableScreen
  runId?: string
}

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const [head, id] = parts
  if (head === 'run' && id) return { screen: 'run-monitor', runId: decodeURIComponent(id) }
  if (head === 'queue') return { screen: 'queue' }
  if (head === 'past') return { screen: 'history' }
  if (head === 'crawl') return { screen: 'crawl' }
  return { screen: 'main' }
}

export function toHash(screen: string, runId?: string): string {
  switch (screen) {
    case 'run-monitor': return runId ? `#/run/${encodeURIComponent(runId)}` : '#/queue'
    case 'queue': return '#/queue'
    case 'history': return '#/past'
    case 'crawl': return '#/crawl'
    default: return '#/'
  }
}
