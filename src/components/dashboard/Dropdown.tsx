import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './icons'

export interface DropdownOption {
  id: string
  label: ReactNode
}

export default function Dropdown({
  value,
  options,
  placeholder = '-',
  selectedLabel,
  onChange,
  staticLabel,
}: {
  value: string | null
  options: DropdownOption[]
  placeholder?: string
  selectedLabel?: ReactNode
  onChange: (id: string) => void
  /** When set, the trigger always shows this text instead of the selection (checkmark still tracks value). */
  staticLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number; minWidth: number }>({ top: 0, left: 0, minWidth: 120 })
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
      setCoords({
        top: rect.bottom + 6,
        left: rect.left,
        minWidth: Math.max(120, rect.width),
      })
    }
    setOpen((o) => !o)
  }

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
          <ul
            ref={menuRef}
            className="dd__menu"
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              minWidth: `${coords.minWidth}px`,
              zIndex: 99999,
            }}
          >
            {options.map((opt) => (
              <li
                key={opt.id}
                className={`dd__option${opt.id === value ? ' is-selected' : ''}`}
                onClick={() => {
                  onChange(opt.id)
                  setOpen(false)
                }}
              >
                <span className="dd__option-label">{opt.label}</span>
                {opt.id === value && <Icon.Check className="dd__check" />}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  )
}
