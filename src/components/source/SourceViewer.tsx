import type { SourceProvenance } from '../../types/source'

export function SourceViewer({ source }: { source: SourceProvenance }) {
  return (
    <section className="detail-section">
      <div className="section-title-row">
        <h3>Source of Truth</h3>
        <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="primary-button small-button">
          Open Source
        </a>
      </div>

      <div className="source-meta">
        <div><span>Captured</span><strong>{source.capturedAt ?? '—'}</strong></div>
        <div><span>Source</span><strong>{source.sourceUrl}</strong></div>
      </div>

      <div className="extracted-panel">
        <strong>HTML / Extracted Snippet</strong>
        <pre>{source.sourceSnippet ?? source.extractedText ?? 'No source snippet available.'}</pre>
      </div>
    </section>
  )
}
