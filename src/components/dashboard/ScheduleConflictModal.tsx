import Modal from './Modal'
import { Icon } from './icons'
import { formatMdy, formatTimeWindow } from '../../lib/scheduleData'

export interface ConflictingStint {
  id: string
  /** The crew this existing stint belongs to — one of `crews`. */
  crewName: string
  crewColor: string
  jobName: string
  jobNo: string | number
  start: string
  /** null = open-ended. */
  end: string | null
  dailyStartTime: string | null
  dailyEndTime: string | null
}

export interface ConflictingCrew {
  id: string
  name: string
  color: string
}

/** "08-25-2026 – 08-29-2026", or an open-ended tail. */
function rangeText(start: string, end: string | null) {
  if (!end) return `${formatMdy(start)} → open-ended`
  if (start === end) return formatMdy(start)
  return `${formatMdy(start)} – ${formatMdy(end)}`
}

/**
 * Reports that a stint would put a crew on two jobs at the same time.
 *
 * A job takes as many crews as it needs, so nothing on the target job can block
 * an assignment. The crew is the scarce side: it works one job at a time, and
 * there is no way to honour a double booking by reshuffling — hence a dead end
 * rather than a confirmation. The clashing jobs are named so the range or the
 * daily hours can be narrowed, the crew dropped, or the other stint moved first.
 *
 * Several crews can be submitted together; only the ones that clash are listed.
 */
export default function ScheduleConflictModal({
  crews,
  jobName,
  jobNo,
  start,
  end,
  dailyStartTime,
  dailyEndTime,
  conflicts,
  onBack,
  onClose,
}: {
  /** The submitted crews that clash — never empty. */
  crews: ConflictingCrew[]
  jobName: string
  jobNo: string | number
  start: string
  end: string | null
  dailyStartTime: string | null
  dailyEndTime: string | null
  conflicts: ConflictingStint[]
  /** Reopens the assign modal with the rejected draft still filled in. */
  onBack: () => void
  onClose: () => void
}) {
  const hours = formatTimeWindow(dailyStartTime, dailyEndTime)
  const single = crews.length === 1

  return (
    <Modal onClose={onClose} width={520}>
      <h2 className="modal-title">
        {single
          ? conflicts.length === 1
            ? 'This crew is already on another job then'
            : 'This crew is already booked elsewhere then'
          : 'These crews are already booked elsewhere then'}
      </h2>
      <p className="job-head__meta" style={{ marginTop: '0.15rem' }}>Job #{jobNo}</p>
      <p className="assign-crew__job-name">{jobName}</p>

      {crews.map((crew) => (
        <p key={crew.id} className="sb-move__lede">
          <i className="sb-move__swatch" style={{ background: crew.color }} />
          <strong>{crew.name}</strong>
          <span className="sb-move__span">{hours}</span>
        </p>
      ))}
      <p className="sb-move__dates">{rangeText(start, end)}</p>

      <div className="sb-move__warn">
        <span className="sb-move__warn-head">
          <Icon.AlertTriangle width={17} height={17} />
          {conflicts.length === 1
            ? 'Clashes with 1 existing assignment'
            : `Clashes with ${conflicts.length} existing assignments`}
        </span>
        <ul className="sb-move__replaced">
          {conflicts.map((stint) => (
            <li key={stint.id}>
              <i className="sb-move__swatch" style={{ background: stint.crewColor }} />
              <span className="sb-move__replaced-name" title={`${stint.crewName} · ${stint.jobName}`}>
                {single ? '' : `${stint.crewName} · `}#{stint.jobNo} · {stint.jobName}
              </span>
              <span className="sb-move__replaced-dates">{rangeText(stint.start, stint.end)}</span>
              <span className="sb-move__effect">
                {formatTimeWindow(stint.dailyStartTime, stint.dailyEndTime)}
              </span>
            </li>
          ))}
        </ul>
        <p className="sb-move__warn-foot">
          {single
            ? 'This crew is already working on a job at this given time.'
            : 'Each of these crews is already working on a job at this given time. Remove them, or change the dates or hours.'}
        </p>
      </div>

      <div className="modal-actions">
        <button type="button" className="btn btn--outline" onClick={onClose}>
          Close
        </button>
        <button type="button" className="btn btn--primary" onClick={onBack}>
          Edit assignment
        </button>
      </div>
    </Modal>
  )
}
