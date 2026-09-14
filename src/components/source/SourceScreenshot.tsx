import type { SourceProvenance } from '../../types/source'

/**
 * The page as it looked when we read it, with boxes over the exact fields.
 *
 * Boxes are stored in screenshot pixel coordinates, so they are converted to
 * percentages using the image's natural size — that keeps them aligned however
 * the image is scaled to fit.
 */
export function SourceScreenshot({ source }: { source: SourceProvenance }) {
  if (!source.screenshotAvailable || !source.screenshotUrl) {
    return (
      <div className="source-screenshot">
        <div className="screenshot-body empty">
          <p className="muted">
            The screenshot for this capture is no longer stored. The page address,
            title and capture time below are still exact.
          </p>
        </div>
      </div>
    )
  }

  const width = source.screenshotWidth ?? 0
  const height = source.screenshotHeight ?? 0
  const canPlaceBoxes = width > 0 && height > 0 && Boolean(source.fieldLocations)

  return (
    <div className="source-screenshot">
      <div className="browser-bar">
        <span className="dot red" />
        <span className="dot amber" />
        <span className="dot green" />
        <span className="address-bar">{source.sourceUrl}</span>
      </div>

      <div className="provenance-shot">
        <img src={source.screenshotUrl} alt={source.pageTitle ?? 'Source page'} />

        {canPlaceBoxes
          ? Object.entries(source.fieldLocations ?? {}).map(([field, box]) => (
              <div
                key={field}
                className="field-box"
                title={field}
                style={{
                  left: `${(box.x / width) * 100}%`,
                  top: `${(box.y / height) * 100}%`,
                  width: `${(box.width / width) * 100}%`,
                  height: `${(box.height / height) * 100}%`,
                }}
              />
            ))
          : null}
      </div>
    </div>
  )
}
