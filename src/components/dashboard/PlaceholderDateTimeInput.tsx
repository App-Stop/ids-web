import { useEffect, useRef, useState } from 'react'

/**
 * A date or time input that shows a real placeholder while it is empty.
 *
 * Native `<input type="date">` and `type="time"` ignore `placeholder` entirely
 * and draw the browser's own empty format instead — "mm/dd/yyyy", "--:--" —
 * which is both untranslatable and not the format this app writes elsewhere.
 * The workaround is to render a plain text input while the field is empty and
 * unfocused, and swap to the real one the moment it is focused, so the picker,
 * keyboard entry and validation all behave normally.
 *
 * The field is never editable as text: it only holds that type while blurred
 * and empty, so `onChange` always carries a value the native control produced.
 */
export default function PlaceholderDateTimeInput({
  type,
  placeholder,
  value,
  onChange,
  min,
  max,
  className = 'field-input',
  disabled,
  'aria-label': ariaLabel,
}: {
  type: 'date' | 'time'
  placeholder: string
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  className?: string
  disabled?: boolean
  'aria-label'?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  const showNative = focused || value !== ''

  // Focusing swapped the input to its real type; open the picker in the same
  // gesture so the placeholder state doesn't cost the user an extra click.
  useEffect(() => {
    if (!focused || value !== '') return
    const input = ref.current
    if (!input || typeof input.showPicker !== 'function') return
    try {
      input.showPicker()
    } catch {
      // Not a user gesture in this browser's eyes — the field still works,
      // it just won't pop the picker on its own.
    }
  }, [focused, value])

  return (
    <input
      ref={ref}
      type={showNative ? type : 'text'}
      className={className}
      placeholder={placeholder}
      value={value}
      min={min}
      max={max}
      disabled={disabled}
      aria-label={ariaLabel}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
