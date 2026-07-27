import { Icon } from './icons'
import './crew-modals.css'

interface AddNewModalProps {
  onCancel: () => void
  onSelect: (kind: 'crew' | 'member') => void
}

export default function AddNewModal({ onCancel, onSelect }: AddNewModalProps) {
  return (
    <div className="cm-overlay" onClick={onCancel}>
      <div className="cm-card cm-card--narrow" onClick={(e) => e.stopPropagation()}>
        <div className="cm-card__header">
          <h2 className="cm-card__title">Add new</h2>
          <button type="button" className="cm-close" onClick={onCancel} aria-label="Close">
            <Icon.X width={16} height={16} />
          </button>
        </div>

        <p className="cm-subtitle">What would you like to add?</p>

        <div className="cm-choice-list">
          <button type="button" className="cm-choice" onClick={() => onSelect('crew')}>
            <Icon.Users width={22} height={22} />
            <span>Create New Crew</span>
          </button>
          <button type="button" className="cm-choice" onClick={() => onSelect('member')}>
            <Icon.HardHat width={22} height={22} />
            <span>Add New Member</span>
          </button>
        </div>
      </div>
    </div>
  )
}
