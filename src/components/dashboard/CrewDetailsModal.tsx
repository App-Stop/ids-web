import Modal from './Modal'
import Avatar from './Avatar'
import JobSummaryChip from './JobSummaryChip'
import { formatMoney, type CrewLead, type Job } from '../../lib/dashboardData'

export default function CrewDetailsModal({
  job,
  crewLead,
  hoursWorked = '16h 26m',
  workers = 4,
  onDone,
  onEditJob,
}: {
  job: Job
  crewLead: CrewLead
  hoursWorked?: string
  workers?: number
  onDone: () => void
  onEditJob: () => void
}) {
  return (
    <Modal onClose={onDone} width={460}>
      <h2 className="modal-title">Crew Details</h2>

      <JobSummaryChip job={job} />

      <span className="field-label">Assigned Crew Lead</span>
      <div className="crew-row">
        <Avatar name={crewLead.name} src={crewLead.avatar} />
        <span className="crew-row__name">
          {crewLead.name} (${crewLead.rate}/h)
        </span>
        <span className="crew-row__date">{job.startDate}</span>
      </div>

      <div className="detail-grid">
        <div>
          <span className="detail-label">Start Date</span>
          <span className="detail-value">{job.startDate}</span>
        </div>
        <div>
          <span className="detail-label">End Date</span>
          <span className="detail-value">{job.endDate}</span>
        </div>
        <div>
          <span className="detail-label">Hourly Rate</span>
          <span className="detail-value">${crewLead.rate}/h</span>
        </div>
        <div>
          <span className="detail-label">Hours Worked</span>
          <span className="detail-value">{hoursWorked}</span>
        </div>
        <div>
          <span className="detail-label">Workers</span>
          <span className="detail-value">{workers}</span>
        </div>
        <div>
          <span className="detail-label">Labor Budget</span>
          <span className="detail-value">
            {formatMoney(job.laborBudgetUsed)} / {formatMoney(job.laborBudgetTotal)}
          </span>
        </div>
      </div>

      <div className="modal-actions">
        <button type="button" className="btn btn--outline" onClick={onEditJob}>
          Edit Job
        </button>
        <button type="button" className="btn btn--primary" onClick={onDone}>
          Done
        </button>
      </div>
    </Modal>
  )
}
