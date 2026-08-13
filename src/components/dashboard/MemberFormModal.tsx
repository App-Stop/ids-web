import { useEffect, useState } from 'react'
import { Icon } from './icons'
import MenuDropdown from './MenuDropdown'
import type { CrewMenuOption, Status } from '../../lib/crewData'
import { createUser, updateUser, getUserById, getCrewsSummary, type CreateUserPayload, type UpdateUserPayload, type UserResponseData } from '../../api/crewApi'
import { parseApiErrors } from '../../lib/errors'
import './crew-modals.css'

export interface MemberFormData {
  memberId?: string
  firstName: string
  lastName: string
  emailLocalPart: string
  role: 'Labor' | 'Crew Lead'
  crewId: string | null
  rate: string
  status: Status
}

interface MemberFormModalProps {
  mode: 'add' | 'edit'
  crews: CrewMenuOption[]
  initial?: MemberFormData
  onCancel: () => void
  onSubmit: (data: MemberFormData, apiUserData?: UserResponseData) => void
  onRemove?: () => void
}

const ROLE_OPTIONS = [
  { id: 'Labor', label: 'Labor' },
  { id: 'Crew Lead', label: 'Crew Lead' },
]

const STATUS_OPTIONS = [
  { id: 'Active', label: 'Active' },
  { id: 'Inactive', label: 'Inactive' },
]

const EMPTY_FORM: MemberFormData = {
  firstName: '',
  lastName: '',
  emailLocalPart: '',
  role: 'Labor',
  crewId: null,
  rate: '',
  status: 'Active',
}

