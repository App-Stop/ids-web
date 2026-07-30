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
  return (
    <div className="new-action-menu__overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="new-action-menu new-action-menu--modal">
        <div className="new-action-menu__head">
          <h2>Add new</h2>
          <button type="button" className="icon-btn icon-btn--bordered" onClick={onClose} aria-label="Close new action modal">
            <Icon.X width={16} height={16} />
          </button>
        </div>
        <p className="new-action-menu__prompt">What would you like to add?</p>
        <button type="button" className="new-action-menu__option" onClick={onAddJob}>
          <Icon.HardHat width={30} height={30} />
          <span>Add New Job</span>
        </button>
        <button type="button" className="new-action-menu__option" onClick={onCreateCrew}>
          <Icon.Users width={30} height={30} />
          <span>Create New Crew</span>
        </button>
      </div>
    </div>
  )
}
