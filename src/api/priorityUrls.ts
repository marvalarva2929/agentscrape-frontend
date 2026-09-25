import { apiFetch, isMockMode } from './client'

/** What the backend extracted from a spreadsheet or Google Sheet, for the
 * client to review (and prune) before starting the crawl. */
interface PriorityUrlsPreviewResponse {
  urls: string[]
}

export const priorityUrlsApi = {
  /** Scan every cell of an .xlsx/.csv for recognizable URLs. Column- and
   * worksheet-agnostic on the backend - no upload schema to describe here. */
  async uploadSpreadsheet(file: File): Promise<string[]> {
    if (isMockMode()) return []
    const form = new FormData()
    form.append('file', file)
    const response = await apiFetch<PriorityUrlsPreviewResponse>('/priority-urls/upload', {
      method: 'POST',
      body: form,
    })
    return response.urls
  },

  /** A publicly/link-shared Google Sheet, read as a CSV export. */
  async fromGoogleSheet(sheetUrl: string): Promise<string[]> {
    if (isMockMode()) return []
    const response = await apiFetch<PriorityUrlsPreviewResponse>('/priority-urls/google-sheet', {
      method: 'POST',
      body: JSON.stringify({ sheet_url: sheetUrl }),
    })
    return response.urls
  },
}
