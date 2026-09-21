import { useEffect, useState } from 'react'
import { getPeopleStats, type PeopleStats } from '../api/people'
import { runsApi } from '../api/runs'
import { QueuePanel } from '../components/run/QueuePanel'
import type { RunQueue } from '../types/queue'
import type { School } from '../types/school'

const REFRESH_MS = 30000

interface Totals extends PeopleStats {
  crawls: number
  spendUsd: number
  lastCrawl?: string
}

const summary = (queue: RunQueue) => [
  queue.running.length > 0 && `${queue.running.length} running`,
  queue.waiting.length > 0 && `${queue.waiting.length} waiting`,
].filter(Boolean).join(' · ')

const n = (value: number) => value.toLocaleString()
const date = (value?: string) => (value ? new Date(value).toLocaleDateString() : '—')

export function HomePage({
  schools,
  queue,
  onViewData,
  onViewCrawls,
  onStartCrawl,
  onOpenRun,
}: {
  schools: School[]
  queue: RunQueue
  onViewData: () => void
  onViewCrawls: () => void
  onStartCrawl: () => void
  onOpenRun: (runId: string) => void
}) {
  const [totals, setTotals] = useState<Totals | null>(null)
  const [failed, setFailed] = useState(false)
  const schoolKey = schools.map((school) => school.id).join(',')

  useEffect(() => {
    let stopped = false
    const load = async () => {
      try {
        const [people, runs] = await Promise.all([
          getPeopleStats(schoolKey ? schoolKey.split(',') : []),
          runsApi.listRuns(20),
        ])
        if (stopped) return
        setTotals({
          ...people,
          crawls: runs.length,
          spendUsd: runs.reduce((sum, run) => sum + (run.spendUsd ?? 0), 0),
          lastCrawl: runs.map((run) => run.finishedAt ?? run.startedAt).filter(Boolean).sort().pop(),
        })
        setFailed(false)
      } catch {
        if (!stopped) setFailed(true)
      }
    }
    void load()
    const timer = window.setInterval(() => { if (document.visibilityState !== 'hidden') void load() }, REFRESH_MS)
    return () => { stopped = true; window.clearInterval(timer) }
  }, [schoolKey])

  const active = summary(queue)
  const withData = schools.filter((school) => (school.peopleCount ?? 0) > 0).length
  const tiles: { label: string; value: string; note?: string }[] = totals ? [
    { label: 'Schools', value: n(schools.length), note: `${withData} with data` },
    { label: 'People', value: n(totals.people) },
    { label: 'Residents & fellows', value: n(totals.trainees) },
    { label: 'With an email', value: n(totals.withEmail), note: totals.people ? `${Math.round((totals.withEmail / totals.people) * 100)}% of people` : undefined },
    { label: 'Crawls run', value: n(totals.crawls), note: `Last: ${date(totals.lastCrawl)}` },
    { label: 'Total cost', value: `$${totals.spendUsd.toFixed(2)}`, note: totals.crawls ? `$${(totals.spendUsd / totals.crawls).toFixed(2)} per crawl` : undefined },
  ] : []

  return (
    <main className="page-shell">
      <div className="page-header-row"><h2>What would you like to do?</h2></div>
      <div className="home-actions">
        <button className="home-button" onClick={onViewData}>
          <strong>View past data</strong>
        </button>
        <button className="home-button" onClick={onViewCrawls}>
          <strong>View running crawls</strong>
          {active && <span className="home-button-note">{active}</span>}
        </button>
        <button className="home-button primary" onClick={onStartCrawl}>
          <strong>Start a new crawl</strong>
        </button>
      </div>

      <div className="summary-row home-stats">
        {tiles.map((tile) => (
          <div key={tile.label} className="summary-card">
            <div className="summary-label">{tile.label}</div>
            <div className="summary-value">{tile.value}</div>
            {tile.note && <div className="muted">{tile.note}</div>}
          </div>
        ))}
      </div>
      {failed && !totals && <div className="error-banner">Could not load the totals.</div>}

      <section className="panel-block">
        <div className="section-title-row"><h3>Queue</h3></div>
        <QueuePanel compact onOpenRun={onOpenRun} />
      </section>
    </main>
  )
}
