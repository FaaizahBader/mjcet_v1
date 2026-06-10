import { useMemo, useState } from 'react'

export default function DestinationSearch({ destinations, value, onChange }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return destinations

    return destinations.filter(
      (destination) =>
        destination.label.toLowerCase().includes(normalized) ||
        destination.id.toLowerCase().includes(normalized),
    )
  }, [destinations, query])

  const handleSelect = (destination) => {
    onChange(destination)
    setQuery(destination.label)
    setOpen(false)
  }

  return (
    <div className="destination-search">
      <input
        type="search"
        placeholder="Search destination..."
        value={open ? query : value?.label ?? query}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        aria-label="Search destination"
        autoComplete="off"
      />

      {open && filtered.length > 0 && (
        <ul className="destination-list" role="listbox">
          {filtered.map((destination) => (
            <li key={destination.id}>
              <button
                type="button"
                role="option"
                onClick={() => handleSelect(destination)}
              >
                {destination.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
