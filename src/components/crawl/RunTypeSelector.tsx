export function RunTypeSelector({
  value,
  onChange,
}: {
  value: 'directory' | 'crawl' | 'both'
  onChange: (value: 'directory' | 'crawl' | 'both') => void
}) {
  return (
    <div className="run-options">
      <button className={`option-card ${value === 'directory' ? 'selected' : ''}`} onClick={() => onChange('directory')}>
        <strong>DIRECTORY SEARCH</strong>
        <span>Search the official school or health system directory for additional information about known people.</span>
      </button>
      <button className={`option-card ${value === 'crawl' ? 'selected' : ''}`} onClick={() => onChange('crawl')}>
        <strong>NEW CRAWL</strong>
        <span>Crawl the residency or fellowship program website to discover residents and fellows.</span>
      </button>
      <button className={`option-card ${value === 'both' ? 'selected' : ''}`} onClick={() => onChange('both')}>
        <strong>BOTH</strong>
        <span>Discover residents/fellows from the program website and then search the official directory for additional information.</span>
      </button>
    </div>
  )
}
