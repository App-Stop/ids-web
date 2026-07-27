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
      <div className="cm-stack" onClick={(e) => e.stopPropagation()}>
        <span className="cm-stack__label">Multiple Jobs</span>

        <div className="cm-card cm-card--narrow">
          <h2 className="cm-card__title cm-card__title--pad">Jobs Assigned</h2>

          <div className="cm-job-list">
            {jobs.map((job) => (
              <button
                type="button"
                key={`${job.bidNo}-${job.jobNo}`}
                className="cm-job-row"
                onClick={() => onOpenJob?.(job)}
              >
                <span className="cm-job-row__text">
                  <span className="cm-job-row__meta">
                    Bid #{job.bidNo} · Job #{job.jobNo} · {job.date}
                  </span>
                  <span className="cm-job-row__name">{job.jobName}</span>
                </span>
                <Icon.ChevronRight width={16} height={16} />
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
    </div>
  )
}
