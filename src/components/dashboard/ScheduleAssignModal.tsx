import { useMemo, useState } from 'react'
import Modal from './Modal'
import PlaceholderDateTimeInput from './PlaceholderDateTimeInput'
import Dropdown from './Dropdown'
import Avatar from './Avatar'
import ConfirmModal from './ConfirmModal'
import './crew-modals.css'
import { crewColorFor, formatTimeWindow, windowWrapsMidnight } from '../../lib/scheduleData'
import { useAvailableCrews } from '../../hooks/useQueryHooks'
import type { CrewSummaryItem } from '../../api/crewApi'
import type { CrewAssignment } from '../../api/jobApi'

export interface StintDraft {
  /**
   * Crews sharing this window — the server makes one assignment per crew.
   * When editing, the stored assignment keeps one of them and the rest are
   * added as new assignments with the same dates and hours.
   */
  crewIds: string[]
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
 * Create or edit a crew stint on a job.
 *
 * A stint is a crew, a date range, and optionally a daily time window that
 * repeats across that range. Several crews can be picked at once to share the
 * same window. Any number of crews can share a job at the same time, identical
 * hours included — nothing already on the job restricts what can be added. The
 * one rule left is on the crew: it works a single job at a time, so a stint is
 * refused when that crew is already elsewhere over the same days and hours.
 * The board checks that against what it has loaded, and the server has the
 * final say, reporting through `error`.
 */
export default function ScheduleAssignModal({
  jobName,
  jobNo,
  crews,
  assignment,
  initialDraft,
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
  /**
   * Seeds the form with a draft the caller already has — used to reopen the
   * modal on a stint that was rejected, so nothing has to be retyped.
   */
  initialDraft?: StintDraft | null
  error?: string | null
  saving?: boolean
  canDelete?: boolean
  onCancel: () => void
  onSubmit: (draft: StintDraft) => void
  onDelete?: () => void
}) {
  const isEdit = Boolean(assignment)
  const savedCrewId = assignment ? String(assignment.crewId) : null
  // A draft handed back from a rejected save wins over the stored assignment —
  // it is what the user last typed.
  const [pickedCrewIds, setPickedCrewIds] = useState<string[]>(
    initialDraft?.crewIds ?? (savedCrewId ? [savedCrewId] : []),
  )
  const [startDate, setStartDate] = useState<string>(
    initialDraft?.startDate ?? assignment?.startDate?.slice(0, 10) ?? '',
  )
  const [dailyStartTime, setDailyStartTime] = useState<string>(
    initialDraft?.dailyStartTime ?? assignment?.dailyStartTime ?? '',
  )
  const [endDate, setEndDate] = useState<string>(
    initialDraft?.endDate ?? assignment?.endDate?.slice(0, 10) ?? '',
  )
  const [dailyEndTime, setDailyEndTime] = useState<string>(
    initialDraft?.dailyEndTime ?? assignment?.dailyEndTime ?? '',
  )
  const [excludeWeekends, setExcludeWeekends] = useState(
    initialDraft?.excludeWeekends ?? assignment?.excludeWeekends ?? false,
  )
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  // The window is picked first; the crew list is whatever /crews/available
  // returns for it. Daily times only narrow it as a pair.
  const windowParams = useMemo(() => {
    if (!startDate) return null
    return {
      startDate,
      ...(endDate ? { endDate } : {}),
      ...(dailyStartTime && dailyEndTime
        ? { dailyStartTime, dailyEndTime }
        : {}),
    }
  }, [startDate, endDate, dailyStartTime, dailyEndTime])

  const { data: available = [], isPending, isError } = useAvailableCrews(windowParams)
  const loadingCrews = Boolean(windowParams) && isPending

  // When editing, the stint's own crew is busy on this very stint, so the
  // endpoint leaves it out — keep it selectable so an edit that only moves the
  // times still works.
  const rowCrews: CrewSummaryItem[] = useMemo(() => {
    if (!windowParams) return []
    const current = savedCrewId ? crews.find((c) => c._id === savedCrewId) : undefined
    if (current && !available.some((c) => c._id === current._id)) return [current, ...available]
    return available
  }, [available, windowParams, savedCrewId, crews])

  // Editing the window can drop picked crews out of the available set; only
  // the ones still free for it count. A failed lookup says nothing about
  // availability, so it keeps them all.
  const crewIds =
    windowParams && !loadingCrews && !isError
      ? pickedCrewIds.filter((id) => rowCrews.some((c) => c._id === id))
      : pickedCrewIds

  // Picked crews, resolved for their pills even before a window loads them. A
  // crew missing from both lists still gets a pill, so it can be seen and removed.
  const selectedCrews = crewIds.map((id) => {
    const crew = rowCrews.find((c) => c._id === id) ?? crews.find((c) => c._id === id)
    return {
      id,
      name: crew?.name ?? `Crew #${id.slice(-4)}`,
      color: crewColorFor(id, crew?.crewColor),
    }
  })
  const options = rowCrews.filter((c) => !crewIds.includes(c._id))

  function crewPlaceholder() {
    if (!startDate) return 'Select dates first'
    if (loadingCrews) return 'Loading available crews…'
    if (isError) return 'Could not load crews'
    if (!options.length) return crewIds.length ? 'All available crews added' : 'No crews available'
    return crewIds.length ? 'Add another crew' : 'Select crews'
  }
  // Equal times wrap all the way around the clock, which is how a crew that
  // holds the job for the whole day is expressed.
  const isAllDay = Boolean(dailyStartTime) && dailyStartTime === dailyEndTime
  const wraps = !isAllDay && windowWrapsMidnight(dailyStartTime, dailyEndTime)
  const timesValid = Boolean(startDate)

  function submitLabel() {
    if (saving) return 'Saving…'
    if (isEdit) return 'Save Changes'
    return crewIds.length > 1 ? `Assign ${crewIds.length} Crews` : 'Assign Crew'
  }

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

      <div className="field-row" style={{ marginTop: '1rem' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <label className="field-label" style={{ whiteSpace: 'nowrap' }}>Start Date*</label>
          <PlaceholderDateTimeInput
            type="date"
            placeholder="DD-MM-YYYY"
            value={startDate}
            onChange={setStartDate}
          />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <label className="field-label" style={{ whiteSpace: 'nowrap' }}>Start Time</label>
          <PlaceholderDateTimeInput
            type="time"
            placeholder="hh:mm"
            value={dailyStartTime}
            onChange={setDailyStartTime}
          />
        </div>
      </div>

      <div className="field-row" style={{ marginTop: '0.75rem' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <label className="field-label" style={{ whiteSpace: 'nowrap' }}>End Date</label>
          <PlaceholderDateTimeInput
            type="date"
            placeholder="DD-MM-YYYY"
            value={endDate}
            min={startDate || undefined}
            onChange={setEndDate}
          />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <label className="field-label" style={{ whiteSpace: 'nowrap' }}>End Time</label>
          <PlaceholderDateTimeInput
            type="time"
            placeholder="hh:mm"
            value={dailyEndTime}
            onChange={setDailyEndTime}
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

      <label className="field-label" style={{ marginTop: '1rem' }}>Assign Crews*</label>
      <Dropdown
        value={null}
        disabled={!startDate || loadingCrews || options.length === 0}
        placeholder={crewPlaceholder()}
        onChange={(id) => {
          if (id) setPickedCrewIds((ids) => (ids.includes(id) ? ids : [...ids, id]))
        }}
        options={options.map((c) => ({
          id: c._id,
          searchText: `${c.name ?? ''} ${crewLeadName(c)}`,
          label: (
            <span className="dd__crew-label">
              <Avatar name={crewLeadName(c) || c.name || ''} size={24} />
              <span className="dd__crew-label__text">{c.name}</span>
              <i className="dot" style={{ background: crewColorFor(c._id, c.crewColor) }} />
            </span>
          ),
        }))}
      />
      {selectedCrews.length > 0 && (
        <div className="crew-chip-input" style={{ marginTop: '8px' }}>
          {selectedCrews.map((c) => (
            <span key={c.id} className="crew-chip-input__chip">
              <i
                aria-hidden
                style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }}
              />
              {c.name}
              <button
                type="button"
                className="crew-chip-input__remove"
                aria-label={`Remove ${c.name}`}
                onClick={() => setPickedCrewIds((ids) => ids.filter((id) => id !== c.id))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {startDate && !loadingCrews && !isError && rowCrews.length === 0 && (
        <p className="field-hint" style={{ marginTop: '0.35rem', fontSize: '0.75rem', opacity: 0.7 }}>
          No crews are free for this period. Try a different date or time range.
        </p>
      )}
      {isEdit && crewIds.length > 1 && (
        <p className="field-hint" style={{ marginTop: '0.35rem', fontSize: '0.75rem', opacity: 0.7 }}>
          The added crews are saved as their own assignments with these dates and hours.
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
            disabled={!crewIds.length || !startDate || !timesValid || saving}
            onClick={() => {
              if (!crewIds.length) return
              onSubmit({
                crewIds,
                startDate,
                endDate,
                dailyStartTime,
                dailyEndTime,
                excludeWeekends,
                note: '',
              })
            }}
          >
            {submitLabel()}
          </button>
        </div>
      </div>
    </Modal>
  )
}
