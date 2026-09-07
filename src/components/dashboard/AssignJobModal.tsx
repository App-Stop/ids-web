import { useMemo, useState } from 'react'
import Modal from './Modal'
import Dropdown from './Dropdown'
import Avatar from './Avatar'
import { createCrewAssignment, type JobItem } from '../../api/jobApi'
import { useJobsList } from '../../hooks/useQueryHooks'
import { parseApiErrors } from '../../lib/errors'
import type { Job, UnassignedCrew } from '../../lib/dashboardData'

export default function AssignJobModal({
  crew,
  date: _date,
  jobs,
  onCancel,
  onAssign,
  onSuccess,
}: {
  crew: UnassignedCrew
  date?: string
  jobs?: Job[]
  onCancel: () => void
  onAssign?: (jobId: string, note: string) => void
  onSuccess?: () => void
}) {
  const needsFetch = !jobs || jobs.length === 0
  const { data: fetchedJobs = [], isPending } = useJobsList({ limit: 100 }, needsFetch)
  const loadingJobs = needsFetch && isPending

  const apiJobs = useMemo(
    () => fetchedJobs.map((j: JobItem) => ({ id: j._id, name: j.name })),
    [fetchedJobs],
  )
  const jobOptions = needsFetch ? apiJobs : jobs!

  const [jobId, setJobId] = useState<string | null>(null)
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

  const selected = jobOptions.find((j) => j.id === jobId)

  async function handleAssign() {
    if (!jobId || !startDate) return
    setIsSubmitting(true)
    setError(null)
    try {
      await createCrewAssignment(jobId, {
        crewId: crew.id,
        startDate,
        endDate: endDate || undefined,
        ...(startTime && endTime ? { dailyStartTime: startTime, dailyEndTime: endTime } : {}),
      })
      onAssign?.(jobId, '')
      onSuccess?.()
      onCancel()
    } catch (err: any) {
      const parsed = parseApiErrors(err, 'Failed to assign job to crew.')
      setError(parsed.generalMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal onClose={onCancel} width={480}>
      <h2 className="modal-title">Assign Job</h2>

      <div className="crew-row" style={{ marginBottom: '1rem' }}>
        <Avatar name={crew.leadName} src={crew.avatar} />
        <span className="crew-row__name">
          {crew.name || crew.leadName}
        </span>
      </div>

      <label className="field-label">Select a job*</label>
      <Dropdown
        value={jobId}
        placeholder={loadingJobs ? 'Loading jobs…' : '-'}
        onChange={setJobId}
        selectedLabel={selected?.name}
        options={jobOptions.map((j) => ({
          id: j.id,
          label: j.name,
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
          disabled={!jobId || !startDate || isSubmitting}
          onClick={handleAssign}
        >
          {isSubmitting ? 'Assigning...' : 'Assign Job'}
        </button>
      </div>
    </Modal>
  )
}
