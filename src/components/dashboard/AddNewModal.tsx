import { HardHat, UsersThree, X } from '@phosphor-icons/react'
import './crew-modals.css'

interface AddNewModalProps {
  onCancel: () => void
  onSelect: (kind: 'crew' | 'member') => void
}

export default function AddNewModal({ onCancel, onSelect }: AddNewModalProps) {
  return (
    <div className="cm-overlay" onClick={onCancel}>
      <div className="cm-card cm-card--narrow cm-card--add-new" onClick={(e) => e.stopPropagation()}>
        <div className="cm-card__header">
          <h2 className="cm-card__title">Add new</h2>
          <button type="button" className="cm-close cm-close--boxed" onClick={onCancel} aria-label="Close">
            <X size={16} weight="bold" />
          </button>
        </div>

        <p className="cm-subtitle cm-subtitle--add-new">What would you like to add?</p>

        <div className="cm-choice-list">
          <button type="button" className="cm-choice cm-choice--stacked" onClick={() => onSelect('crew')}>
            <UsersThree size={28} weight="fill" />
            <span>Create New Crew</span>
          </button>
          <button type="button" className="cm-choice cm-choice--stacked" onClick={() => onSelect('member')}>
            <HardHat size={28} weight="fill" />
            <span>Add New Member</span>
          </button>
        </div>
      </div>
    </div>
  )
}
