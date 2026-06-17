import { useMemo, useState } from 'react'

export default function DestinationSearch({
  destinations,
  value,
  onChange,
  onSubmitQuery,
}) {
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

  const handleSubmit = () => {
    const normalized = query.trim()
    if (!normalized) return

    const exactMatch = filtered.find(
      (destination) =>
        destination.label.toLowerCase() === normalized.toLowerCase() ||
        destination.id.toLowerCase() === normalized.toLowerCase(),
    )

    if (exactMatch) {
      handleSelect(exactMatch)
      return
    }

    onSubmitQuery?.(normalized)
    setOpen(false)
  }

  const handleClose = (event) => {
    event.preventDefault()
    event.stopPropagation()
    setOpen(false)
  }

  return (
    <div className="destination-search">
      <div className="destination-input-wrap">
        <input
          type="search"
          placeholder="Search destination..."
          value={open ? query : value?.label ?? query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              handleSubmit()
            }
          }}
          onFocus={() => setOpen(true)}
          aria-label="Search destination"
          autoComplete="off"
        />
        {open && (
          <button
            type="button"
            className="destination-close"
            onPointerDown={handleClose}
            onMouseDown={handleClose}
            onTouchStart={handleClose}
            onClick={handleClose}
            aria-label="Close destination dropdown"
          >
            X
          </button>
        )}
      </div>

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
