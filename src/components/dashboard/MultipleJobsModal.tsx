import { Icon } from './icons'
import type { CrewJobAssignment } from '../../lib/crewData'
import './crew-modals.css'

interface MultipleJobsModalProps {
  jobs: CrewJobAssignment[]
  onDone: () => void
  onOpenJob?: (job: CrewJobAssignment) => void
}

export default function MultipleJobsModal({ jobs, onDone, onOpenJob }: MultipleJobsModalProps) {
  return (
    <div className="cm-overlay" onClick={onDone}>
      <div className="cm-card cm-card--jobs" onClick={(e) => e.stopPropagation()}>
        <h2 className="cm-card__title cm-card__title--pad">Jobs Assigned</h2>

        <div className="cm-job-list">
          {jobs.map((job) => (
            <button
              type="button"
              key={job.jobId || `${job.jobNo}-${job.date}`}
              className="cm-job-row"
              onClick={() => onOpenJob?.(job)}
            >
              <span className="cm-job-row__text">
                <span className="cm-job-row__meta">
                  {job.bidNo ? `Bid #${job.bidNo} · ` : ''}Job #{job.jobNo} · {job.date}
                </span>
                <span className="cm-job-row__name">{job.jobName}</span>
              </span>
              <Icon.ChevronRight width={16} height={16} className="cm-job-row__chevron" />
            </button>
          ))}
        </div>

        <div className="cm-card__footer">
          <button type="button" className="btn btn--primary" onClick={onDone}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
