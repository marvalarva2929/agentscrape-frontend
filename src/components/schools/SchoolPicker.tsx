import { useEffect, useMemo, useRef, useState } from 'react'
import type { School } from '../../types/school'

/**
 * Pick a school by typing its name. The list runs to hundreds of institutions,
 * where a plain select means scrolling for the one you want; matching also
 * covers the domain and location, because people reach for "uchicago" as often
 * as for the full name.
 */
export function SchoolPicker({
  schools,
  value,
  onSelect,
  onClear,
}: {
  schools: School[]
  /** The selected school id, or '' for a school that is not in the list yet. */
  value: string
  onSelect: (school: School) => void
  onClear: () => void
}) {
  const selected = useMemo(() => schools.find((school) => school.id === value) ?? null, [schools, value])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement | null>(null)

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return schools.slice(0, 50)
    return schools
      .filter((school) => `${school.name} ${school.rootDomain} ${school.location ?? ''}`.toLowerCase().includes(term))
      .slice(0, 50)
  }, [schools, query])

  // A click anywhere else is a dismissal, not a selection.
  useEffect(() => {
    if (!open) return
    const onDocumentClick = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocumentClick)
    return () => document.removeEventListener('mousedown', onDocumentClick)
  }, [open])

  useEffect(() => { setActive(0) }, [query])

  const choose = (school: School) => {
    onSelect(school)
    setQuery('')
    setOpen(false)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) { setOpen(true); return }
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((current) => (matches.length ? (current + step + matches.length) % matches.length : 0))
      return
    }
    if (event.key === 'Enter' && open && matches[active]) {
      event.preventDefault()
      choose(matches[active])
      return
    }
    if (event.key === 'Escape') setOpen(false)
  }

  return (
    <div className="school-picker" ref={boxRef}>
      <input
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls="school-picker-list"
        aria-autocomplete="list"
        value={open ? query : (selected?.name ?? query)}
        placeholder={selected ? selected.name : 'Search schools by name…'}
        onChange={(event) => { setQuery(event.target.value); setOpen(true) }}
        onFocus={() => { setQuery(''); setOpen(true) }}
        onKeyDown={onKeyDown}
      />
      {selected && !open && (
        <button
          type="button"
          className="school-picker-clear"
          aria-label={`Clear ${selected.name}`}
          onClick={() => { onClear(); setQuery(''); }}
        >
          ×
        </button>
      )}
      {open && (
        <ul className="school-picker-list" id="school-picker-list" role="listbox">
          <li
            role="option"
            aria-selected={!value}
            className={`school-picker-option new-school ${!value ? 'selected' : ''}`}
            onMouseDown={(event) => { event.preventDefault(); onClear(); setQuery(''); setOpen(false) }}
          >
            New school — enter the URL below
          </li>
          {matches.map((school, index) => (
            <li
              key={school.id}
              role="option"
              aria-selected={school.id === value}
              className={`school-picker-option ${index === active ? 'active' : ''} ${school.id === value ? 'selected' : ''}`}
              onMouseEnter={() => setActive(index)}
              onMouseDown={(event) => { event.preventDefault(); choose(school) }}
            >
              <strong>{school.name}</strong>
              <span>{[school.location, school.rootDomain].filter(Boolean).join(' · ')}</span>
            </li>
          ))}
          {!matches.length && <li className="school-picker-empty">No school matches “{query.trim()}”. Enter its URL below to crawl it.</li>}
        </ul>
      )}
    </div>
  )
}