export default function MemberFormModal({ mode, crews, initial, onCancel, onSubmit, onRemove }: MemberFormModalProps) {
  const [form, setForm] = useState<MemberFormData>({
    ...EMPTY_FORM,
    crewId: null,
    ...initial,
  })
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [createdUserData, setCreatedUserData] = useState<UserResponseData | null>(null)
  const [useCustomPassword, setUseCustomPassword] = useState(false)
  const [customPassword, setCustomPassword] = useState('')
  const [availableCrews, setAvailableCrews] = useState<CrewMenuOption[]>(crews)
  const [isLoadingData, setIsLoadingData] = useState(true)

  useEffect(() => {
    async function loadData() {
      setIsLoadingData(true)
      try {
        const [crewsRes, userRes] = await Promise.all([
          getCrewsSummary(),
          mode === 'edit' && initial?.memberId ? getUserById(initial.memberId).catch(() => null) : Promise.resolve(null),
        ])

        let loadedCrews: CrewMenuOption[] = availableCrews
        if (crewsRes.success && Array.isArray(crewsRes.data) && crewsRes.data.length > 0) {
          loadedCrews = crewsRes.data.map((c) => {
            const leadObj = typeof c.crewLead === 'object' && c.crewLead !== null ? c.crewLead : null
            const leadName = leadObj ? `${leadObj.firstName || ''} ${leadObj.lastName || ''}`.trim() : c.name
            return {
              id: c._id,
              label: c.name,
              color: c.crewColor || '#3b82f6',
              avatarName: leadName,
            }
          })
          setAvailableCrews(loadedCrews)
        }

        if (userRes && userRes.success && userRes.data) {
          const u = userRes.data
          const assignedCrewId = u.assignCrew ? (typeof u.assignCrew === 'object' ? u.assignCrew._id : u.assignCrew) : null
          setForm((f) => ({
            ...f,
            firstName: u.firstName || f.firstName,
            lastName: u.lastName || f.lastName,
            role: u.role === 'crew-lead' ? 'Crew Lead' : 'Labor',
            rate: u.hourlyRate !== undefined && u.hourlyRate !== null ? String(u.hourlyRate) : f.rate,
            status: u.isActive ? 'Active' : 'Inactive',
            crewId: assignedCrewId ?? f.crewId,
          }))
        } else if (initial?.crewId && loadedCrews.length > 0) {
          const match = loadedCrews.find((c) => c.id === initial.crewId || c.label === initial.crewId)
          if (match) {
            setForm((f) => ({ ...f, crewId: match.id }))
          }
        }
      } catch (err) {
        console.error('Failed to load member modal details:', err)
      } finally {
        setIsLoadingData(false)
      }
    }

    loadData()
  }, [mode, initial?.memberId, initial?.crewId])

  const crewOptionsWithNone: CrewMenuOption[] = [
    { id: 'none', label: 'None', color: '#9ca3af' },
    ...availableCrews,
  ]

  function update<K extends keyof MemberFormData>(key: K, value: MemberFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit() {
    setApiError('')
    setFieldErrors({})

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setApiError('First Name and Last Name are required.')
      return
    }

    if (mode === 'add' && !form.emailLocalPart.trim()) {
      setApiError('Email address is required for creating a member.')
      return
    }

    if (mode === 'add' && useCustomPassword && !customPassword.trim()) {
      setApiError('Please enter a custom password or uncheck the box to generate one automatically.')
      return
    }

    setIsSubmitting(true)

    try {
      if (mode === 'add') {
        const payload: CreateUserPayload = {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: `${form.emailLocalPart.trim()}@idsdemo.com`,
          role: 'labor',
          hourlyRate: Number(form.rate) || undefined,
          assignCrew: form.crewId && form.crewId !== 'none' ? form.crewId : undefined,
          password: useCustomPassword && customPassword.trim() ? customPassword.trim() : undefined,
        }

        const res = await createUser(payload)
        if (res.data.temporaryPassword) {
          setTempPassword(res.data.temporaryPassword)
          setCreatedUserData(res.data)
        } else {
          onSubmit(form, res.data)
        }
      } else {
        if (!form.memberId) {
          onSubmit(form)
          return
        }
        const patchPayload: UpdateUserPayload = {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          role: form.role === 'Crew Lead' ? 'crew-lead' : 'labor',
          hourlyRate: Number(form.rate) || undefined,
          assignCrew: form.crewId && form.crewId !== 'none' ? form.crewId : null,
          isActive: form.status === 'Active',
        }
        await updateUser(form.memberId, patchPayload)
        onSubmit(form)
      }
    } catch (err: any) {
      const parsed = parseApiErrors(err, `Failed to ${mode === 'add' ? 'create' : 'update'} user.`)
      setApiError(parsed.generalMessage)
      setFieldErrors(parsed.fieldErrors)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (tempPassword && createdUserData) {
    return (
      <div className="cm-overlay" onClick={() => onSubmit(form, createdUserData)}>
        <div className="cm-card cm-card--narrow cm-card--member" onClick={(e) => e.stopPropagation()}>
          <h2 className="cm-card__title cm-card__title--pad">User Created Successfully</h2>
          <p style={{ fontSize: '14px', color: '#4b5563', marginBottom: '12px' }}>
            Please save this temporary password now. It will not be shown or retrievable again:
          </p>
          <div style={{ background: '#f3f4f6', padding: '12px', borderRadius: '6px', textAlign: 'center', fontWeight: 'bold', fontSize: '18px', letterSpacing: '1px', marginBottom: '16px', color: '#111827' }}>
            {tempPassword}
          </div>
          <div className="cm-card__footer cm-card__footer--center">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => onSubmit(form, createdUserData)}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )
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

        {isLoadingData && (
          <div style={{ padding: '0.4rem 0', color: '#6b7280', fontSize: '0.875rem', fontStyle: 'italic' }}>
            Loading member details…
          </div>
        )}

        {apiError && (
          <div className="form-error-alert" style={{ marginTop: '0', marginBottom: '1rem' }}>
            <Icon.AlertCircle width={18} height={18} />
            <span>{apiError}</span>
          </div>
        )}

        <fieldset disabled={isLoadingData || isSubmitting} style={{ border: 'none', padding: 0, margin: 0, opacity: isLoadingData ? 0.6 : 1 }}>

        <div className="cm-field-row">
          <label className="cm-field">
            <span className="cm-field__label">First Name*</span>
            <input
              className={`cm-input${fieldErrors.firstName ? ' field-input--error' : ''}`}
              value={form.firstName}
              onChange={(e) => update('firstName', e.target.value)}
              placeholder="John"
            />
            {fieldErrors.firstName && <span className="field-error-text">{fieldErrors.firstName}</span>}
          </label>
          <label className="cm-field">
            <span className="cm-field__label">Last Name*</span>
            <input
              className={`cm-input${fieldErrors.lastName ? ' field-input--error' : ''}`}
              value={form.lastName}
              onChange={(e) => update('lastName', e.target.value)}
              placeholder="Verdan"
            />
            {fieldErrors.lastName && <span className="field-error-text">{fieldErrors.lastName}</span>}
          </label>
        </div>

        {mode === 'add' && (
          <label className="cm-field">
            <span className="cm-field__label">Email address</span>
            <span className={`cm-input cm-input--split${fieldErrors.email ? ' field-input--error' : ''}`}>
              <input
                className="cm-input__bare"
                value={form.emailLocalPart}
                onChange={(e) => update('emailLocalPart', e.target.value)}
                placeholder="johndoe"
              />
              <span className="cm-input__suffix">@idsdemo.com</span>
            </span>
            {fieldErrors.email && <span className="field-error-text">{fieldErrors.email}</span>}
          </label>
        )}

        <label className="cm-field">
          <span className="cm-field__label">Assign Crew</span>
          <MenuDropdown
            options={crewOptionsWithNone}
            value={form.crewId ?? 'none'}
            onChange={(id) => update('crewId', id === 'none' ? null : id)}
            placeholder="Select crew"
            panelTitle="Crew Menu"
            showAvatar
            showDot
            className="cm-field__dropdown"
          />
          {(fieldErrors.assignCrew || fieldErrors.crewId) && (
            <span className="field-error-text">{fieldErrors.assignCrew || fieldErrors.crewId}</span>
          )}
        </label>

        <label className="cm-field">
          <span className="cm-field__label">Hourly Rate</span>
          <span className={`cm-input cm-input--split${fieldErrors.hourlyRate || fieldErrors.rate ? ' field-input--error' : ''}`}>
            <span className="cm-input__prefix">$</span>
            <input
              className="cm-input__bare"
              inputMode="decimal"
              value={form.rate}
              onChange={(e) => update('rate', e.target.value)}
              placeholder="20"
            />
          </span>
          {(fieldErrors.hourlyRate || fieldErrors.rate) && (
            <span className="field-error-text">{fieldErrors.hourlyRate || fieldErrors.rate}</span>
          )}
        </label>

        {mode === 'edit' && (
          <label className="cm-field">
            <span className="cm-field__label">Status</span>
            <MenuDropdown
              options={STATUS_OPTIONS}
              value={form.status}
              onChange={(id) => update('status', (id as Status) ?? 'Active')}
              placeholder="Select status"
              showDot={false}
              className="cm-field__dropdown"
            />
          </label>
        )}

        {mode === 'add' && (
          <div className="cm-field" style={{ marginTop: '4px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>
              <input
                type="checkbox"
                checked={useCustomPassword}
                onChange={(e) => {
                  setUseCustomPassword(e.target.checked)
                  if (!e.target.checked) setCustomPassword('')
                }}
              />
              Set custom password
            </label>
            {useCustomPassword ? (
              <input
                type="password"
                className="cm-input"
                style={{ marginTop: '8px' }}
                value={customPassword}
                onChange={(e) => setCustomPassword(e.target.value)}
                placeholder="Enter custom password"
              />
            ) : (
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                If left unchecked or omitted, the system will generate a password automatically.
              </p>
            )}
          </div>
        )}

        {apiError && <p className="field-error" style={{ marginTop: 10 }}>{apiError}</p>}

        <div className={`cm-card__footer ${mode === 'edit' ? 'cm-card__footer--split' : ''}`}>
          {mode === 'edit' && (
            <button type="button" className="cm-remove" onClick={() => setConfirmingRemove(true)}>
              <Icon.Trash width={15} height={15} />
              Remove
            </button>
          )}
          <div className="cm-card__footer-actions">
            <button type="button" className="btn btn--outline" disabled={isSubmitting} onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="btn btn--primary" disabled={isSubmitting} onClick={handleSubmit}>
              {isSubmitting ? 'Submitting...' : mode === 'add' ? 'Add to Roster' : 'Update'}
            </button>
          </div>
        </div>
        </fieldset>
      </div>
    </div>
  )
}
