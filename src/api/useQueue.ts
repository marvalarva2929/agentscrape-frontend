import { useCallback, useEffect, useState } from 'react'
import { runsApi } from './runs'
import { EMPTY_QUEUE, queueIsBusy, type RunQueue } from '../types/queue'

const POLL_MS = 5000

/**
 * Poll the run queue.
 *
 * `busy` decides whether starting a school begins now or joins the queue, so
 * it is deliberately conservative: until the first reply arrives it reports
 * not-busy, and a failed poll keeps the last known answer rather than
 * inventing an empty queue.
 */
export function useQueue(enabled: boolean): { queue: RunQueue; busy: boolean; refresh: () => void } {
  const [queue, setQueue] = useState<RunQueue>(EMPTY_QUEUE)

  const refresh = useCallback(() => {
    if (!enabled) return
    void runsApi
      .getQueue()
      .then(setQueue)
      .catch(() => undefined)
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    refresh()
    const timer = window.setInterval(refresh, POLL_MS)
    return () => window.clearInterval(timer)
  }, [enabled, refresh])

  return { queue, busy: queueIsBusy(queue), refresh }
}
