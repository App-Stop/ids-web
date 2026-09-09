import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import PlaceholderDateTimeInput from './PlaceholderDateTimeInput'
import Dropdown from './Dropdown'
import Avatar from './Avatar'
import { createCrewAssignment } from '../../api/jobApi'
import { type UserItem } from '../../api/crewApi'
import { useAvailableCrews } from '../../hooks/useQueryHooks'
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
  onCancel,
  onAssign,
  onSuccess,
}: {
  job?: Job
  jobId?: string
  onCancel: () => void
  onAssign?: (crewLeadId: string, startDate: string, endDate: string, note: string) => void
  onSuccess?: () => void
}) {
  const targetJobId = jobId || job?.id || ''
  const jobNameStr = job?.name || ''
  const jobNoStr = job?.jobNo || ''

  // The window is picked first: the crew list is whatever /crews/available
  // returns for it, so there is no way to select a crew that is already busy.
  const [startDate, setStartDate] = useState<string>('')
  const [startTime, setStartTime] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [endTime, setEndTime] = useState<string>('')
  const [crewId, setCrewId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Daily times only narrow the window as a pair — sending one half would ask
  // the backend about a range it cannot evaluate.
  const windowParams = useMemo(() => {
    if (!startDate) return null
    return {
      startDate,
      ...(endDate ? { endDate } : {}),
      ...(startTime && endTime ? { dailyStartTime: startTime, dailyEndTime: endTime } : {}),
    }
  }, [startDate, endDate, startTime, endTime])

  const { data: availableCrews = [], isPending, isError } = useAvailableCrews(windowParams)
  const loadingCrews = Boolean(windowParams) && isPending

  const crewOptions: AssignableCrewOption[] = useMemo(
    () =>
      availableCrews.map((c) => {
        const leadObj =
          typeof c.crewLead === 'object' && c.crewLead !== null ? (c.crewLead as UserItem) : null
        const leadName = leadObj ? `${leadObj.firstName || ''} ${leadObj.lastName || ''}`.trim() : c.name
        return {
          id: c._id,
          name: c.name,
          leadName: leadName || c.name,
          rate: leadObj?.hourlyRate ?? 0,
          color: c.crewColor || '#3b82f6',
        }
      }),
    [availableCrews],
  )

  // Editing the window can drop the picked crew out of the available set.
  useEffect(() => {
    if (crewId && !crewOptions.some((c) => c.id === crewId)) setCrewId(null)
  }, [crewOptions, crewId])

  const selected = crewOptions.find((c) => c.id === crewId)
  const noneAvailable = Boolean(startDate) && !loadingCrews && !isError && crewOptions.length === 0

  function crewPlaceholder() {
    if (!startDate) return 'Select dates first'
    if (loadingCrews) return 'Loading available crews…'
    if (isError) return 'Could not load crews'
    if (!crewOptions.length) return 'No crews available'
    return '-'
  }

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

      <div className="field-row">
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <label className="field-label" style={{ whiteSpace: 'nowrap' }}>Start Date*</label>
          <PlaceholderDateTimeInput
            type="date"
            placeholder="DD-MM-YYYY"
            value={startDate}
            onChange={setStartDate}
          />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <label className="field-label" style={{ whiteSpace: 'nowrap' }}>Start Time</label>
          <PlaceholderDateTimeInput
            type="time"
            placeholder="hh:mm"
            value={startTime}
            onChange={setStartTime}
          />
        </div>
      </div>

      <div className="field-row" style={{ marginTop: '0.75rem' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <label className="field-label" style={{ whiteSpace: 'nowrap' }}>End Date</label>
          <PlaceholderDateTimeInput
            type="date"
            placeholder="DD-MM-YYYY"
            value={endDate}
            min={startDate || undefined}
            onChange={setEndDate}
          />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <label className="field-label" style={{ whiteSpace: 'nowrap' }}>End Time</label>
          <PlaceholderDateTimeInput
            type="time"
            placeholder="hh:mm"
            value={endTime}
            onChange={setEndTime}
          />
        </div>
      </div>
      <p className="field-hint" style={{ marginTop: '0.35rem', fontSize: '0.75rem', opacity: 0.7 }}>
        Leave End Date &amp; Time empty for an open-ended assignment.
      </p>

      <label className="field-label" style={{ marginTop: '1rem' }}>Assign Crew*</label>
      <Dropdown
        value={crewId}
        disabled={!startDate || loadingCrews || crewOptions.length === 0}
        placeholder={crewPlaceholder()}
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
      {noneAvailable && (
        <p className="field-hint" style={{ marginTop: '0.35rem', fontSize: '0.75rem', opacity: 0.7 }}>
          No crews are free for this period. Try a different date or time range.
        </p>
      )}

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
