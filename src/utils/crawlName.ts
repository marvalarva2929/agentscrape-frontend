import type { Run } from '../types/run'

/** What to call a crawl: the name it was given, else its school, else a plain word. */
export const crawlName = (run: Run) => run.label?.trim() || run.schoolName || 'Crawl'

/** The name a crawl gets when nobody types one: its school and the moment it was queued. */
export const defaultCrawlName = (schoolName: string, now: Date = new Date()) =>
  `${schoolName} — ${now.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
