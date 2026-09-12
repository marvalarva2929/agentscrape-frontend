export function ExtractedTextPanel({ text }: { text?: string }) {
  return (
    <div className="extracted-panel">
      <strong>Extracted text</strong>
      <p>{text ?? 'No extracted text available.'}</p>
    </div>
  )
}
