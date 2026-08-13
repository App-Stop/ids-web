import { useRef, useState } from 'react'
import { Icon } from './icons'
import Avatar from './Avatar'
import './crew-modals.css'

export interface MenuDropdownOption {
  id: string
  label: string
  color?: string
  avatar?: string
  avatarName?: string
}

interface MenuDropdownProps {
  options: MenuDropdownOption[]
  value: string | null
  onChange: (id: string | null) => void
  placeholder: string
  includeAll?: boolean
  allLabel?: string
  showDot?: boolean
  showAvatar?: boolean
  panelTitle?: string
  align?: 'left' | 'right'
  direction?: 'up' | 'down' | 'auto'
  className?: string
}

function CrewAvatar({ src, name }: { src?: string; name: string }) {
  return <Avatar name={name} src={src} size={22} />
}

export default function MenuDropdown({
  options,
  value,
  onChange,
  placeholder,
  includeAll = false,
  allLabel = 'All',
  showDot = false,
  showAvatar = false,
  align = 'left',
  direction = 'auto',
  className = '',
}: MenuDropdownProps) {
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState<'up' | 'down'>('down')
  const wrapRef = useRef<HTMLDivElement>(null)
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const selected = options.find((o) => o.id === value)
  const label = value === null ? (includeAll ? allLabel : placeholder) : selected?.label ?? placeholder
  const useCrewItems = showAvatar || showDot

  function handleBlur() {
    closeTimeout.current = setTimeout(() => setOpen(false), 120)
  }
  function cancelBlur() {
    if (closeTimeout.current) clearTimeout(closeTimeout.current)
  }

  function handleToggle() {
    if (!open && wrapRef.current) {
      if (direction === 'up') {
        setPlacement('up')
      } else if (direction === 'down') {
        setPlacement('down')
      } else {
        const rect = wrapRef.current.getBoundingClientRect()
        const spaceBelow = window.innerHeight - rect.bottom
        const spaceAbove = rect.top
        setPlacement(spaceBelow < 220 && spaceAbove > spaceBelow ? 'up' : 'down')
      }
    }
    setOpen((o) => !o)
  }

  function renderCrewChrome(opt: MenuDropdownOption, withLabel: boolean) {
    return (
      <>
        {(showAvatar || opt.avatar || opt.avatarName) && (
          <CrewAvatar src={opt.avatar} name={opt.avatarName ?? opt.label} />
        )}
        {withLabel && <span>{opt.label}</span>}
        {showDot && opt.color && <i className="md-color-dot" style={{ background: opt.color }} />}
      </>
    )
  }

  const [search, setSearch] = useState('')

  const filteredOptions = search.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  return (
    <div ref={wrapRef} className={`md-wrap ${open ? 'is-open' : ''} ${className}`} onBlur={handleBlur} tabIndex={-1}>
      <button type="button" className="btn btn--outline md-trigger" onClick={handleToggle}>
        <span className="md-trigger__label">
          {useCrewItems && selected && value !== null ? (
            renderCrewChrome(selected, true)
          ) : (
            <span>{label}</span>
          )}
        </span>
        <Icon.ChevronDown width={14} height={14} />
      </button>

      {open && (
        <div className={`md-floating ${align === 'right' ? 'md-floating--right' : ''} ${placement === 'up' ? 'md-floating--up' : ''}`} onMouseDown={cancelBlur}>
          <div className="md-panel">
            {options.length > 4 && (
              <div style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
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
            {includeAll && (
              <button
                type="button"
                className={`md-option ${value === null ? 'md-option--selected' : ''}`}
                onClick={() => {
                  onChange(null)
                  setOpen(false)
                  setSearch('')
                }}
              >
                <span className="md-option__main">
                  <span className="md-option__label">{allLabel}</span>
                </span>
                {value === null && <Icon.Check width={14} height={14} />}
              </button>
            )}
            {filteredOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`md-option ${value === opt.id ? 'md-option--selected' : ''}`}
                onClick={() => {
                  onChange(opt.id)
                  setOpen(false)
                  setSearch('')
                }}
              >
                <span className="md-option__main">
                  {useCrewItems ? (
                    renderCrewChrome(opt, true)
                  ) : (
                    <span className="md-option__label">{opt.label}</span>
                  )}
                </span>
                {value === opt.id && <Icon.Check width={14} height={14} />}
              </button>
            ))}
            {filteredOptions.length === 0 && (
              <div style={{ padding: '8px 12px', fontSize: '12px', color: '#9ca3af', textAlign: 'center' }}>
                No results
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
