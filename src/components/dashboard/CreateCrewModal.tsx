import { useState } from 'react'
import Modal from './Modal'
import Dropdown from './Dropdown'
import Avatar from './Avatar'
import { crewColors, crewLeads, type Job } from '../../lib/dashboardData'

export type CrewStatus = 'active' | 'inactive' | 'unassigned'

const STATUS_OPTIONS: { id: CrewStatus; label: string; color: string }[] = [
  { id: 'active', label: 'Active', color: '#22c55e' },
  { id: 'inactive', label: 'Inactive', color: '#9ca3af' },
  { id: 'unassigned', label: 'Unassigned', color: '#f97316' },
]

export interface CrewFormData {
  crewName: string
  crewLeadId: string
  laborNames: string[]
  jobId: string | null
  status: CrewStatus
  color: string
  note: string
}

export interface EditableCrew {
  name: string
  color: string
  rate: number
  crewLeadId?: string
  laborNames?: string[]
  jobId?: string | null
  status?: CrewStatus
}

export default function CreateCrewModal({
  jobs,
  crew,
  onCancel,
  onSubmit,
  onRemove,
}: {
  jobs: Job[]
  crew?: EditableCrew
  onCancel: () => void
  onSubmit: (data: CrewFormData) => void
  onRemove?: () => void
}) {
  const isEdit = !!crew
  const [crewName, setCrewName] = useState(crew?.name ?? '')
  const [crewLeadId, setCrewLeadId] = useState<string | null>(crew?.crewLeadId ?? crewLeads[0]?.id ?? null)
  const [laborNames, setLaborNames] = useState<string[]>(crew?.laborNames ?? [])
  const [laborInput, setLaborInput] = useState('')
  const [jobId, setJobId] = useState<string | null>(crew?.jobId ?? null)
  const [status, setStatus] = useState<CrewStatus>(crew?.status ?? 'active')
  const [color, setColor] = useState(crew?.color ?? crewColors[0])
  const [note, setNote] = useState('')
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [laborError, setLaborError] = useState('')

  const selectedLead = crewLeads.find((c) => c.id === crewLeadId)
  const selectedJob = jobs.find((j) => j.id === jobId)
  const selectedStatus = STATUS_OPTIONS.find((s) => s.id === status)!
  const canSubmit = Boolean(crewName.trim() && crewLeadId)

  function addLaborName(rawName: string) {
    const value = rawName.trim()
    if (!value) return
    setLaborNames((list) => (list.some((name) => name.toLowerCase() === value.toLowerCase()) ? list : [...list, value]))
    setLaborInput('')
    setLaborError('')
  }

  function removeLaborName(nameToRemove: string) {
    setLaborNames((list) => list.filter((name) => name !== nameToRemove))
  }

  if (confirmingRemove) {
    return (
      <div className="cm-overlay" onClick={onCancel}>
        <div className="cm-card cm-card--narrow cm-confirm" onClick={(e) => e.stopPropagation()}>
          <div className="cm-confirm__icon">
            <svg viewBox="0 0 24 24" width={26} height={26} fill="currentColor" aria-hidden="true">
              <path d="M12 2 1 21h22L12 2zm0 7.5a1 1 0 0 1 1 1V15a1 1 0 1 1-2 0v-4.5a1 1 0 0 1 1-1zm0 8.9a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6z" />
            </svg>
          </div>
          <h2 className="cm-confirm__title">Are you sure you want to remove this crew?</h2>
          <p className="cm-confirm__sub">This action is irreversible</p>
          <div className="cm-card__footer cm-card__footer--center">
            <button type="button" className="btn btn--outline" onClick={() => setConfirmingRemove(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                onRemove?.()
                setConfirmingRemove(false)
              }}
            >
              Confirm Delete
            </button>
          </div>
        </div>
      </div>
    )
  }

  function handleSubmit() {
    if (!canSubmit) return
    if (!crewLeadId) return
    if (laborNames.length === 0) {
      setLaborError('At least one labor is required')
      return
    }
    setLaborError('')
    onSubmit({ crewName, crewLeadId: crewLeadId ?? '', laborNames, jobId, status, color, note })
  }

  return (
    <Modal onClose={onCancel} width={isEdit ? 520 : 480}>
      <h2 className="modal-title">{isEdit ? 'Edit Crew' : 'Create New Crew'}</h2>

      <label className="field-label">Crew Name*</label>
      <input className="field-input" placeholder="Enter Crew Name" value={crewName} onChange={(e) => setCrewName(e.target.value)} />

      <label className="field-label">Crew Leader*</label>
      <Dropdown
        value={crewLeadId}
        placeholder="-"
        onChange={setCrewLeadId}
        selectedLabel={
          selectedLead && (
            <span className="dd__avatar-label">
              <Avatar name={selectedLead.name} src={selectedLead.avatar} size={24} />
              {selectedLead.name} (${selectedLead.rate}/h)
            </span>
          )
        }
        options={crewLeads.map((c) => ({
          id: c.id,
          label: (
            <span className="dd__avatar-label">
              <Avatar name={c.name} src={c.avatar} size={24} />
              {c.name} (${c.rate}/h)
            </span>
          ),
        }))}
      />

      <label className="field-label">Labors*</label>
      <div className={`crew-chip-input${laborError ? ' is-invalid' : ''}`}>
        {laborNames.map((name) => (
          <span key={name} className="crew-chip-input__chip">
            {name}
            <button type="button" className="crew-chip-input__remove" onClick={() => removeLaborName(name)} aria-label={`Remove ${name}`}>
              ×
            </button>
          </span>
        ))}
        <input
          className="crew-chip-input__field"
          value={laborInput}
          onChange={(e) => {
            setLaborInput(e.target.value)
            if (laborError) setLaborError('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              addLaborName(laborInput)
            }
            if (e.key === 'Backspace' && !laborInput && laborNames.length > 0) {
              removeLaborName(laborNames[laborNames.length - 1])
            }
          }}
          onBlur={() => addLaborName(laborInput)}
          placeholder={laborNames.length === 0 ? 'Type a name and press Enter' : ''}
          aria-invalid={Boolean(laborError)}
        />
      </div>
      {laborError && <p className="field-error">{laborError}</p>}

      <label className="field-label">{isEdit ? 'Job Assigned' : 'Assign Job'}</label>
      <Dropdown
        value={jobId}
        placeholder="-"
        onChange={setJobId}
        selectedLabel={selectedJob?.name}
        options={jobs.map((j) => ({
          id: j.id,
          label: j.name,
        }))}
      />

      <label className="field-label">Status</label>
      <Dropdown
        value={status}
        onChange={(id) => setStatus(id as CrewStatus)}
        selectedLabel={
          <span className="dd__dot-label">
            <i className="dot" style={{ background: selectedStatus.color }} />
            {selectedStatus.label}
          </span>
        }
        options={STATUS_OPTIONS.map((s) => ({
          id: s.id,
          label: (
            <span className="dd__dot-label">
              <i className="dot" style={{ background: s.color }} />
              {s.label}
            </span>
          ),
        }))}
      />

      <label className="field-label">Crew Color</label>
      <div className="color-picker">
        {crewColors.map((c) => (
          <button
            key={c}
            type="button"
            className={`color-swatch ${c === color ? 'is-selected' : ''}`}
            style={{ background: c }}
            onClick={() => setColor(c)}
          />
        ))}
      </div>

      <label className="field-label">Add a note</label>
      <textarea
        className="field-textarea"
        placeholder="Note about the job..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <div className={`modal-actions ${isEdit ? 'modal-actions--split' : ''}`}>
        {isEdit && (
          <button type="button" className="cm-remove" onClick={() => setConfirmingRemove(true)}>
            <svg viewBox="0 0 24 24" width={15} height={15} fill="currentColor" aria-hidden="true">
              <path d="M9 3h6l1 2h5v2H3V5h5l1-2Zm1 6h2v8h-2V9Zm4 0h2v8h-2V9ZM6 9h2v8H6V9Zm1 13c-1.1 0-2-.9-2-2V9h14v11c0 1.1-.9 2-2 2H7Z" />
            </svg>
            Delete Crew
          </button>
        )}
        <div className="modal-actions__group">
          <button type="button" className="btn btn--outline" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" disabled={!canSubmit} onClick={handleSubmit}>
            {isEdit ? 'Update Crew' : 'Add Crew'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
