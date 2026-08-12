import { useEffect, useRef, useState } from 'react'
import { Icon } from './icons'

export interface LocationPickerInputProps {
  value: string
  onChange: (address: string) => void
  hasError?: boolean
  placeholder?: string
  disabled?: boolean
}

interface Suggestion {
  place_id: number
  display_name: string
}

export default function LocationPickerInput({
  value,
  onChange,
  hasError = false,
  placeholder = 'Type address (e.g. 123 Main St, New York)...',
  disabled = false,
}: LocationPickerInputProps) {
  const [query, setQuery] = useState(value)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Keep query in sync with external value changes
  useEffect(() => {
    setQuery(value)
  }, [value])

  // Debounced search to OpenStreetMap Nominatim
  useEffect(() => {
    if (!query.trim() || query.length < 3) {
      setSuggestions([])
      setIsOpen(false)
      return
    }

    // Skip fetching if user just clicked a suggestion matching current query
    if (suggestions.some((s) => s.display_name === query)) {
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query,
        )}&addressdetails=1&limit=5&countrycodes=us`
        const res = await fetch(url, {
          headers: {
            'Accept-Language': 'en-US,en;q=0.9',
          },
        })
        if (res.ok) {
          const data = (await res.json()) as Suggestion[]
          setSuggestions(data)
          setIsOpen(data.length > 0)
        }
      } catch (err) {
        console.error('Failed to fetch location suggestions:', err)
      } finally {
        setLoading(false)
      }
    }, 350)

    return () => clearTimeout(timer)
  }, [query])

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type="text"
          className={`field-input${hasError ? ' field-input--error' : ''}`}
          placeholder={placeholder}
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value)
            onChange(e.target.value)
          }}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true)
          }}
        />
        {loading && (
          <span
            style={{
              position: 'absolute',
              right: '12px',
              fontSize: '0.75rem',
              color: '#9ca3af',
              pointerEvents: 'none',
            }}
          >
            Searching...
          </span>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '4px',
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            maxHeight: '200px',
            overflowY: 'auto',
            padding: '4px 0',
            listStyle: 'none',
          }}
        >
          {suggestions.map((item) => (
            <li
              key={item.place_id}
              style={{
                padding: '8px 12px',
                fontSize: '0.84rem',
                color: '#374151',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                borderBottom: '1px solid #f3f4f6',
              }}
              onMouseDown={() => {
                setQuery(item.display_name)
                onChange(item.display_name)
                setIsOpen(false)
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = '#f3f4f6'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              <Icon.MapPin width={14} height={14} style={{ color: '#2563eb', flexShrink: 0 }} />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.display_name}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
