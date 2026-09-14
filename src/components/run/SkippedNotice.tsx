/**
 * Shown when a crawl finished in seconds because nothing on the site had
 * changed. Without this the run looks like it silently did nothing.
 */
export function SkippedNotice({
  lastScrapedAt,
  onCheckAnyway,
  busy,
}: {
  lastScrapedAt?: string
  onCheckAnyway: () => void
  busy?: boolean
}) {
  const when = lastScrapedAt ? formatDate(lastScrapedAt) : 'the last crawl'

  return (
    <section className="detail-section skip-notice">
      <div className="section-title-row">
        <h3>Nothing has changed since {when}</h3>
      </div>
      <p className="muted">
        The pages we collect from are identical to last time, so this crawl was
        skipped and nothing was charged.
      </p>
      <button className="primary-button" onClick={onCheckAnyway} disabled={busy}>
        {busy ? 'Starting…' : 'Check anyway'}
      </button>
    </section>
  )
}

function formatDate(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
