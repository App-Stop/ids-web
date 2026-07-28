import { useRef, useState } from 'react'
import { Icon } from './icons'
import './crew-modals.css'

export interface MenuDropdownOption {
  id: string
  label: string
  color?: string
}

interface MenuDropdownProps {
  options: MenuDropdownOption[]
  value: string | null
  onChange: (id: string | null) => void
  placeholder: string
  includeAll?: boolean
  allLabel?: string
  showDot?: boolean
  align?: 'left' | 'right'
  className?: string
}

function PersonDot({ color }: { color?: string }) {
  return (
    <span className="md-avatar">
      <svg viewBox="0 0 24 24" width={13} height={13} fill="none">
        <circle cx="12" cy="8" r="4" fill="currentColor" opacity={0.55} />
        <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="currentColor" opacity={0.55} />
      </svg>
      {color && <i className="md-avatar__dot" style={{ background: color }} />}
    </span>
  )
}

export default function MenuDropdown({
  options,
  value,
  onChange,
  placeholder,
  includeAll = false,
  allLabel = 'All',
  showDot = true,
  align = 'left',
  className = '',
}: MenuDropdownProps) {
  const [open, setOpen] = useState(false)
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const selected = options.find((o) => o.id === value)
  const label = value === null ? (includeAll ? allLabel : placeholder) : selected?.label ?? placeholder

  function handleBlur() {
    // Delay so a click on an option registers before we close the panel.
    closeTimeout.current = setTimeout(() => setOpen(false), 120)
  }
  function cancelBlur() {
    if (closeTimeout.current) clearTimeout(closeTimeout.current)
  }

  return (
    <div className={`md-wrap ${className}`} onBlur={handleBlur} tabIndex={-1}>
      <button type="button" className="btn btn--outline md-trigger" onClick={() => setOpen((o) => !o)}>
        <span className="md-trigger__label">
          {showDot && selected?.color && value !== null ? <PersonDot color={selected.color} /> : null}
          <span>{label}</span>
        </span>
        <Icon.ChevronDown width={14} height={14} />
      </button>

      {open && (
        <div className={`md-panel ${align === 'right' ? 'md-panel--right' : ''}`} onMouseDown={cancelBlur}>
          {includeAll && (
            <button
              type="button"
              className="md-option"
              onClick={() => {
                onChange(null)
                setOpen(false)
              }}
            >
              <span className="md-option__label">{allLabel}</span>
              {value === null && <Icon.Check width={14} height={14} />}
            </button>
          )}
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="md-option"
              onClick={() => {
                onChange(opt.id)
                setOpen(false)
              }}
            >
              {showDot && <PersonDot color={opt.color} />}
              <span className="md-option__label">{opt.label}</span>
              {value === opt.id && <Icon.Check width={14} height={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
