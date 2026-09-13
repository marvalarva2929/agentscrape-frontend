/** Where a value came from. Survives screenshot expiry. */
export interface SourceProvenance {
  sourceUrl: string
  pageTitle?: string
  capturedAt?: string
  extractionMethod?: string
  confidence?: number
  screenshotAvailable?: boolean
  /** Signed and time-limited; usable directly as an <img> src. */
  screenshotUrl?: string
  /**
   * Natural size of the screenshot. Field boxes below are in screenshot pixel
   * coordinates, so these are needed to position them as percentages.
   */
  screenshotWidth?: number
  screenshotHeight?: number
  fieldLocations?: Record<string, { x: number; y: number; width: number; height: number }>
  /** Legacy mock field; the screenshot supersedes it. */
  sourceSnippet?: string
  extractedText?: string
}
