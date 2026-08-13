import { useState } from 'react'
import Modal from './Modal'
import { Icon } from './icons'
import { formatMdy } from '../../lib/scheduleData'

export interface ExtendPlan {
  source: any
  edge: 'start' | 'end'
  oldStart: string
  oldEnd: string | null
  newStart: string
  newEnd: string | null
}

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

export default function ScheduleExtendModal({
  crewName,
  crewColor,
  jobName,
  jobNo,
  edge,
  from,
  to,
  defaultExcludeWeekends = false,
  saving = false,
  error,
  onCancel,
  onConfirm,
}: {
  crewName: string
  crewColor: string
  jobName: string
  jobNo: string | number
  edge: 'start' | 'end'
  from: { start: string; end: string | null }
  to: { start: string; end: string | null }
  defaultExcludeWeekends?: boolean
  saving?: boolean
  error?: string | null
  onCancel: () => void
  onConfirm: (excludeWeekends: boolean) => void
}) {
  const [excludeWeekends, setExcludeWeekends] = useState(defaultExcludeWeekends)
  const wasSpan = dayCount(from.start, from.end)
  const isSpan = dayCount(to.start, to.end)
  const isExtension =
    edge === 'start'
      ? to.start < from.start
      : (to.end ?? '') > (from.end ?? '')

  const title = isExtension ? 'Extend assignment duration?' : 'Shorten assignment duration?'

  return (
    <Modal onClose={onCancel} width={480}>
      <h2 className="modal-title">{title}</h2>
      <p className="sb-move__lede">
        <i className="sb-move__swatch" style={{ background: crewColor }} />
        <strong>{crewName}</strong>
        <span className="sb-move__span">
          {wasSpan ?? 'open-ended'} → {isSpan ?? 'open-ended'}
        </span>
      </p>
      <p className="job-head__meta" style={{ marginTop: '-0.25rem', marginBottom: '1rem' }}>
        Job #{jobNo} · {jobName}
      </p>

      <div className="sb-move__flow">
        <div className="sb-move__side">
          <span className="sb-move__label">Current Dates</span>
          <span className="sb-move__dates">{rangeText(from.start, from.end)}</span>
        </div>

        <span className="sb-move__arrow" aria-hidden>
          <Icon.ArrowRight width={18} height={18} />
        </span>

        <div className="sb-move__side sb-move__side--to">
          <span className="sb-move__label">New Dates</span>
          <span className="sb-move__dates">{rangeText(to.start, to.end)}</span>
        </div>
      </div>

      <label
        className="checkbox-label"
        style={{
          marginTop: '1.25rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          cursor: 'pointer',
          fontSize: '0.9rem',
          userSelect: 'none',
        }}
      >
        <input
          type="checkbox"
          checked={excludeWeekends}
          onChange={(e) => setExcludeWeekends(e.target.checked)}
        />
        <span>Exclude Weekends From Schedule</span>
      </label>

      {error && <div className="sb-move__error" style={{ marginTop: '1rem' }}>{error}</div>}

      <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
        <button type="button" className="btn btn--outline" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => onConfirm(excludeWeekends)}
          disabled={saving}
        >
          {saving ? 'Updating…' : 'Confirm'}
        </button>
      </div>
    </Modal>
  )
}
