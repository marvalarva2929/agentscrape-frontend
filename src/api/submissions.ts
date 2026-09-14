import { apiFetch, fetchAllPages, isMockMode } from './client'

/** One parsed row of a submitted CSV, as previewed before anything is spent. */
export interface SubmissionRow {
  row: number
  input: string
  url?: string | null
  valid: boolean
  error?: string | null
  known_site: boolean
  last_scraped_at?: string | null
  known_path_count: number
  previous_record_count: number
  predicted_skip: boolean
}

export interface Submission {
  id: string
  filename?: string | null
  note?: string | null
  status: 'pending' | 'running' | 'done' | 'rejected'
  row_count: number
  valid_count: number
  rows: SubmissionRow[]
  run_id?: string | null
  created_at: string
  reviewed_at?: string | null
}

export interface RunSubmissionRequest {
  maxSpendUsd?: number | null
  concurrency?: number
  forceRescan?: boolean
}

export const submissionsApi = {
  /** Client side: request schools. Does not start a crawl. */
  async submit(file: File, note?: string): Promise<Submission> {
    if (isMockMode()) {
      throw new Error('CSV submission is not available in mock mode')
    }
    const form = new FormData()
    form.append('file', file)
    if (note) form.append('note', note)
    return apiFetch<Submission>('/submissions', { method: 'POST', body: form })
  },

  /** Staff side: the review queue. */
  async list(): Promise<Submission[]> {
    if (isMockMode()) return []
    return fetchAllPages<Submission>('/admin/submissions', { pageSize: 50, maxPages: 4 })
  },

  /** Staff side: launch the crawl for every valid school in a submission. */
  async run(id: string, options: RunSubmissionRequest = {}): Promise<Submission> {
    return apiFetch<Submission>(`/admin/submissions/${id}/run`, {
      method: 'POST',
      body: JSON.stringify({
        max_spend_usd: options.maxSpendUsd ?? null,
        concurrency: options.concurrency ?? 4,
        force_rescan: options.forceRescan ?? false,
      }),
    })
  },
}
