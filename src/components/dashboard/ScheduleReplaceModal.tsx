import Modal from './Modal'
import { Icon } from './icons'
import { formatMdy, formatTimeWindow } from '../../lib/scheduleData'

export interface ReplacedSlot {
  id: string
  crewName: string
  crewColor: string
  start: string
  /** null = open-ended. */
  end: string | null
  dailyStartTime: string | null
  dailyEndTime: string | null
  /** What the incoming stint does to this one. */
  effect: 'removed' | 'trimmed' | 'split'
}

/** "08-25-2026 – 08-29-2026", or an open-ended tail. */
function rangeText(start: string, end: string | null) {
  if (!end) return `${formatMdy(start)} → open-ended`
  if (start === end) return formatMdy(start)
  return `${formatMdy(start)} – ${formatMdy(end)}`
}

const EFFECT_TEXT: Record<ReplacedSlot['effect'], string> = {
  removed: 'loses the assignment entirely',
  trimmed: 'keeps the days outside the new range',
  split: 'keeps the days either side of the new range',
}

/**
 * Confirms handing a time slot that another crew already holds to a new one.
 *
 * Nothing here is a plain delete: the server carves the requested days and
 * hours out of whatever overlaps, so a stint is trimmed or split when part of
 * it survives, and only removed when the incoming stint covers all of it. The
 * list spells out which of those each affected crew gets, since "replace" is
 * otherwise easy to read as "delete".
 */
export default function ScheduleReplaceModal({
  crewName,
  crewColor,
  jobName,
  jobNo,
  start,
  end,
  dailyStartTime,
  dailyEndTime,
  replacing,
  isEdit = false,
  saving = false,
  error,
  onCancel,
  onConfirm,
}: {
  crewName: string
  crewColor: string
  jobName: string
  jobNo: string | number
  start: string
  end: string | null
  dailyStartTime: string | null
  dailyEndTime: string | null
  replacing: ReplacedSlot[]
  /** Editing an existing stint rather than creating one. */
  isEdit?: boolean
  saving?: boolean
  error?: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  const hours = formatTimeWindow(dailyStartTime, dailyEndTime)

  return (
    <Modal onClose={onCancel} width={520}>
      <h2 className="modal-title">
        {replacing.length === 1 ? 'Replace this crew for that slot?' : 'Replace these crews for that slot?'}
      </h2>
      <p className="job-head__meta" style={{ marginTop: '0.15rem' }}>Job #{jobNo}</p>
      <p className="assign-crew__job-name">{jobName}</p>

      <p className="sb-move__lede">
        <i className="sb-move__swatch" style={{ background: crewColor }} />
        <strong>{crewName}</strong>
        <span className="sb-move__span">{hours}</span>
      </p>
      <p className="sb-move__dates">{rangeText(start, end)}</p>

      <div className="sb-move__warn">
        <span className="sb-move__warn-head">
          <Icon.AlertTriangle width={17} height={17} />
          {replacing.length === 1
            ? 'This crew already has those hours'
            : `${replacing.length} crews already have those hours`}
        </span>
        <ul className="sb-move__replaced">
          {replacing.map((slot) => (
            <li key={slot.id}>
              <i className="sb-move__swatch" style={{ background: slot.crewColor }} />
              <span className="sb-move__replaced-name">{slot.crewName}</span>
              <span className="sb-move__replaced-dates">
                {rangeText(slot.start, slot.end)} · {formatTimeWindow(slot.dailyStartTime, slot.dailyEndTime)}
              </span>
              <span className="sb-move__effect">{EFFECT_TEXT[slot.effect]}</span>
            </li>
          ))}
        </ul>
        <p className="sb-move__warn-foot">
          Only the overlapping days and hours change hands. Crews working this job
          at other times of day are not affected.
        </p>
      </div>

      {error && <div className="sb-move__error">{error}</div>}

      <div className="modal-actions">
        <button type="button" className="btn btn--outline" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="button" className="btn btn--danger" onClick={onConfirm} disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Replace and save' : 'Replace and assign'}
        </button>
      </div>
    </Modal>
  )
}
