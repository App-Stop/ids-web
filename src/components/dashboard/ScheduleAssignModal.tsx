import { useState } from 'react'
import Modal from './Modal'
import Dropdown from './Dropdown'
import Avatar from './Avatar'
import ConfirmModal from './ConfirmModal'
import { crewColorFor, formatTimeWindow, windowWrapsMidnight } from '../../lib/scheduleData'
import type { CrewSummaryItem } from '../../api/crewApi'
import type { CrewAssignment } from '../../api/jobApi'

export interface StintDraft {
  crewId: string
  startDate: string
  /** Empty string = open-ended. */
  endDate: string
  /** "HH:mm" pair, or both empty for a round-the-clock stint. */
  dailyStartTime: string
  dailyEndTime: string
  excludeWeekends?: boolean
  note: string
}

function crewLeadName(crew: CrewSummaryItem) {
  const lead = crew.crewLead
  if (lead && typeof lead === 'object') {
    return [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.email || ''
  }
  return ''
}

/**
 * Create or edit one crew stint on a job.
 *
 * A stint is a crew, a date range, and optionally a daily time window that
 * repeats across that range. Several crews can share the same days on a job so
 * long as their windows don't overlap, and one crew can hold stints on several
 * jobs the same day under the same rule. The server owns that check and reports
 * conflicts through `error` rather than them being pre-validated here.
 */
export default function ScheduleAssignModal({
  jobName,
  jobNo,
  crews,
  assignment,
  defaultStartDate,
  error,
  saving = false,
  canDelete = false,
  onCancel,
  onSubmit,
  onDelete,
}: {
  jobName: string
  jobNo: string | number
  crews: CrewSummaryItem[]
  /** Present when editing an existing stint. */
  assignment?: CrewAssignment | null
  defaultStartDate: string
  error?: string | null
  saving?: boolean
  canDelete?: boolean
  onCancel: () => void
  onSubmit: (draft: StintDraft) => void
  onDelete?: () => void
}) {
  const isEdit = Boolean(assignment)
  const [crewId, setCrewId] = useState<string | null>(assignment?.crewId ?? null)
  const [startDateTime, setStartDateTime] = useState(
    (assignment?.startDate?.slice(0, 10) ?? defaultStartDate) + 'T' + (assignment?.dailyStartTime ?? '08:00'),
  )
  const [endDateTime, setEndDateTime] = useState(
    assignment?.endDate
      ? assignment.endDate.slice(0, 10) + 'T' + (assignment.dailyEndTime ?? '17:00')
      : '',
  )
  const [excludeWeekends, setExcludeWeekends] = useState(assignment?.excludeWeekends ?? false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const startDate = startDateTime.split('T')[0] ?? ''
  const endDate = endDateTime ? endDateTime.split('T')[0] ?? '' : ''
  const dailyStartTime = startDateTime.split('T')[1] ?? ''
  const dailyEndTime = endDateTime ? endDateTime.split('T')[1] ?? '' : ''

  const selected = crews.find((c) => c._id === crewId)
  // Equal times wrap all the way around the clock, which is how a crew that
  // holds the job for the whole day is expressed.
  const isAllDay = Boolean(dailyStartTime) && dailyStartTime === dailyEndTime
  const wraps = !isAllDay && windowWrapsMidnight(dailyStartTime, dailyEndTime)
  const timesValid = Boolean(startDateTime) && (endDateTime ? Boolean(dailyEndTime) : true)

  if (confirmingDelete) {
    return (
      <ConfirmModal
        title="Are you sure you want to remove this assignment?"
        message="This action is irreversible."
        confirmLabel="Yes Remove"
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => {
          setConfirmingDelete(false)
          onDelete?.()
        }}
      />
    )
  }

  return (
    <Modal onClose={onCancel} width={480}>
      <h2 className="modal-title">{isEdit ? 'Edit Crew Assignment' : 'Assign Crew'}</h2>
      <p className="job-head__meta" style={{ marginTop: '0.15rem' }}>Job #{jobNo}</p>
      <p className="assign-crew__job-name">{jobName}</p>

      <label className="field-label">Assign Crew</label>
      <Dropdown
        value={crewId}
        placeholder="-"
        onChange={setCrewId}
        selectedLabel={
          selected && (
            <span className="dd__crew-label">
              <Avatar name={crewLeadName(selected) || selected.name || ''} size={24} />
              <span className="dd__crew-label__text">{selected.name}</span>
              <i className="dot" style={{ background: crewColorFor(selected._id, selected.crewColor) }} />
            </span>
          )
        }
        options={crews.map((c) => ({
          id: c._id,
          label: (
            <span className="dd__crew-label">
              <Avatar name={crewLeadName(c) || c.name || ''} size={24} />
              <span className="dd__crew-label__text">{c.name}</span>
              <i className="dot" style={{ background: crewColorFor(c._id, c.crewColor) }} />
            </span>
          ),
        }))}
      />

      <div className="field-row" style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <label className="field-label" style={{ whiteSpace: 'nowrap' }}>Start Date &amp; Time</label>
          <input
            type="datetime-local"
            className="field-input"
            value={startDateTime}
            onChange={(e) => setStartDateTime(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <label className="field-label" style={{ whiteSpace: 'nowrap' }}>End Date &amp; Time</label>
          <input
            type="datetime-local"
            className="field-input"
            value={endDateTime}
            min={startDateTime || undefined}
            onChange={(e) => setEndDateTime(e.target.value)}
          />
        </div>
      </div>
      <p className="field-hint" style={{ marginTop: '0.35rem', fontSize: '0.75rem', opacity: 0.7 }}>
        Leave End Date &amp; Time empty for an open-ended assignment. Set the same
        time on both ends to keep the crew on the job round the clock.
      </p>

      {dailyStartTime && dailyEndTime && (
        <p className="field-hint" style={{ marginTop: '0.35rem', fontSize: '0.75rem', opacity: 0.7 }}>
          {isAllDay
            ? 'Round the clock — the crew holds this job for the whole of every day in the range.'
            : wraps
              ? `Overnight shift — ${formatTimeWindow(dailyStartTime, dailyEndTime)}, carrying into the next morning.`
              : `${formatTimeWindow(dailyStartTime, dailyEndTime)}, repeated on every day in the range.`}
        </p>
      )}

      <label className="sb-check">
        <input
          type="checkbox"
          checked={excludeWeekends}
          onChange={(e) => setExcludeWeekends(e.target.checked)}
        />
        <span>Exclude Weekends From Schedule</span>
      </label>

      {error && (
        <div style={{ color: '#ef4444', marginTop: '1rem', fontSize: '0.875rem' }}>{error}</div>
      )}

      <div className={canDelete ? 'modal-actions modal-actions--split' : 'modal-actions'}>
        {canDelete && (
          <button type="button" className="btn btn--danger" disabled={saving} onClick={() => setConfirmingDelete(true)}>
            Remove
          </button>
        )}
        <div className="modal-actions__group">
          <button type="button" className="btn btn--outline" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!crewId || !startDate || !timesValid || saving}
            onClick={() => {
              if (!crewId) return
              onSubmit({
                crewId,
                startDate,
                endDate,
                dailyStartTime,
                dailyEndTime,
                excludeWeekends,
                note: '',
              })
            }}
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Assign Crew'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
