import { useMemo, useState } from 'react'
import Modal from './Modal'
import Dropdown from './Dropdown'
import Avatar from './Avatar'
import { createCrewAssignment } from '../../api/jobApi'
import { type UserItem } from '../../api/crewApi'
import { useCrewsSummary } from '../../hooks/useQueryHooks'
import { parseApiErrors } from '../../lib/errors'
import type { Job } from '../../lib/dashboardData'

export interface AssignableCrewOption {
  id: string
  name: string
  leadName: string
  rate: number
  color?: string
  avatar?: string
}

export default function AssignCrewModal({
  job,
  jobId,
  crews,
  onCancel,
  onAssign,
  onSuccess,
}: {
  job?: Job
  jobId?: string
  /** Real crews from the API. Callers that omit this fall back to fetched API crews. */
  crews?: AssignableCrewOption[]
  onCancel: () => void
  onAssign?: (crewLeadId: string, startDate: string, endDate: string, note: string) => void
  onSuccess?: () => void
}) {
  const targetJobId = jobId || job?.id || ''
  const jobNameStr = job?.name || ''
  const jobNoStr = job?.jobNo || ''

  // Shares the ['crews', null] cache entry with the pages behind this modal, so
  // opening it is normally free.
  const { data: fetchedCrews = [], isPending } = useCrewsSummary(undefined, !crews)
  const loadingCrews = !crews && isPending

  const apiCrews: AssignableCrewOption[] = useMemo(
    () =>
      fetchedCrews.map((c) => {
        const leadObj = typeof c.crewLead === 'object' && c.crewLead !== null ? (c.crewLead as UserItem) : null
        const leadName = leadObj ? `${leadObj.firstName || ''} ${leadObj.lastName || ''}`.trim() : c.name
        return {
          id: c._id,
          name: c.name,
          leadName: leadName || c.name,
          rate: leadObj?.hourlyRate ?? 0,
          color: c.crewColor || '#3b82f6',
        }
      }),
    [fetchedCrews],
  )
  const crewOptions: AssignableCrewOption[] = crews ?? apiCrews

  const [crewId, setCrewId] = useState<string | null>(null)
  const [startDateTime, setStartDateTime] = useState<string>(
    new Date().toISOString().slice(0, 10) + 'T08:00',
  )
  const [endDateTime, setEndDateTime] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startDate = startDateTime.split('T')[0] ?? ''
  const startTime = startDateTime.split('T')[1] ?? ''
  const endDate = endDateTime ? endDateTime.split('T')[0] ?? '' : ''
  const endTime = endDateTime ? endDateTime.split('T')[1] ?? '' : ''

  const selected = crewOptions.find((c) => c.id === crewId)

  async function handleAssignSubmit() {
    if (!crewId || !startDate || !targetJobId) return
    setIsSubmitting(true)
    setError(null)

    try {
      await createCrewAssignment(targetJobId, {
        crewId,
        startDate,
        endDate: endDate || undefined,
        ...(startTime && endTime ? { dailyStartTime: startTime, dailyEndTime: endTime } : {}),
      })
      onAssign?.(crewId, startDate, endDate, '')
      onSuccess?.()
      onCancel()
    } catch (err: any) {
      const parsed = parseApiErrors(err, 'Failed to assign crew to job.')
      setError(parsed.generalMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal onClose={onCancel} width={480}>
      <h2 className="modal-title">Assign Crew</h2>
      {jobNoStr && <p className="job-head__meta" style={{ marginTop: '0.15rem' }}>Job #{jobNoStr}</p>}
      {jobNameStr && <p className="assign-crew__job-name">{jobNameStr}</p>}

      <label className="field-label">Assign Crew*</label>
      <Dropdown
        value={crewId}
        placeholder={loadingCrews ? 'Loading crews…' : '-'}
        onChange={setCrewId}
        selectedLabel={
          selected && (
            <span className="dd__crew-label">
              <Avatar name={selected.leadName} src={selected.avatar} size={24} />
              <span className="dd__crew-label__text">
                {selected.name}
              </span>
              <i className="dot" style={{ background: selected.color }} />
            </span>
          )
        }
        options={crewOptions.map((c) => ({
          id: c.id,
          label: (
            <span className="dd__crew-label">
              <Avatar name={c.leadName} src={c.avatar} size={24} />
              <span className="dd__crew-label__text">{c.name}</span>
              <i className="dot" style={{ background: c.color }} />
            </span>
          ),
        }))}
      />

      <div className="field-row" style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <label className="field-label" style={{ whiteSpace: 'nowrap' }}>Start Date & Time*</label>
          <input
            type="datetime-local"
            className="field-input"
            value={startDateTime}
            onChange={(e) => setStartDateTime(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <label className="field-label" style={{ whiteSpace: 'nowrap' }}>End Date & Time</label>
          <input
            type="datetime-local"
            className="field-input"
            value={endDateTime}
            min={startDateTime || undefined}
            onChange={(e) => setEndDateTime(e.target.value)}
          />
        </div>
      </div>
      <p className="field-hint" style={{ marginTop: '0.35rem', fontSize: '0.75rem', opacity: 0.7 }}>
        Leave End Date & Time empty for an open-ended assignment.
      </p>

      {error && (
        <div style={{ color: '#ef4444', marginTop: '0.75rem', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
        <button type="button" className="btn btn--outline" disabled={isSubmitting} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!crewId || !startDate || isSubmitting}
          onClick={handleAssignSubmit}
        >
          {isSubmitting ? 'Assigning...' : 'Assign Crew'}
        </button>
      </div>
    </Modal>
  )
}
