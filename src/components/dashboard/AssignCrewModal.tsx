import { useEffect, useState } from 'react'
import Modal from './Modal'
import Dropdown from './Dropdown'
import Avatar from './Avatar'
import { createCrewAssignment } from '../../api/jobApi'
import { getCrewsSummary, type UserItem } from '../../api/crewApi'
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

  const [apiCrews, setApiCrews] = useState<AssignableCrewOption[]>([])
  const [loadingCrews, setLoadingCrews] = useState(!crews)
  const crewOptions: AssignableCrewOption[] = crews ?? apiCrews

  useEffect(() => {
    if (crews) return
    async function loadCrews() {
      try {
        const res = await getCrewsSummary()
        if (res.success && Array.isArray(res.data)) {
          const mapped: AssignableCrewOption[] = res.data.map((c) => {
            const leadObj = typeof c.crewLead === 'object' && c.crewLead !== null ? (c.crewLead as UserItem) : null
            const leadName = leadObj ? `${leadObj.firstName || ''} ${leadObj.lastName || ''}`.trim() : c.name
            return {
              id: c._id,
              name: c.name,
              leadName: leadName || c.name,
              rate: leadObj?.hourlyRate ?? 0,
              color: c.crewColor || '#3b82f6',
            }
          })
          setApiCrews(mapped)
        }
      } catch (err) {
        console.error('Failed to fetch crews summary in AssignCrewModal:', err)
      } finally {
        setLoadingCrews(false)
      }
    }
    loadCrews()
  }, [crews])

  const [crewId, setCrewId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState<string>('')
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        note: note.trim() || undefined,
      })
      onAssign?.(crewId, startDate, endDate, note)
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
    <Modal onClose={onCancel} width={440}>
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

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
        <div style={{ flex: 1 }}>
          <label className="field-label">Start Date*</label>
          <input
            type="date"
            className="field-input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label className="field-label">End Date</label>
          <input
            type="date"
            className="field-input"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>
      <p className="field-hint" style={{ marginTop: '0.35rem', fontSize: '0.75rem', opacity: 0.7 }}>
        Leave End Date empty for an open-ended assignment.
      </p>

      <label className="field-label" style={{ marginTop: '1rem' }}>Add a note <span style={{ color: '#9ca3af', fontWeight: 400 }}>(Optional)</span></label>
      <textarea
        className="field-textarea"
        placeholder="Note about the assignment..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

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
