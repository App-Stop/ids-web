import { useState } from 'react'
import Modal from './Modal'
import Avatar from './Avatar'
import ConfirmModal from './ConfirmModal'
import { Icon } from './icons'
import { formatMoney, type Job, type UnassignedCrew } from '../../lib/dashboardData'

export default function JobDetailsModal({
  job,
  crew,
  note,
  onDone,
  onChangeCrew,
  onRemoveCrew,
}: {
  job: Job
  crew: UnassignedCrew
  note: string
  onDone: () => void
  onChangeCrew: () => void
  onRemoveCrew: () => void
}) {
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  if (confirmingRemove) {
    return (
      <ConfirmModal
        title="Are you sure you want to remove this crew?"
        message="This action is irreversible"
        confirmLabel="Yes Remove"
        onCancel={() => setConfirmingRemove(false)}
        onConfirm={onRemoveCrew}
      />
    )
  }

  return (
    <Modal onClose={onDone} width={460}>
      <div className="job-head">
        <i className="dot" style={{ background: job.color }} />
        <span className="job-head__meta">
          Bid #{job.bidNo} &middot; Job #{job.jobNo}
        </span>
      </div>
      <h2 className="modal-title">{job.name}</h2>

      <div className="detail-grid">
        <div>
          <span className="detail-label">General Contractor</span>
          <span className="detail-value">{job.gc}</span>
        </div>
        <div>
          <span className="detail-label">Estimator</span>
          <span className="detail-value">{job.estimator}</span>
        </div>
        <div>
          <span className="detail-label">Start Date</span>
          <span className="detail-value">{job.startDate}</span>
        </div>
        <div>
          <span className="detail-label">End Date</span>
          <span className="detail-value">{job.endDate}</span>
        </div>
      </div>

      <hr className="divider" />

      <div className="detail-grid">
        <div>
          <span className="detail-label">Contract Amount</span>
          <span className="detail-value">{formatMoney(job.contractAmount)}</span>
        </div>
        <div>
          <span className="detail-label">Labor Budget</span>
          <span className="detail-value">
            {formatMoney(job.laborBudgetUsed)} / {formatMoney(job.laborBudgetTotal)}
          </span>
        </div>
      </div>

      <hr className="divider" />

      <span className="field-label">Assigned Crew Lead</span>
      <div className="crew-row">
        <Avatar name={crew.leadName} />
        <span className="crew-row__name">
          {crew.leadName} (${crew.rate}/h)
        </span>
        <span className="crew-row__date">{job.startDate}</span>
      </div>

      {note && (
        <>
          <span className="field-label">Note</span>
          <div className="note-box">{note}</div>
        </>
      )}

      <div className="modal-actions modal-actions--split">
        <button type="button" className="btn btn--danger" onClick={() => setConfirmingRemove(true)}>
          <Icon.Trash width={16} height={16} />
          Remove Crew
        </button>
        <div className="modal-actions">
          <button type="button" className="btn btn--outline" onClick={onChangeCrew}>
            Change Crew
          </button>
          <button type="button" className="btn btn--primary" onClick={onDone}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  )
}
