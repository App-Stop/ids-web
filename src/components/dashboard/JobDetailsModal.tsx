import { useEffect, useState } from 'react'
import Modal from './Modal'
import Avatar from './Avatar'
import ConfirmModal from './ConfirmModal'
import { Icon } from './icons'
import { formatMoney, type Job, type UnassignedCrew } from '../../lib/dashboardData'
import { getJobById, type JobItem } from '../../api/jobApi'

export default function JobDetailsModal({
  job,
  crew,
  onDone,
  onChangeCrew,
  onRemoveCrew,
  onDeleteJob,
}: {
  job: Job
  crew: UnassignedCrew | null
  onDone: () => void
  onChangeCrew: () => void
  onRemoveCrew?: () => void
  onDeleteJob?: () => void
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [fetchedJob, setFetchedJob] = useState<JobItem | null>(null)
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(Boolean(job.id && !job.id.startsWith('#tmp')))

  useEffect(() => {
    async function loadJobDetails() {
      if (!job.id || job.id.startsWith('#tmp')) {
        setIsLoadingDetails(false)
        return
      }
      setIsLoadingDetails(true)
      try {
        const res = await getJobById(job.id)
        if (res.success && res.data) {
          setFetchedJob(res.data)
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
    <Modal onClose={onDone} width={460}>
      {isLoadingDetails && (
        <div style={{ padding: '0.5rem 0', color: '#6b7280', fontSize: '0.875rem', fontStyle: 'italic' }}>
          Loading latest job details…
        </div>
      )}
      <div style={isLoadingDetails ? { opacity: 0.5, pointerEvents: 'none' } : undefined}>
        <p className="job-head__meta">
          Job #{displayJob.jobNo}
        </p>
      <h2 className="modal-title" style={{ marginTop: '0.25rem' }}>
        {displayJob.name}
      </h2>

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

      <span className="field-label">Assigned Crew Lead</span>
      {crew ? (
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

      <div className="modal-actions modal-actions--split">
        {handleDelete ? (
          <button type="button" className="btn btn--danger" onClick={() => setConfirmingDelete(true)}>
            <Icon.Trash width={16} height={16} />
            Delete Job
          </button>
        ) : (
          <span />
        )}
        <div className="modal-actions__group">
          <button type="button" className="btn btn--outline" onClick={onChangeCrew}>
            {crew ? 'Change Crew' : 'Assign Crew'}
          </button>
          <button type="button" className="btn btn--primary" onClick={onDone}>
            Done
          </button>
        </div>
      </div>
      </div>
    </Modal>
  )
}
