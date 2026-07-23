import { useEffect, useRef } from 'react'
import { Icon } from './icons'

export default function NewActionMenu({
  onClose,
  onAddJob,
  onCreateCrew,
}: {
  onClose: () => void
  onAddJob: () => void
  onCreateCrew: () => void
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
    <div className="new-action-menu" ref={ref}>
      <div className="new-action-menu__head">
        <h2>New Action</h2>
        <button type="button" className="icon-btn" onClick={onClose}>
          <Icon.X width={16} height={16} />
        </button>
      </div>
      <p className="new-action-menu__prompt">What would you like to do?</p>
      <button type="button" className="new-action-menu__option" onClick={onAddJob}>
        <Icon.Wrench />
        Add New Job
      </button>
      <button type="button" className="new-action-menu__option" onClick={onCreateCrew}>
        <Icon.Building />
        Create New Crew
      </button>
    </div>
  )
}
