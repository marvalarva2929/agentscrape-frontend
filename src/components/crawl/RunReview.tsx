export function RunReview({
  schoolName,
  programName,
  runType,
  startUrl,
  directoryUrl,
  goalDescription,
}: {
  schoolName: string
  programName: string
  runType: 'directory' | 'crawl' | 'both'
  startUrl: string
  directoryUrl?: string
  goalDescription: string
}) {
  return (
    <div className="review-box">
      <div className="review-row"><span>School</span><strong>{schoolName}</strong></div>
      <div className="review-row"><span>Program</span><strong>{programName}</strong></div>
      <div className="review-row"><span>Actions selected</span><strong>{runType === 'directory' ? 'Directory Search' : runType === 'crawl' ? 'New Crawl' : 'New Crawl + Directory Search'}</strong></div>
      <div className="review-row"><span>Program URL</span><strong>{startUrl}</strong></div>
      {(runType === 'directory' || runType === 'both') && directoryUrl ? (
        <div className="review-row"><span>Directory URL</span><strong>{directoryUrl}</strong></div>
      ) : null}
      <div className="review-row"><span>People Goal</span><strong>{goalDescription}</strong></div>
    </div>
  )
}
