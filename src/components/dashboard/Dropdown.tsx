import { useEffect, useRef, useState, type ReactNode } from 'react'
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
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  return (
    <div className="dd" ref={ref}>
      <button type="button" className="dd__trigger" onClick={() => setOpen((o) => !o)}>
        <span className="dd__value">{staticLabel ?? (value ? selectedLabel : placeholder)}</span>
        <Icon.ChevronDown className="dd__chevron" />
      </button>
      {open && (
        <ul className="dd__menu">
          {options.map((opt) => (
            <li
              key={opt.id}
              className={`dd__option${opt.id === value ? ' is-selected' : ''}`}
              onClick={() => {
                onChange(opt.id)
                setOpen(false)
              }}
            >
              {opt.label}
              {opt.id === value && <Icon.Check className="dd__check" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
