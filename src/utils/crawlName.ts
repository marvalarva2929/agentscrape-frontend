import type { Run } from '../types/run'

/**
 * What to call a crawl: the name it was given, else its school, else a plain word.
 * Crawls started from the command line were labelled `cli:<url>`; those read as
 * the school's address instead.
 */
export const crawlName = (run: Run) => {
  const label = run.label?.trim()
  if (label?.startsWith('cli:')) return run.schoolName ?? label.slice(4).replace(/^https?:\/\//, '')
  return label || run.schoolName || 'Crawl'
}

/** The name a crawl gets when nobody types one: its school and the moment it was queued. */
export const defaultCrawlName = (schoolName: string, now: Date = new Date()) =>
  `${schoolName} — ${now.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
