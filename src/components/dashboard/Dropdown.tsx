import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './icons'

export interface DropdownOption {
  id: string
  label: ReactNode
  /**
   * Text to match against when filtering. Required whenever `label` is JSX —
   * otherwise there is nothing readable to search and the option can only be
   * matched by its raw id.
   */
  searchText?: string
}

/** Below this many options, scanning the list beats typing — no search box. */
const SEARCH_THRESHOLD = 6

export default function Dropdown({
  value,
  options,
  placeholder = '-',
  selectedLabel,
  onChange,
  staticLabel,
  onSearchChange,
  searchValue,
  searchable,
  direction = 'auto',
}: {
  value: string | null
  options: DropdownOption[]
  placeholder?: string
  selectedLabel?: ReactNode
  onChange: (id: string) => void
  /** When set, the trigger always shows this text instead of the selection (checkmark still tracks value). */
  staticLabel?: string
  onSearchChange?: (val: string) => void
  searchValue?: string
  /** Force the search box on or off; defaults to showing it only for long lists. */
  searchable?: boolean
  /** Force dropdown direction to 'up', 'down', or 'auto' (opens up if near bottom). */
  direction?: 'up' | 'down' | 'auto'
}) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{
    top?: number
    bottom?: number
    left: number
    minWidth: number
    placement: 'up' | 'down'
  }>({
    left: 0,
    minWidth: 120,
    placement: 'down',
  })
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const menuRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node
      const inTrigger = ref.current && ref.current.contains(target)
      const inMenu = menuRef.current && menuRef.current.contains(target)
      if (!inTrigger && !inMenu) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function toggleOpen() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const placement =
        direction === 'up'
          ? 'up'
          : direction === 'down'
          ? 'down'
          : spaceBelow < 220 && spaceAbove > spaceBelow
          ? 'up'
          : 'down'

      if (placement === 'up') {
        setCoords({
          bottom: window.innerHeight - rect.top + 6,
          left: rect.left,
          minWidth: Math.max(120, rect.width),
          placement: 'up',
        })
      } else {
        setCoords({
          top: rect.bottom + 6,
          left: rect.left,
          minWidth: Math.max(120, rect.width),
          placement: 'down',
        })
      }
    }
    setOpen((o) => !o)
  }

  const [localSearch, setLocalSearch] = useState('')
  const search = searchValue !== undefined ? searchValue : localSearch

  const handleSearchChange = (val: string) => {
    if (onSearchChange) {
      onSearchChange(val)
    } else {
      setLocalSearch(val)
    }
  }

  // Server-driven search (onSearchChange) always gets a box; otherwise only
  // lists long enough to be worth filtering do.
  const showSearch = searchable ?? (onSearchChange !== undefined || options.length > SEARCH_THRESHOLD)

  const filteredOptions = onSearchChange
    ? options
    : search.trim()
      ? options.filter((o) => {
          // Prefer explicit searchText: a JSX label has no readable text to
          // match, so falling back to the id would only ever match a pasted id.
          const haystack = o.searchText ?? (typeof o.label === 'string' ? o.label : String(o.id))
          return haystack.toLowerCase().includes(search.toLowerCase())
        })
      : options

  return (
    <div className="dd" ref={ref}>
      <button ref={triggerRef} type="button" className="dd__trigger" onClick={toggleOpen}>
        <span className="dd__value">
          {staticLabel ??
            (selectedLabel ??
              options.find((o) => o.id === value)?.label ??
              (value || placeholder))}
        </span>
        <Icon.ChevronDown className="dd__chevron" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef as any}
            className="dd__menu-wrap"
            style={{
              position: 'fixed',
              ...(coords.placement === 'up'
                ? { bottom: `${coords.bottom}px` }
                : { top: `${coords.top}px` }),
              left: `${coords.left}px`,
              minWidth: `${coords.minWidth}px`,
              zIndex: 99999,
              background: '#ffffff',
              borderRadius: '8px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              border: '1px solid #e5e7eb',
              overflow: 'hidden',
            }}
          >
            {showSearch && (
              <div style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '4px 8px',
                    fontSize: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    outline: 'none',
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
            {/* .dd__menu is absolutely positioned for the old inline markup;
                inside the portal wrap that takes it out of flow and the wrap's
                overflow:hidden clips it away, so force it back into flow. The
                wrap already supplies the border/shadow/rounding. */}
            <ul
              className="dd__menu"
              style={{
                position: 'static',
                maxHeight: '200px',
                maxWidth: 'none',
                overflowY: 'auto',
                margin: 0,
                padding: '4px 0',
                listStyle: 'none',
                border: 'none',
                borderRadius: 0,
                boxShadow: 'none',
              }}
            >
              {filteredOptions.map((opt) => (
                <li
                  key={opt.id}
                  className={`dd__option${opt.id === value ? ' is-selected' : ''}`}
                  onClick={() => {
                    onChange(opt.id)
                    setOpen(false)
                    handleSearchChange('')
                  }}
                >
                  <span className="dd__option-label">{opt.label}</span>
                  {opt.id === value && <Icon.Check className="dd__check" />}
                </li>
              ))}
              {filteredOptions.length === 0 && (
                <li style={{ padding: '8px 12px', fontSize: '12px', color: '#9ca3af', textAlign: 'center' }}>
                  No options found
                </li>
              )}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  )
}
