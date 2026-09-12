export function DirectorySearchConfig({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="field-group">
      <label className="input-label">Directory URL</label>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="https://school.edu/directory" />
      <small>Enter the official school or health system directory used to search for residents and fellows.</small>
    </div>
  )
}
