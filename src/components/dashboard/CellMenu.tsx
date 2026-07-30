import { useEffect, useRef } from 'react'

export default function CellMenu({
  x,
  y,
  onAssignCrew,
  onAddNote,
  onClose,
}: {
  x: number
  y: number
  onAssignCrew: () => void
  onAddNote: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [onClose])

  return (
    <div className="cell-menu" ref={ref} style={{ top: y, left: x }}>
      <button type="button" className="cell-menu__option" onClick={onAssignCrew}>
        Assign Crew
      </button>
      <button type="button" className="cell-menu__option" onClick={onAddNote}>
        Add Note
      </button>
    </div>
  )
}
