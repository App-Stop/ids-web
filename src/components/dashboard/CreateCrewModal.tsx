import { useEffect, useState } from 'react'
import Modal from './Modal'
import Dropdown from './Dropdown'
import Avatar from './Avatar'
import { crewColors, type Job } from '../../lib/dashboardData'
import { Icon } from './icons'
import { createCrew, updateCrew, getCrewById, getCrewsSummary, removeCrewMember, type CreateCrewPayload, type UpdateCrewPayload, type CrewDataResponse, type UserItem } from '../../api/crewApi'
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
  /**
   * `assignedJobId` is the job picked in create mode — POST /crews can't attach
   * a job, so the caller follows up with a crew assignment on that job.
   */
  onSubmit: (data: CrewFormData, apiResponse?: CrewDataResponse, assignedJobId?: string | null) => void
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
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [apiError, setApiError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [leadSearch, setLeadSearch] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  /** Members the crew actually has on the server, so chip removal knows whether to call the API. */
  const [persistedMemberIds, setPersistedMemberIds] = useState<string[]>(crew?.members ?? [])
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)
  /**
   * The crew's existing lead, straight from GET /crews/:id. They're already a
   * 'crew-lead' with a crew, so they're deliberately absent from the selectable
   * pool — without their name held here the trigger would fall back to showing
   * the raw id.
   */
  const [currentLead, setCurrentLead] = useState<{ _id: string; name: string; rate?: number | null } | null>(null)

  useEffect(() => {
    let active = true
    const timer = setTimeout(async () => {
      setIsLoadingData(true)
      try {
        const usersRes = await getCrewsSummary({
          statusEmployee: 'roster',
          status: 'active',
          search: (leadSearch || memberSearch) ? (leadSearch || memberSearch) : undefined,
          limit: 100
        })

        if (!active) return

        if (usersRes.success && Array.isArray(usersRes.data)) {
          const currentLeadId = crew?.crewLeadId
          const currentMemberIds = crew?.members ?? []

          // POST/PATCH /crews promotes the chosen crewLead from labor to
          // crew-lead, and rejects anyone who isn't currently an active labor
          // with no crew. So both dropdowns list the same pool: unassigned
          // labors. `crew` comes from the user's assignCrew — null means no
          // crew; its `status` is the crew's job assignment, not membership.
          const isSelectable = (u: any) => {
            if (u.isActive === false) return false
            if (u.crew ?? u.assignCrew) return false
            return u.role === 'labor' || !u.role
          }

          const leads = usersRes.data.filter((u) => {
            const isCurrentlySelectedLead = isEdit && currentLeadId && u._id === currentLeadId
            return isSelectable(u) || isCurrentlySelectedLead
          })

          const labors = usersRes.data.filter((u) => {
            const isCurrentlySelectedMember = isEdit && currentMemberIds.includes(u._id)
            return isSelectable(u) || isCurrentlySelectedMember
          })

          setAvailableLeads(leads)
          setAvailableLabors(labors)
        }
      } catch (err) {
        // Without this the dropdowns just render "No options found", which is
        // indistinguishable from a roster that genuinely has nobody free.
        console.error('Failed to load crew modal options:', err)
        if (active) setApiError(getErrorMessage(err, 'Failed to load available crew members.'))
      } finally {
        if (active) setIsLoadingData(false)
      }
    }, 300)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [leadSearch, memberSearch, isEdit, crew?.crewLeadId, crew?.members?.join(',')])

  useEffect(() => {
    async function loadEditData() {
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
              const isPopulated = typeof cData.crewLead === 'object'
              const leadId = isPopulated ? cData.crewLead._id : cData.crewLead
              setCrewLeadId(leadId)
              if (isPopulated) {
                const leadName = `${cData.crewLead.firstName || ''} ${cData.crewLead.lastName || ''}`.trim()
                setCurrentLead({ _id: leadId, name: leadName || 'Crew Lead', rate: cData.crewLead.hourlyRate })
              }
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
              setPersistedMemberIds(ids)
              if (names.length > 0) setLaborNames(names)
            }
          }
        } catch (fetchErr) {
          setApiError(getErrorMessage(fetchErr, 'Failed to load crew details.'))
        }
      }
    }

    loadEditData()
  }, [isEdit, crew?.id])

  // A freshly picked lead comes from the dropdown's own options; the crew's
  // existing one is only known from GET /crews/:id.
  const selectedLead = availableLeads.find((c) => c._id === crewLeadId)
  const fallbackLead = currentLead && currentLead._id === crewLeadId ? currentLead : null
  const selectedLeadName = selectedLead
    ? `${selectedLead.firstName} ${selectedLead.lastName}`.trim()
    : fallbackLead?.name
  const selectedLeadRate =
    (selectedLead as any)?.rate ?? selectedLead?.hourlyRate ?? fallbackLead?.rate

  /**
   * The leader is drawn from the same pool of unassigned labors as the members,
   * so drop whoever holds that slot — the backend strips the lead out of
   * `members` on create anyway, and offering them twice just reads as a bug.
   */
  const memberOptions = availableLabors.filter((m) => m._id !== crewLeadId)

  /** Promoting someone already picked as a member moves them out of that list. */
  function selectCrewLead(id: string) {
    setCrewLeadId(id)
    if (selectedMemberIds.includes(id)) {
      const name = availableLabors.find((m) => m._id === id)
      const displayName = name ? `${name.firstName || ''} ${name.lastName || ''}`.trim() : ''
      setSelectedMemberIds((list) => list.filter((memberId) => memberId !== id))
      setLaborNames((list) => list.filter((n) => n !== displayName))
    }
  }

  const selectedJob = jobs.find((j) => j.id === jobId)
  const canSubmit = Boolean(crewName.trim() && crewLeadId) && !isSubmitting && !isLoadingData

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

  /**
   * A chip for a member the crew already has is detached server-side straight
   * away; one the user just picked in this session isn't on the crew yet, so
   * dropping it from local state is all that's needed.
   */
  async function removeMember(memberId: string, memberName: string) {
    const isPersisted = isEdit && crew?.id && persistedMemberIds.includes(memberId)

    if (isPersisted) {
      setRemovingMemberId(memberId)
      setApiError('')
      try {
        await removeCrewMember(crew.id, memberId)
        setPersistedMemberIds((list) => list.filter((id) => id !== memberId))
      } catch (err) {
        setApiError(getErrorMessage(err, 'Failed to remove member from crew.'))
        return
      } finally {
        setRemovingMemberId(null)
      }
    }

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
        onSubmit(formData, response.data, jobId)
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

      {isLoadingData && (
        <div style={{ padding: '0.4rem 0', color: '#6b7280', fontSize: '0.875rem', fontStyle: 'italic' }}>
          Loading crew details…
        </div>
      )}

      {apiError && (
        <div className="form-error-alert">
          <Icon.AlertCircle width={18} height={18} />
          <span>{apiError}</span>
        </div>
      )}

      <fieldset disabled={isLoadingData || isSubmitting} style={{ border: 'none', padding: 0, margin: 0, opacity: isLoadingData ? 0.6 : 1 }}>

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
        onChange={selectCrewLead}
        onSearchChange={setLeadSearch}
        searchValue={leadSearch}
        selectedLabel={
          selectedLeadName && (
            <span className="dd__avatar-label">
              <Avatar name={selectedLeadName} size={24} />
              {selectedLeadName} {selectedLeadRate ? `($${selectedLeadRate}/h)` : ''}
            </span>
          )
        }
        options={availableLeads.map((c: any) => {
          const name = `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Crew Lead'
          const rateVal = c.rate ?? c.hourlyRate
          return {
            id: c._id,
            searchText: name,
            label: (
              <span className="dd__avatar-label">
                <Avatar name={name} size={24} />
                {name} {rateVal ? `($${rateVal}/h)` : ''}
              </span>
            ),
          }
        })}
      />
      <label className="field-label">{isEdit ? 'Add Members (Labors)' : 'Members (Labors)*'}</label>
      <Dropdown
        value={null}
        placeholder="Select Members"
        onChange={(id) => {
          if (!id) return
          const member = availableLabors.find((m) => m._id === id)
          if (member) {
            const name = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Member'
            toggleMember(member._id, name)
          }
        }}
        onSearchChange={setMemberSearch}
        searchValue={memberSearch}
        selectedLabel="Select Members..."
        options={memberOptions.map((m: any) => {
          const name = `${m.firstName || ''} ${m.lastName || ''}`.trim() || 'Member'
          const rateVal = m.rate ?? m.hourlyRate
          const isSelected = selectedMemberIds.includes(m._id)
          return {
            id: m._id,
            searchText: name,
            label: (
              <span className="dd__avatar-label" style={{ justifyContent: 'space-between', width: '100%' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <Avatar name={name} size={24} />
                  {name} {rateVal ? `($${rateVal}/h)` : ''}
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
                    <button
                      type="button"
                      className="crew-chip-input__remove"
                      disabled={removingMemberId === id}
                      onClick={() => void removeMember(id, displayName)}
                      aria-label={`Remove ${displayName}`}
                    >
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className="color-picker" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              {[
                '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
                '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#f59e0b',
                '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6',
                '#06b6d4', '#0284c7', '#64748b'
              ].map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`color-swatch ${c.toLowerCase() === color.toLowerCase() ? 'is-selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}

              <label
                title="Choose custom color"
                className={`color-swatch ${![
                  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
                  '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#f59e0b',
                  '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6',
                  '#06b6d4', '#0284c7', '#64748b'
                ].some(c => c.toLowerCase() === color.toLowerCase()) ? 'is-selected' : ''}`}
                style={{
                  position: 'relative',
                  background: ![
                    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
                    '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#f59e0b',
                    '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6',
                    '#06b6d4', '#0284c7', '#64748b'
                  ].some(c => c.toLowerCase() === color.toLowerCase())
                    ? color
                    : 'conic-gradient(from 0deg, #ef4444, #f97316, #eab308, #22c55e, #06b6d4, #3b82f6, #a855f7, #ef4444)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.15)'
                }}
              >
                <input
                  type="color"
                  value={color.startsWith('#') && color.length === 7 ? color : '#3b82f6'}
                  onChange={(e) => setColor(e.target.value)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer'
                  }}
                />
                +
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              <span style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 500 }}>Hex Code:</span>
              <input
                type="text"
                className="field-input"
                style={{ width: '100px', height: '30px', fontSize: '0.82rem', fontFamily: 'monospace', padding: '0 8px' }}
                value={color}
                placeholder="#3b82f6"
                onChange={(e) => setColor(e.target.value)}
              />
              <span style={{ width: 22, height: 22, borderRadius: 4, background: color, border: '1px solid #d1d5db', display: 'inline-block' }} />
            </div>
          </div>
        </>
      )}

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
      </fieldset>
    </Modal>
  )
}
