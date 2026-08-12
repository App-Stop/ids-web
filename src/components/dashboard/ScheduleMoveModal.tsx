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

export interface ReplacedStint {
  id: string
  crewName: string
  crewColor: string
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
 * Replacing is destructive — the stints listed under "will be removed" are
 * deleted outright, because the backend rejects any overlapping assignment.
 */
export default function ScheduleMoveModal({
  crewName,
  crewColor,
  from,
  to,
  replacing,
  sameJob,
  adopted = false,
  saving = false,
  error,
  onCancel,
  onConfirm,
}: {
  crewName: string
  crewColor: string
  from: MoveSide
  to: MoveSide
  replacing: ReplacedStint[]
  sameJob: boolean
  /** The moved crew took over the displaced stint's full run. */
  adopted?: boolean
  saving?: boolean
  error?: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  const isReplacing = replacing.length > 0
  const span = dayCount(to.start, to.end)
  const wasSpan = dayCount(from.start, from.end)

  return (
    <Modal onClose={onCancel} width={520}>
      <h2 className="modal-title">{isReplacing ? 'Replace assignment?' : 'Move assignment?'}</h2>
      <p className="sb-move__lede">
        <i className="sb-move__swatch" style={{ background: crewColor }} />
        <strong>{crewName}</strong>
        <span className="sb-move__span">
          {adopted && wasSpan && wasSpan !== span ? `${wasSpan} → ${span ?? 'open-ended'}` : (span ?? 'open-ended')}
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

      {isReplacing && (
        <div className="sb-move__warn">
          <span className="sb-move__warn-head">
            <Icon.AlertTriangle width={17} height={17} />
            {replacing.length === 1 ? 'This assignment will be removed' : `${replacing.length} assignments will be removed`}
          </span>
          <ul className="sb-move__replaced">
            {replacing.map((stint) => (
              <li key={stint.id}>
                <i className="sb-move__swatch" style={{ background: stint.crewColor }} />
                <span className="sb-move__replaced-name">{stint.crewName}</span>
                <span className="sb-move__replaced-dates">{rangeText(stint.start, stint.end)}</span>
              </li>
            ))}
          </ul>
          <p className="sb-move__warn-foot">
            {adopted
              ? `${crewName} takes over the full run shown above${
                  wasSpan && wasSpan !== span ? `, not its original ${wasSpan}` : ''
                }. To hand over only part of it, cancel and drag the edge of the bar instead.`
              : 'The whole stint is deleted, not just the overlapping days. To free up a day or two instead, cancel and drag the edge of the bar.'}
          </p>
        </div>
      )}

      {error && <div className="sb-move__error">{error}</div>}

      <div className="modal-actions">
        <button type="button" className="btn btn--outline" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button
          type="button"
          className={`btn ${isReplacing ? 'btn--danger' : 'btn--primary'}`}
          onClick={onConfirm}
          disabled={saving}
        >
          {saving ? 'Moving…' : isReplacing ? 'Replace' : 'Move'}
        </button>
      </div>
    </Modal>
  )
}
