import Modal from './Modal'
import { Icon } from './icons'
import { formatMdy } from '../../lib/scheduleData'

export interface MoveSide {
  jobName: string
  jobNo: string | number
  start: string
  /** null = open-ended. */
  end: string | null
}

/** Another job already holding the moved crew over the destination range. */
export interface ConflictingStint {
  id: string
  jobName: string
  jobNo: string | number
  start: string
  end: string | null
}

/** "08-25-2026 – 08-29-2026", or an open-ended tail. */
function rangeText(start: string, end: string | null) {
  if (!end) return `${formatMdy(start)} → open-ended`
  if (start === end) return formatMdy(start)
  return `${formatMdy(start)} – ${formatMdy(end)}`
}

function dayCount(start: string, end: string | null) {
  if (!end) return null
  const days = Math.round(
    (new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) / 86_400_000,
  ) + 1
  return `${days} day${days === 1 ? '' : 's'}`
}

/**
 * Confirms a drag-and-drop move of a crew stint before anything is written.
 *
 * The move never displaces anyone: the destination job keeps every crew it
 * already has and this one joins them, whatever hours they share. The only
 * thing that stops a move is `conflicts` — other jobs wanting this same crew
 * over the destination days and hours, which no reshuffle can satisfy. When
 * there are any, the move is blocked rather than confirmed.
 */
export default function ScheduleMoveModal({
  crewName,
  crewColor,
  from,
  to,
  conflicts,
  sameJob,
  saving = false,
  error,
  onCancel,
  onConfirm,
}: {
  crewName: string
  crewColor: string
  from: MoveSide
  to: MoveSide
  conflicts: ConflictingStint[]
  sameJob: boolean
  saving?: boolean
  error?: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  const blocked = conflicts.length > 0
  const span = dayCount(to.start, to.end)

  return (
    <Modal onClose={onCancel} width={520}>
      <h2 className="modal-title">
        {blocked ? 'This crew is booked elsewhere then' : 'Move assignment?'}
      </h2>
      <p className="sb-move__lede">
        <i className="sb-move__swatch" style={{ background: crewColor }} />
        <strong>{crewName}</strong>
        <span className="sb-move__span">
          {span ?? 'open-ended'}
        </span>
      </p>

      <div className="sb-move__flow">
        <div className="sb-move__side">
          <span className="sb-move__label">From</span>
          {!sameJob && (
            <span className="sb-move__job" title={from.jobName}>
              #{from.jobNo} · {from.jobName}
            </span>
          )}
          <span className="sb-move__dates">{rangeText(from.start, from.end)}</span>
        </div>

        <span className="sb-move__arrow" aria-hidden>
          <Icon.ArrowRight width={18} height={18} />
        </span>

        <div className="sb-move__side sb-move__side--to">
          <span className="sb-move__label">To</span>
          {!sameJob && (
            <span className="sb-move__job" title={to.jobName}>
              #{to.jobNo} · {to.jobName}
            </span>
          )}
          <span className="sb-move__dates">{rangeText(to.start, to.end)}</span>
        </div>
      </div>

      {sameJob && <p className="sb-move__note">Same job — only the dates change.</p>}

      {blocked && (
        <div className="sb-move__warn">
          <span className="sb-move__warn-head">
            <Icon.AlertTriangle width={17} height={17} />
            {conflicts.length === 1
              ? `${crewName} is already on another job then`
              : `${crewName} is already on ${conflicts.length} other jobs then`}
          </span>
          <ul className="sb-move__replaced">
            {conflicts.map((stint) => (
              <li key={stint.id}>
                <i className="sb-move__swatch" style={{ background: crewColor }} />
                <span className="sb-move__replaced-name" title={stint.jobName}>
                  #{stint.jobNo} · {stint.jobName}
                </span>
                <span className="sb-move__replaced-dates">{rangeText(stint.start, stint.end)}</span>
              </li>
            ))}
          </ul>
          <p className="sb-move__warn-foot">
            The destination job can take another crew — this one just isn’t free.
            Move or shorten the assignments above first, or drop this stint on
            days they don’t cover.
          </p>
        </div>
      )}

      {error && <div className="sb-move__error">{error}</div>}

      <div className="modal-actions">
        <button type="button" className="btn btn--outline" onClick={onCancel} disabled={saving}>
          {blocked ? 'Close' : 'Cancel'}
        </button>
        {!blocked && (
          <button type="button" className="btn btn--primary" onClick={onConfirm} disabled={saving}>
            {saving ? 'Moving…' : 'Move'}
          </button>
        )}
      </div>
    </Modal>
  )
}
