import { formatMoney, type Job } from '../../lib/dashboardData'

export default function JobSummaryChip({ job }: { job: Job }) {
  return (
    <div className="job-chip">
      <div className="job-chip__body">
        <span className="job-head__meta">
         Job #{job.jobNo}
        </span>
        <strong>{job.name}</strong>
        <span className="job-chip__sub">
          {job.gc} &middot; {formatMoney(job.contractAmount)}
        </span>
      </div>
    </div>
  )
}
