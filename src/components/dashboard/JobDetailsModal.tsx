import { useEffect, useState } from 'react'
import Modal from './Modal'
import Avatar from './Avatar'
import ConfirmModal from './ConfirmModal'
import Dropdown from './Dropdown'
import { Icon } from './icons'
import { STATUS_COLORS, STATUS_LABELS, type JobStatus } from '../../lib/jobsManagementData'
import { formatMoney, type Job, type UnassignedCrew } from '../../lib/dashboardData'
import { getJobById, getCrewAssignments, type JobItem, type CrewAssignment } from '../../api/jobApi'
import { crewColorFor, formatTimeWindow, formatMdy } from '../../lib/scheduleData'
import '../../pages/Dashboard.css'
import './crew-modals.css'

const STATUS_OPTIONS: { id: JobStatus; label: string }[] = [
  { id: 'awarded', label: 'Awarded' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
]

export default function JobDetailsModal({
  job,
  crew,
  note,
  status,
  onDone,
  onChangeCrew,
  onRemoveCrew,
  onDeleteJob,
  onSaveNote,
  onChangeStatus,
  onEditJob,
}: {
  job: Job
  crew: UnassignedCrew | null
  note: string
  /** Current status. With `onChangeStatus`, it renders as an editable pill. */
  status?: JobStatus
  onDone: () => void
  /** Omit to hide the Change/Assign Crew button (read-only views). */
  onChangeCrew?: () => void
  onRemoveCrew?: () => void
  onDeleteJob?: () => void
  /** When provided, the note section becomes editable inside the modal. */
  onSaveNote?: (text: string) => void
  /** When provided, the status pill becomes a dropdown. */
  onChangeStatus?: (next: JobStatus) => void
  /** When provided, an "Edit Job" button opens the full job form. */
  onEditJob?: () => void
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [editingNote, setEditingNote] = useState(false)
  const [noteDraft, setNoteDraft] = useState(note)
  const [fetchedJob, setFetchedJob] = useState<JobItem | null>(null)
  const [statusDraft, setStatusDraft] = useState<JobStatus | undefined>(status)
  /** Every crew booked on this job, with the hours each one works. */
  const [assignments, setAssignments] = useState<CrewAssignment[]>([])
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(Boolean(job.id && !job.id.startsWith('#tmp')))

  useEffect(() => {
    async function loadJobDetails() {
      if (!job.id || job.id.startsWith('#tmp')) {
        setIsLoadingDetails(false)
        return
      }
      setIsLoadingDetails(true)
      try {
        const [res, assignmentsRes] = await Promise.all([
          getJobById(job.id),
          getCrewAssignments(job.id).catch(() => null),
        ])
        if (res.success && res.data) {
          setFetchedJob(res.data)
          if (res.data.note) {
            setNoteDraft(res.data.note)
          }
          const s = res.data.status
          if (s === 'awarded' || s === 'in-progress' || s === 'completed') setStatusDraft(s)
        }
        if (assignmentsRes?.data) {
          setAssignments(assignmentsRes.data.filter((a) => a.status !== 'cancelled'))
        }
      } catch (err) {
        console.error('Failed to fetch job details:', err)
      } finally {
        setIsLoadingDetails(false)
      }
    }

    loadJobDetails()
  }, [job.id])

  const displayJob: Job = fetchedJob
    ? {
        id: fetchedJob._id,
        name: fetchedJob.name,
        color: job.color,
        // The Job model has no bid number — keep whatever the caller had, if any.
        bidNo: job.bidNo,
        jobNo: String(fetchedJob.jobIdNumber || 0),
        gc: fetchedJob.generalContractor || job.gc,
        estimator: job.estimator,
        startDate: fetchedJob.startDate ? new Date(fetchedJob.startDate).toISOString().slice(0, 10) : job.startDate,
        endDate: fetchedJob.endDate ? new Date(fetchedJob.endDate).toISOString().slice(0, 10) : job.endDate,
        contractAmount: fetchedJob.contractAmount ?? job.contractAmount,
        laborBudgetUsed: fetchedJob.laborBudgetUsed ?? job.laborBudgetUsed,
        laborBudgetTotal: fetchedJob.laborBudget ?? job.laborBudgetTotal,
      }
    : job

  const displayNote = fetchedJob?.note ?? note

  // The fetch runs once per job, so a status the user picks here is held
  // locally rather than waiting for a refetch to come back around.
  const displayStatus: JobStatus | undefined = statusDraft ?? status

  const handleDelete = onDeleteJob || onRemoveCrew

  if (confirmingDelete) {
    return (
      <ConfirmModal
        title="Are you sure you want to delete this job?"
        message="This action is irreversible"
        confirmLabel="Yes, Delete"
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => handleDelete?.()}
      />
    )
  }

  return (
    <Modal onClose={onDone} width={560}>
      {isLoadingDetails && (
        <div style={{ padding: '0.5rem 0', color: '#6b7280', fontSize: '0.875rem', fontStyle: 'italic' }}>
          Loading latest job details…
        </div>
      )}
      <div style={isLoadingDetails ? { opacity: 0.5, pointerEvents: 'none' } : undefined}>
        <p className="job-head__meta">
          {displayJob.bidNo ? `Bid #${displayJob.bidNo} · ` : ''}Job #{displayJob.jobNo}
        </p>
      <h2 className="modal-title" style={{ marginTop: '0.25rem' }}>
        {displayJob.name}
      </h2>

      {displayStatus && (
        <div className="job-head__status">
          {onChangeStatus ? (
            <Dropdown
              value={displayStatus}
              selectedLabel={
                <span
                  className="jm-status"
                  style={{ color: STATUS_COLORS[displayStatus], borderColor: STATUS_COLORS[displayStatus] }}
                >
                  {STATUS_LABELS[displayStatus]}
                </span>
              }
              onChange={(v) => {
                setStatusDraft(v as JobStatus)
                onChangeStatus(v as JobStatus)
              }}
              options={STATUS_OPTIONS}
            />
          ) : (
            <span
              className="jm-status"
              style={{ color: STATUS_COLORS[displayStatus], borderColor: STATUS_COLORS[displayStatus] }}
            >
              {STATUS_LABELS[displayStatus]}
            </span>
          )}
        </div>
      )}

      <div className="detail-grid">
        <div>
          <span className="detail-label">General Contractor</span>
          <span className="detail-value">{displayJob.gc}</span>
        </div>
        <div>
          <span className="detail-label">Estimator</span>
          <span className="detail-value">{displayJob.estimator}</span>
        </div>
        <div>
          <span className="detail-label">Start Date</span>
          <span className="detail-value">{displayJob.startDate}</span>
        </div>
        <div>
          <span className="detail-label">End Date</span>
          <span className="detail-value">{displayJob.endDate}</span>
        </div>
      </div>

      <hr className="divider" />

      <div className="detail-grid">
        <div>
          <span className="detail-label">Contract Amount</span>
          <span className="detail-value">{formatMoney(displayJob.contractAmount)}</span>
        </div>
        <div>
          <span className="detail-label">Labor Budget</span>
          <span className="detail-value">
            {formatMoney(displayJob.laborBudgetUsed)} / {formatMoney(displayJob.laborBudgetTotal)}
          </span>
        </div>
      </div>

      <hr className="divider" />

      <span className="field-label">Assigned Crews</span>
      {assignments.length > 0 ? (
        <div className="job-crew-chips">
          {assignments.map((a) => (
            <span key={a._id} className="job-crew-chip">
              <i style={{ background: crewColorFor(a.crewId, a.crew?.crewColor) }} />
              <span className="job-crew-chip__name">{a.crew?.name ?? 'Crew'}</span>
              <span className="job-crew-chip__meta">
                {formatTimeWindow(a.dailyStartTime, a.dailyEndTime)}
                {a.startDate ? ` · from ${formatMdy(a.startDate.slice(0, 10))}` : ''}
              </span>
            </span>
          ))}
        </div>
      ) : crew ? (
        <div className="crew-row">
          <Avatar name={crew.leadName} src={crew.avatar} />
          <span className="crew-row__name">
            {crew.leadName} (${crew.rate}/h)
          </span>
          <span className="crew-row__date">{displayJob.startDate}</span>
        </div>
      ) : (
        <p className="crew-row__empty">No crew assigned</p>
      )}

      {(displayNote || onSaveNote) && (
        <>
          <div className="note-section__head" style={{ marginTop: '1.25rem' }}>
            <span className="detail-label">Note</span>
            {onSaveNote && !editingNote && (
              <button
                type="button"
                className="note-section__action"
                onClick={() => {
                  setNoteDraft(displayNote)
                  setEditingNote(true)
                }}
              >
                {displayNote ? 'Edit' : 'Add Note'}
              </button>
            )}
          </div>

          {editingNote ? (
            <>
              <textarea
                className="field-textarea"
                placeholder="Note about the job..."
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                autoFocus
              />
              <div className="modal-actions note-section__actions">
                <button type="button" className="btn btn--outline" onClick={() => setEditingNote(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => {
                    onSaveNote?.(noteDraft.trim())
                    setEditingNote(false)
                  }}
                >
                  Save
                </button>
              </div>
            </>
          ) : displayNote ? (
            <div className="note-box">{displayNote}</div>
          ) : (
            <p className="crew-row__empty">No note added</p>
          )}
        </>
      )}

      <div
        className={`modal-actions ${handleDelete ? 'modal-actions--split' : ''} job-details-modal__actions`}
      >
        {handleDelete && (
          <button type="button" className="btn btn--danger" onClick={() => setConfirmingDelete(true)}>
            <Icon.Trash width={16} height={16} />
            Delete Job
          </button>
        )}
        <div className="modal-actions__group">
          {onChangeCrew && (
            <button type="button" className="btn btn--outline" onClick={onChangeCrew}>
              {crew ? 'Change Crew' : 'Assign Crew'}
            </button>
          )}
          {onEditJob && (
            <button type="button" className="btn btn--outline" onClick={onEditJob}>
              <Icon.Edit width={16} height={16} />
              Edit Job
            </button>
          )}
          <button type="button" className="btn btn--primary" onClick={onDone}>
            Done
          </button>
        </div>
      </div>
      </div>
    </Modal>
  )
}
