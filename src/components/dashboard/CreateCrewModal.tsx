import { useEffect, useState } from 'react'
import Modal from './Modal'
import Dropdown from './Dropdown'
import Avatar from './Avatar'
import { crewColors, crewLeads as fallbackCrewLeads, type Job } from '../../lib/dashboardData'
import { Icon } from './icons'
import { createCrew, updateCrew, getCrewById, getUsers, type CreateCrewPayload, type UpdateCrewPayload, type CrewDataResponse, type UserItem } from '../../api/crewApi'
import { getErrorMessage, parseApiErrors } from '../../lib/errors'

export type CrewStatus = 'active' | 'inactive' | 'unassigned'

export interface CrewFormData {
  crewName: string
  crewLeadId: string
  members: string[]
  laborNames: string[]
  jobId: string | null
  status: CrewStatus
  color: string
  note: string
}

export interface EditableCrew {
  id: string
  name: string
  color: string
  rate?: number
  crewLeadId?: string
  members?: string[]
  laborNames?: string[]
  jobId?: string | null
  status?: CrewStatus
  note?: string
}

const CREW_STATUS_DROPDOWN = [
  { id: 'assigned', label: 'Assigned' },
  { id: 'un-assigned', label: 'Unassigned' },
]

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
  onSubmit: (data: CrewFormData, apiResponse?: CrewDataResponse) => void
  onRemove?: () => void
}) {
  const isEdit = !!crew
  const [crewName, setCrewName] = useState(crew?.name ?? '')
  const [availableLeads, setAvailableLeads] = useState<UserItem[]>([])
  const [availableLabors, setAvailableLabors] = useState<UserItem[]>([])
  const [crewLeadId, setCrewLeadId] = useState<string | null>(crew?.crewLeadId ?? null)
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(crew?.members ?? [])
  const [laborNames, setLaborNames] = useState<string[]>(crew?.laborNames ?? [])
  const [jobId, setJobId] = useState<string | null>(crew?.jobId ?? null)
  const [status, setStatus] = useState<string>(crew?.status === 'unassigned' ? 'un-assigned' : 'assigned')
  const [color, setColor] = useState(crew?.color ?? crewColors[0])
  const [note, setNote] = useState(crew?.note ?? '')
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [laborError, setLaborError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    async function loadData() {
      try {
        const [leadsRes, laborsRes] = await Promise.all([
          getUsers({ role: 'crew-lead', isActive: true }),
          getUsers({ role: 'labor', isActive: true }),
        ])

        if (leadsRes.success && Array.isArray(leadsRes.data)) {
          setAvailableLeads(leadsRes.data)
        }

        if (laborsRes.success && Array.isArray(laborsRes.data)) {
          setAvailableLabors(laborsRes.data)
        }

        if (isEdit && crew?.id) {
          try {
            const crewRes = await getCrewById(crew.id)
            if (crewRes.success && crewRes.data) {
              const cData = crewRes.data
              setCrewName(cData.name || '')
              if (cData.crewColor) setColor(cData.crewColor)
              if (cData.note) setNote(cData.note)
              if (cData.status) {
                setStatus(cData.status.toLowerCase() === 'unassigned' || cData.status.toLowerCase() === 'un-assigned' ? 'un-assigned' : 'assigned')
              }

              // Set Crew Lead ID
              if (cData.crewLead) {
                const leadId = typeof cData.crewLead === 'object' ? cData.crewLead._id : cData.crewLead
                setCrewLeadId(leadId)
              }

              // Set Members IDs and Names
              if (Array.isArray(cData.members)) {
                const ids: string[] = []
                const names: string[] = []
                cData.members.forEach((m) => {
                  if (typeof m === 'object' && m !== null) {
                    if (m._id) ids.push(m._id)
                    const mName = `${m.firstName || ''} ${m.lastName || ''}`.trim()
                    if (mName) names.push(mName)
                  } else if (typeof m === 'string') {
                    ids.push(m)
                  }
                })
                setSelectedMemberIds(ids)
                if (names.length > 0) setLaborNames(names)
              }
            }
          } catch (fetchErr) {
            setApiError(getErrorMessage(fetchErr, 'Failed to load crew details.'))
          }
        }
      } catch (err) {
        console.error('Failed to load crew modal options:', err)
      }
    }

    loadData()
  }, [isEdit, crew?.id])

  const selectedLead = availableLeads.find((c) => c._id === crewLeadId)
  const fallbackLead = fallbackCrewLeads.find((c) => c.id === crewLeadId)
  const selectedLeadName = selectedLead ? `${selectedLead.firstName} ${selectedLead.lastName}`.trim() : fallbackLead?.name
  const selectedLeadRate = selectedLead ? selectedLead.hourlyRate : fallbackLead?.rate

  const selectedJob = jobs.find((j) => j.id === jobId)
  const canSubmit = Boolean(crewName.trim() && crewLeadId) && !isSubmitting

  function toggleMember(memberId: string, memberName: string) {
    if (selectedMemberIds.includes(memberId)) {
      setSelectedMemberIds((list) => list.filter((id) => id !== memberId))
      setLaborNames((list) => list.filter((name) => name !== memberName))
    } else {
      setSelectedMemberIds((list) => [...list, memberId])
      setLaborNames((list) => [...list, memberName])
    }
    setLaborError('')
  }

  function removeMember(memberId: string, memberName: string) {
    setSelectedMemberIds((list) => list.filter((id) => id !== memberId))
    setLaborNames((list) => list.filter((name) => name !== memberName))
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

  async function handleSubmit() {
    if (!canSubmit) return
    if (!crewLeadId) return
    if (!isEdit && selectedMemberIds.length === 0 && laborNames.length === 0) {
      setLaborError('At least one member is required')
      return
    }
    setLaborError('')
    setApiError('')

    const memberPayload = selectedMemberIds.length > 0 ? selectedMemberIds : laborNames
    const formData: CrewFormData = {
      crewName,
      crewLeadId,
      members: memberPayload,
      laborNames,
      jobId,
      status: status === 'un-assigned' ? 'unassigned' : 'active',
      color,
      note,
    }

    setIsSubmitting(true)
    try {
      if (!isEdit) {
        const payload: CreateCrewPayload = {
          name: crewName,
          crewLead: crewLeadId,
          members: memberPayload,
          crewColor: color,
        }
        const response = await createCrew(payload)
        onSubmit(formData, response.data)
      } else {
        const patchPayload: UpdateCrewPayload = {
          name: crewName.trim(),
          crewLead: crewLeadId,
          ...(selectedMemberIds.length > 0 ? { members: selectedMemberIds } : {}),
          status,
          ...(note.trim() ? { note: note.trim() } : {}),
        }
        const response = await updateCrew(crew.id, patchPayload)
        onSubmit(formData, response.data)
      }
    } catch (err: any) {
      const parsed = parseApiErrors(err, `Failed to ${isEdit ? 'update' : 'create'} crew. Please try again.`)
      setApiError(parsed.generalMessage)
      setFieldErrors(parsed.fieldErrors)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal onClose={onCancel} width={isEdit ? 520 : 480}>
      <h2 className="modal-title">{isEdit ? 'Edit Crew' : 'Create New Crew'}</h2>

      {apiError && (
        <div className="form-error-alert">
          <Icon.AlertCircle width={18} height={18} />
          <span>{apiError}</span>
        </div>
      )}

      <label className="field-label">Crew Name*</label>
      <input
        className={`field-input${fieldErrors.name || fieldErrors.crewName ? ' field-input--error' : ''}`}
        placeholder="Enter Crew Name"
        value={crewName}
        onChange={(e) => setCrewName(e.target.value)}
      />
      {(fieldErrors.name || fieldErrors.crewName) && (
        <span className="field-error-text">{fieldErrors.name || fieldErrors.crewName}</span>
      )}

      <label className="field-label">Crew Leader*</label>
      {(fieldErrors.crewLead || fieldErrors.crewLeadId) && (
        <span className="field-error-text" style={{ marginBottom: '4px' }}>
          {fieldErrors.crewLead || fieldErrors.crewLeadId}
        </span>
      )}
      <Dropdown
        value={crewLeadId}
        placeholder="Select Crew Leader"
        onChange={setCrewLeadId}
        selectedLabel={
          selectedLeadName && (
            <span className="dd__avatar-label">
              <Avatar name={selectedLeadName} src={`https://i.pravatar.cc/64?img=${(crewLeadId?.charCodeAt(0) || 5) % 70}`} size={24} />
              {selectedLeadName} {selectedLeadRate ? `($${selectedLeadRate}/h)` : ''}
            </span>
          )
        }
        options={
          availableLabors.length > 0 || availableLeads.length > 0
            ? availableLeads.map((c) => {
                const name = `${c.firstName} ${c.lastName}`.trim()
                return {
                  id: c._id,
                  label: (
                    <span className="dd__avatar-label">
                      <Avatar name={name} src={`https://i.pravatar.cc/64?img=${(c._id.charCodeAt(0) || 5) % 70}`} size={24} />
                      {name} {c.hourlyRate ? `($${c.hourlyRate}/h)` : ''}
                    </span>
                  ),
                }
              })
            : fallbackCrewLeads.map((c) => ({
                id: c.id,
                label: (
                  <span className="dd__avatar-label">
                    <Avatar name={c.name} src={c.avatar} size={24} />
                    {c.name} (${c.rate}/h)
                  </span>
                ),
              }))
        }
      />

      <label className="field-label">{isEdit ? 'Add Members (Labors)' : 'Members (Labors)*'}</label>
      <Dropdown
        value={null}
        placeholder="Select Members"
        onChange={(id) => {
          if (!id) return
          const member = availableLabors.find((m) => m._id === id)
          if (member) {
            const name = `${member.firstName} ${member.lastName}`.trim()
            toggleMember(member._id, name)
          }
        }}
        selectedLabel="Select Members..."
        options={availableLabors.map((m) => {
          const name = `${m.firstName} ${m.lastName}`.trim()
          const isSelected = selectedMemberIds.includes(m._id)
          return {
            id: m._id,
            label: (
              <span className="dd__avatar-label" style={{ justifyContent: 'space-between', width: '100%' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <Avatar name={name} src={`https://i.pravatar.cc/64?img=${(m._id.charCodeAt(0) || 10) % 70}`} size={24} />
                  {name} {m.hourlyRate ? `($${m.hourlyRate}/h)` : ''}
                </span>
                {isSelected && <span style={{ color: '#22c55e', fontWeight: 'bold' }}>✓</span>}
              </span>
            ),
          }
        })}
      />

      {(selectedMemberIds.length > 0 || laborNames.length > 0) && (
        <div className="crew-chip-input" style={{ marginTop: '8px' }}>
          {selectedMemberIds.length > 0
            ? selectedMemberIds.map((id, index) => {
                const memberObj = availableLabors.find((m) => m._id === id)
                const displayName = memberObj
                  ? `${memberObj.firstName} ${memberObj.lastName}`.trim()
                  : laborNames[index] || `Member #${id.slice(-4)}`
                return (
                  <span key={id} className="crew-chip-input__chip">
                    {displayName}
                    <button type="button" className="crew-chip-input__remove" onClick={() => removeMember(id, displayName)} aria-label={`Remove ${displayName}`}>
                      ×
                    </button>
                  </span>
                )
              })
            : laborNames.map((name, index) => (
                <span key={index} className="crew-chip-input__chip">
                  {name}
                </span>
              ))}
        </div>
      )}
      {laborError && <p className="field-error">{laborError}</p>}

      {isEdit && (
        <>
          <label className="field-label">Status</label>
          <Dropdown
            value={status}
            placeholder="Select Status"
            onChange={(val) => val && setStatus(val)}
            selectedLabel={CREW_STATUS_DROPDOWN.find((s) => s.id === status)?.label}
            options={CREW_STATUS_DROPDOWN.map((s) => ({
              id: s.id,
              label: s.label,
            }))}
          />
        </>
      )}

      {!isEdit && (
        <>
          <label className="field-label">Assign Job</label>
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
        </>
      )}

      <label className="field-label">{isEdit ? 'Note' : 'Add a note'}</label>
      <textarea
        className="field-textarea"
        placeholder="Note about the crew..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      {apiError && <p className="field-error" style={{ marginTop: 12 }}>{apiError}</p>}

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
          <button type="button" className="btn btn--outline" disabled={isSubmitting} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" disabled={!canSubmit} onClick={handleSubmit}>
            {isSubmitting ? (isEdit ? 'Updating...' : 'Creating...') : isEdit ? 'Update Crew' : 'Add Crew'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
