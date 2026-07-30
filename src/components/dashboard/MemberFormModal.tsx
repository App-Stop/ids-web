import { useState } from 'react'
import { Icon } from './icons'
import MenuDropdown from './MenuDropdown'
import type { CrewMenuOption } from '../../lib/crewData'
import './crew-modals.css'

export interface MemberFormData {
  firstName: string
  lastName: string
  emailLocalPart: string
  role: 'Labor' | 'Crew Lead'
  crewId: string | null
  rate: string
}

interface MemberFormModalProps {
  mode: 'add' | 'edit'
  crews: CrewMenuOption[]
  initial?: MemberFormData
  onCancel: () => void
  onSubmit: (data: MemberFormData) => void
  onRemove?: () => void
}

const ROLE_OPTIONS = [
  { id: 'Labor', label: 'Labor' },
  { id: 'Crew Lead', label: 'Crew Lead' },
]

export default function MemberFormModal({ mode, crews, initial, onCancel, onSubmit, onRemove }: MemberFormModalProps) {
  const [form, setForm] = useState<MemberFormData>(
    initial ?? { firstName: '', lastName: '', emailLocalPart: '', role: 'Labor', crewId: crews[0]?.id ?? null, rate: '' },
  )
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  function update<K extends keyof MemberFormData>(key: K, value: MemberFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  if (confirmingRemove) {
    return (
      <div className="cm-overlay" onClick={onCancel}>
        <div className="cm-card cm-card--narrow cm-card--member cm-confirm" onClick={(e) => e.stopPropagation()}>
          <div className="cm-confirm__icon">
            <Icon.AlertTriangle width={26} height={26} />
          </div>
          <h2 className="cm-confirm__title">Are you sure you want to remove this member?</h2>
          <p className="cm-confirm__sub">This action is irreversible</p>
          <div className="cm-card__footer cm-card__footer--center">
            <button type="button" className="btn btn--outline" onClick={() => setConfirmingRemove(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn--danger" onClick={onRemove}>
              Yes Remove
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="cm-overlay" onClick={onCancel}>
      <div className="cm-card cm-card--narrow cm-card--member" onClick={(e) => e.stopPropagation()}>
        <h2 className="cm-card__title cm-card__title--pad">{mode === 'add' ? 'Add New Member' : 'Edit Member'}</h2>

        <div className="cm-field-row">
          <label className="cm-field">
            <span className="cm-field__label">First Name*</span>
            <input
              className="cm-input"
              value={form.firstName}
              onChange={(e) => update('firstName', e.target.value)}
              placeholder="John"
            />
          </label>
          <label className="cm-field">
            <span className="cm-field__label">Last Name*</span>
            <input
              className="cm-input"
              value={form.lastName}
              onChange={(e) => update('lastName', e.target.value)}
              placeholder="Verdan"
            />
          </label>
        </div>

        <label className="cm-field">
          <span className="cm-field__label">Email address</span>
          <span className="cm-input cm-input--split">
            <input
              className="cm-input__bare"
              value={form.emailLocalPart}
              onChange={(e) => update('emailLocalPart', e.target.value)}
              placeholder="johndoe"
            />
            <span className="cm-input__suffix">@idsdemo.com</span>
          </span>
        </label>

        <label className="cm-field">
          <span className="cm-field__label">Role</span>
          <MenuDropdown
            options={ROLE_OPTIONS}
            value={form.role}
            onChange={(id) => update('role', (id as MemberFormData['role']) ?? 'Labor')}
            placeholder="Select role"
            showDot={false}
            className="cm-field__dropdown"
          />
        </label>

        <label className="cm-field">
          <span className="cm-field__label">Assign Crew</span>
          <MenuDropdown
            options={crews}
            value={form.crewId}
            onChange={(id) => update('crewId', id)}
            placeholder="Select crew"
            panelTitle="Crew Menu"
            showAvatar
            className="cm-field__dropdown"
          />
        </label>

        <label className="cm-field">
          <span className="cm-field__label">Hourly Rate</span>
          <span className="cm-input cm-input--split">
            <span className="cm-input__prefix">$</span>
            <input
              className="cm-input__bare"
              inputMode="decimal"
              value={form.rate}
              onChange={(e) => update('rate', e.target.value)}
              placeholder="20"
            />
          </span>
        </label>

        <div className={`cm-card__footer ${mode === 'edit' ? 'cm-card__footer--split' : ''}`}>
          {mode === 'edit' && (
            <button type="button" className="cm-remove" onClick={() => setConfirmingRemove(true)}>
              <Icon.Trash width={15} height={15} />
              Remove
            </button>
          )}
          <div className="cm-card__footer-actions">
            <button type="button" className="btn btn--outline" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="btn btn--primary" onClick={() => onSubmit(form)}>
              {mode === 'add' ? 'Add to Roster' : 'Update'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
