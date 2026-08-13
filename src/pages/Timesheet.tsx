import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { MagnifyingGlass, PenIcon } from '@phosphor-icons/react'
import Sidebar from '../components/dashboard/Sidebar'
import Modal from '../components/dashboard/Modal'
import Dropdown from '../components/dashboard/Dropdown'
import Avatar from '../components/dashboard/Avatar'
import { Icon } from '../components/dashboard/icons'
import { type RosterRow } from '../lib/crewData'
import {
  createTimesheetLog,
  deleteTimeEntry,
  updateTimeEntry,
  type TimeEntryItem,
} from '../api/timeEntryApi'
import { useCrewsSummary, useTimeEntries, useInvalidateServerState } from '../hooks/useQueryHooks'
import { getErrorMessage } from '../lib/errors'
import { useClickDragScroll } from '../hooks/useClickDragScroll'
import './Dashboard.css'
import '../components/dashboard/crew-modals.css'
import './Timesheet.css'

type RangeFilter = 'today' | 'weekly' | 'monthly' | 'all-time'
type SortKey = 'newest' | 'oldest' | 'hours-desc' | 'hours-asc' | 'name-asc' | 'name-desc'
type ModalMode = 'none' | 'add' | 'edit'
type ViewMode = 'summary' | 'detailed'

type AttendanceRow = {
  id: string
  /** Roster member this log belongs to — the link back to crewData. */
  memberId: string
  rosterId: string
  name: string
  avatar: string
  role: RosterRow['role']
  date: string
  clockIn: string
  clockOut: string
  hoursWorked: number
  /** Insertion order, so freshly logged entries win the "newest" tie-break. */
  createdAt: number
}

type AttendanceForm = {
  memberId: string | null
  date: string
  clockIn: string
  clockOut: string
  overrideAutoCheckIn: boolean
}

type Bucket = { key: string; label: string; sub: string; start: Date; end: Date }

type MemberSummary = {
  memberId: string
  rosterId: string
  name: string
  avatar: string
  role: RosterRow['role']
  entries: AttendanceRow[]
  buckets: number[]
  totalHours: number
  daysWorked: number
  avgHours: number
  lastWorked: number
}

const RANGE_OPTIONS: { id: RangeFilter; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'all-time', label: 'All Time' },
]

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'newest', label: 'Newest First' },
  { id: 'oldest', label: 'Oldest First' },
  { id: 'hours-desc', label: 'Hours High-Low' },
  { id: 'hours-asc', label: 'Hours Low-High' },
  { id: 'name-asc', label: 'Name (A-Z)' },
  { id: 'name-desc', label: 'Name (Z-A)' },
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/* -------------------------------------------------------------------------- */
/* Date helpers — logs are stored/displayed as MM-DD-YYYY                      */
/* -------------------------------------------------------------------------- */

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return startOfDay(next)
}

/** Monday-based week start. */
function startOfWeek(date: Date) {
  const day = startOfDay(date)
  return addDays(day, -((day.getDay() + 6) % 7))
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function formatDate(date: Date) {
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${date.getFullYear()}`
}

function parseDate(value: string) {
  const [month, day, year] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function shortDate(date: Date) {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`
}

/** MM-DD-YYYY -> YYYY-MM-DD, for the native <input type="date">. */
function toIsoDate(display: string) {
  const [month, day, year] = display.split('-')
  if (!month || !day || !year) return ''
  return `${year}-${month}-${day}`
}

function fromIsoDate(iso: string) {
  const [year, month, day] = iso.split('-')
  if (!year || !month || !day) return ''
  return `${month}-${day}-${year}`
}

function formatHours(value: number) {
  return Math.round(value * 10) / 10
}

function parseTime(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function calculateHours(clockIn: string, clockOut: string) {
  const start = parseTime(clockIn)
  const end = parseTime(clockOut)
  const totalMinutes = end >= start ? end - start : 24 * 60 - start + end
  return Math.round((totalMinutes / 60) * 2) / 2
}

/* -------------------------------------------------------------------------- */
/* API <-> UI mapping                                                          */
/*                                                                             */
/* The backend stores `date` as UTC midnight and clockIn/clockOut as full      */
/* timestamps. The UI works entirely in the admin's local timezone, so a row's */
/* display date is derived from the local date of its clock-in — that keeps    */
/* an edited entry round-tripping to exactly the values it was loaded with.    */
/* Entries that were never clocked in fall back to the stored `date`.          */
/* -------------------------------------------------------------------------- */

/** HH:MM in local time. */
function formatClockTime(iso: string | null) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** MM-DD-YYYY for the day the entry belongs to. */
function entryDisplayDate(entry: TimeEntryItem) {
  if (entry.clockIn) {
    const clockIn = new Date(entry.clockIn)
    if (!Number.isNaN(clockIn.getTime())) return formatDate(clockIn)
  }
  if (entry.date) {
    // Date-only values are stored at UTC midnight — read them back in UTC so
    // they don't slide a day in negative-offset timezones.
    const stored = new Date(entry.date)
    if (!Number.isNaN(stored.getTime())) {
      return `${pad(stored.getUTCMonth() + 1)}-${pad(stored.getUTCDate())}-${stored.getUTCFullYear()}`
    }
  }
  return formatDate(new Date())
}

/** MM-DD-YYYY + HH:MM (local) -> full ISO timestamp. */
function toTimestamp(displayDate: string, time: string) {
  const [month, day, year] = displayDate.split('-').map(Number)
  const [hours, minutes] = time.split(':').map(Number)
  return new Date(year, month - 1, day, hours, minutes, 0, 0).toISOString()
}

/**
 * Clock-out timestamp, rolling to the next day when the shift crosses midnight
 * — matching how `calculateHours` reads such a shift.
 */
function toClockOutTimestamp(displayDate: string, clockIn: string, clockOut: string) {
  const overnight = parseTime(clockOut) < parseTime(clockIn)
  const base = overnight ? formatDate(addDays(parseDate(displayDate), 1)) : displayDate
  return toTimestamp(base, clockOut)
}

/** YYYY-MM-DD, the date-only form the API expects. */
function toApiDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function toAttendanceRow(entry: TimeEntryItem, members: Map<string, RosterRow>): AttendanceRow {
  const userIdStr = typeof entry.userId === 'object' && entry.userId !== null ? entry.userId._id : typeof entry.userId === 'string' ? entry.userId : null
  const populatedUser = typeof entry.userId === 'object' && entry.userId !== null ? entry.userId : null

  const member = userIdStr ? members.get(userIdStr) : undefined
  const clockIn = formatClockTime(entry.clockIn)
  const clockOut = formatClockTime(entry.clockOut)

  const name = member?.name || (populatedUser ? `${populatedUser.firstName || ''} ${populatedUser.lastName || ''}`.trim() : '') || 'Unknown member'
  const role = member?.role || (populatedUser?.role === 'crew-lead' ? 'Crew Lead' : 'Labor')

  return {
    id: entry._id,
    memberId: userIdStr ?? entry._id,
    rosterId: member?.rosterId ?? (userIdStr ? userIdStr.slice(-4) : '—'),
    name,
    avatar: member?.avatar ?? '',
    role,
    date: entryDisplayDate(entry),
    clockIn,
    clockOut,
    // Trust the server's figure; fall back to the clock times for open shifts.
    hoursWorked:
      entry.hoursWorked ?? (clockIn && clockOut ? calculateHours(clockIn, clockOut) : 0),
    createdAt: entry.createdAt ? new Date(entry.createdAt).getTime() : 0,
  }
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function DateField({ value, onChange, className = '' }: { value: string; onChange: (value: string) => void; className?: string }) {
  const ref = useRef<HTMLInputElement>(null)

  return (
    <div className={`ts-date-field ${className}`}>
      <button
        type="button"
        className="ts-date-field__trigger"
        onClick={() => {
          const input = ref.current
          if (!input) return
          if ('showPicker' in input && typeof input.showPicker === 'function') {
            input.showPicker()
          } else {
            input.focus()
            input.click()
          }
        }}
      >
        <span>{value}</span>
        <Icon.Calendar width={16} height={16} />
      </button>
      <input
        ref={ref}
        type="date"
        value={toIsoDate(value)}
        onChange={(e) => {
          const next = fromIsoDate(e.target.value)
          if (next) onChange(next)
        }}
        className="ts-date-field__native"
      />
    </div>
  )
}

function TimeField({ value, onChange, className = '' }: { value: string; onChange: (value: string) => void; className?: string }) {
  const ref = useRef<HTMLInputElement>(null)

  return (
    <div className={`ts-time-field ${className}`}>
      <button
        type="button"
        className="ts-time-field__trigger"
        onClick={() => {
          const input = ref.current
          if (!input) return
          if ('showPicker' in input && typeof input.showPicker === 'function') {
            input.showPicker()
          } else {
            input.focus()
            input.click()
          }
        }}
      >
        <span>{value}</span>
        <ClockIcon />
      </button>
      <input ref={ref} type="time" value={value} onChange={(e) => onChange(e.target.value)} className="ts-time-field__native" />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Crew member filter — searchable multi-select                               */
/* -------------------------------------------------------------------------- */

function MemberFilter({
  members,
  selected,
  onChange,
}: {
  members: RosterRow[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const visible = members.filter((member) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return member.name.toLowerCase().includes(q) || member.rosterId.includes(q) || member.role.toLowerCase().includes(q)
  })

  const selectedMembers = members.filter((member) => selected.includes(member.id))
  const label =
    selectedMembers.length === 0
      ? 'All Members'
      : selectedMembers.length === 1
        ? selectedMembers[0].name
        : `${selectedMembers.length} Members`

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id])
  }

  return (
    <div className={`ts-member-filter ${open ? 'is-open' : ''}`} ref={ref}>
      <button type="button" className="ts-member-filter__trigger" onClick={() => setOpen((value) => !value)}>
        <Icon.Users width={15} height={15} />
        <span className="ts-member-filter__label">{label}</span>
        {selectedMembers.length > 0 && <span className="ts-member-filter__count">{selectedMembers.length}</span>}
        <Icon.ChevronDown width={14} height={14} />
      </button>

      {open && (
        <div className="ts-member-filter__panel">
          <label className="ts-member-filter__search">
            <Icon.Search width={14} height={14} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search crew member..."
            />
          </label>

          <div className="ts-member-filter__list">
            {visible.length === 0 && <p className="ts-member-filter__empty">No member matches "{query}"</p>}
            {visible.map((member) => {
              const isSelected = selected.includes(member.id)
              return (
                <button
                  key={member.id}
                  type="button"
                  className={`ts-member-filter__option ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => toggle(member.id)}
                >
                  <span className={`ts-check ${isSelected ? 'is-on' : ''}`}>{isSelected && <Icon.Check width={12} height={12} />}</span>
                  <Avatar name={member.name} size={24} />
                  <span className="ts-member-filter__name">{member.name}</span>
                </button>
              )
            })}
          </div>

          <div className="ts-member-filter__footer">
            <button type="button" onClick={() => onChange([])} disabled={selected.length === 0}>
              Clear
            </button>
            <button type="button" onClick={() => onChange(visible.map((member) => member.id))}>
              Select all
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Period navigator — pick which week / month you are looking at              */
/* -------------------------------------------------------------------------- */

type Period = { key: string; label: string; sub?: string; anchor: Date; isCurrent: boolean }

/** Selectable weeks/months spanning every logged date (plus today), newest first. */
function buildPeriods(range: 'weekly' | 'monthly', min: Date, max: Date, today: Date): Period[] {
  const list: Period[] = []

  if (range === 'weekly') {
    const first = startOfWeek(min)
    const currentWeek = startOfWeek(today)
    let cursor = startOfWeek(max)
    while (cursor >= first && list.length < 260) {
      const end = addDays(cursor, 6)
      const isCurrent = cursor.getTime() === currentWeek.getTime()
      list.push({
        key: formatDate(cursor),
        label: `${shortDate(cursor)} – ${shortDate(end)}`,
        sub: isCurrent ? 'This week' : String(end.getFullYear()),
        anchor: cursor,
        isCurrent,
      })
      cursor = addDays(cursor, -7)
    }
    return list
  }

  const first = startOfMonth(min)
  let cursor = startOfMonth(max)
  while (cursor >= first && list.length < 120) {
    const isCurrent = cursor.getMonth() === today.getMonth() && cursor.getFullYear() === today.getFullYear()
    list.push({
      key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
      label: `${MONTHS_LONG[cursor.getMonth()]} ${cursor.getFullYear()}`,
      sub: isCurrent ? 'This month' : undefined,
      anchor: cursor,
      isCurrent,
    })
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1)
  }
  return list
}

function PeriodNavigator({
  range,
  periods,
  activeIndex,
  onSelect,
}: {
  range: 'weekly' | 'monthly'
  periods: Period[]
  activeIndex: number
  onSelect: (anchor: Date) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const active = periods[activeIndex]
  // periods run newest -> oldest, so stepping forward in time walks the index down.
  const olderIndex = activeIndex + 1
  const newerIndex = activeIndex - 1
  const current = periods.find((period) => period.isCurrent)

  return (
    <div className="ts-nav" ref={ref}>
      <button
        type="button"
        className="ts-nav__step"
        disabled={olderIndex >= periods.length}
        onClick={() => onSelect(periods[olderIndex].anchor)}
        aria-label={range === 'weekly' ? 'Previous week' : 'Previous month'}
      >
        <Icon.ChevronRight width={14} height={14} style={{ transform: 'rotate(180deg)' }} />
      </button>

      <div className="ts-nav__picker">
        <button type="button" className="ts-nav__current" onClick={() => setOpen((value) => !value)}>
          <Icon.Calendar width={15} height={15} />
          <span>{active?.label ?? '—'}</span>
          {active && !active.isCurrent && <span className="ts-nav__sub">{active.sub}</span>}
          <Icon.ChevronDown width={13} height={13} />
        </button>

        {open && (
          <div className="ts-nav__panel">
            <div className="ts-nav__list">
              {periods.map((period, index) => (
                <button
                  key={period.key}
                  type="button"
                  className={`ts-nav__option ${index === activeIndex ? 'is-selected' : ''}`}
                  onClick={() => {
                    onSelect(period.anchor)
                    setOpen(false)
                  }}
                >
                  <span className="ts-nav__option-label">{period.label}</span>
                  {period.isCurrent ? (
                    <span className="ts-nav__badge">{period.sub}</span>
                  ) : (
                    <span className="ts-nav__option-meta">{period.sub}</span>
                  )}
                  {index === activeIndex && <Icon.Check width={13} height={13} />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        className="ts-nav__step"
        disabled={newerIndex < 0}
        onClick={() => onSelect(periods[newerIndex].anchor)}
        aria-label={range === 'weekly' ? 'Next week' : 'Next month'}
      >
        <Icon.ChevronRight width={14} height={14} />
      </button>

      {active && !active.isCurrent && current && (
        <button type="button" className="ts-nav__reset" onClick={() => onSelect(current.anchor)}>
          {range === 'weekly' ? 'This week' : 'This month'}
        </button>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function AttendanceModal({
  mode,
  members,
  record,
  apiError,
  saving,
  removing,
  onCancel,
  onSubmit,
  onRemove,
}: {
  mode: 'add' | 'edit'
  members: RosterRow[]
  record?: AttendanceRow
  apiError: string
  saving: boolean
  removing: boolean
  onCancel: () => void
  onSubmit: (form: AttendanceForm) => void
  onRemove?: () => void
}) {
  const isEdit = mode === 'edit'
  const [memberId, setMemberId] = useState<string | null>(record?.memberId ?? members[0]?.id ?? null)
  const [date, setDate] = useState(record?.date ?? formatDate(new Date()))
  const [clockIn, setClockIn] = useState(record?.clockIn || '08:30')
  const [clockOut, setClockOut] = useState(record?.clockOut || '16:30')
  const [overrideAutoCheckIn, setOverrideAutoCheckIn] = useState(isEdit)
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  const selectedMember = members.find((member) => member.id === memberId)

  if (confirmingRemove) {
    return (
      <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
        <div className="modal-card ts-confirm-card" onClick={(e) => e.stopPropagation()}>
          <div className="ts-confirm-card__icon">
            <Icon.AlertTriangle width={26} height={26} />
          </div>
          <h2 className="modal-title">Remove attendance log?</h2>
          <p className="ts-confirm-card__sub">This action cannot be undone.</p>
          {apiError && (
            <div className="form-error-alert">
              <Icon.AlertCircle width={18} height={18} />
              <span>{apiError}</span>
            </div>
          )}
          <div className="modal-actions modal-actions--split">
            <button type="button" className="btn btn--outline" onClick={() => setConfirmingRemove(false)} disabled={removing}>
              Cancel
            </button>
            <button type="button" className="btn btn--danger" disabled={removing} onClick={() => onRemove?.()}>
              {removing ? 'Deleting…' : 'Confirm Delete'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Modal onClose={onCancel} width={560}>
      <div className="ts-modal-head">
        <h2 className="modal-title">{isEdit ? 'Edit Attendance' : 'Log new Attendance'}</h2>
        <span className="ts-modal-head__meta">{date}</span>
      </div>

      {apiError && (
        <div className="form-error-alert" style={{ marginTop: 0, marginBottom: '1rem' }}>
          <Icon.AlertCircle width={18} height={18} />
          <span>{apiError}</span>
        </div>
      )}

      {isEdit && selectedMember && (
        <div className="ts-modal-summary">
          <div className="ts-modal-person">
            <Avatar name={selectedMember.name} size={42} />
            <span>{selectedMember.name}</span>
          </div>
        </div>
      )}

      {!isEdit && (
        <>
          <label className="field-label">Member</label>
          <Dropdown
            value={memberId}
            placeholder="Select member"
            onChange={setMemberId}
            selectedLabel={
              selectedMember && (
                <span className="ts-member-picker">
                  <Avatar name={selectedMember.name} size={24} />
                  {selectedMember.name}
                </span>
              )
            }
            options={members.map((member) => ({
              id: member.id,
              label: (
                <span className="ts-member-picker">
                  <Avatar name={member.name} size={24} />
                  {member.name}
                </span>
              ),
            }))}
          />
        </>
      )}

      <label className="field-label">Date</label>
      <DateField value={date} onChange={setDate} className="ts-modal-date" />

      <div className="field-row ts-field-row">
        <label className="field-label ts-field-group">
          Check-in
          <TimeField value={clockIn} onChange={setClockIn} />
        </label>
        <label className="field-label ts-field-group">
          Check-out
          <TimeField value={clockOut} onChange={setClockOut} />
        </label>
      </div>

      <p className="ts-modal-hint">
        Total: <strong>{calculateHours(clockIn, clockOut)} hrs</strong>
      </p>

      <label className="ts-override-row">
        <input
          type="checkbox"
          checked={overrideAutoCheckIn}
          onChange={(e) => setOverrideAutoCheckIn(e.target.checked)}
        />
        <span>Override auto check-in</span>
      </label>

      <div className={`modal-actions ${isEdit ? 'modal-actions--split' : ''}`}>
        {isEdit && (
          <button type="button" className="ts-remove-btn" onClick={() => setConfirmingRemove(true)} disabled={saving}>
            <Icon.Trash width={16} height={16} />
            Remove
          </button>
        )}
        <div className="modal-actions__group">
          <button type="button" className="btn btn--outline" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!memberId || saving}
            onClick={() =>
              onSubmit({
                memberId,
                date,
                clockIn,
                clockOut,
                overrideAutoCheckIn,
              })
            }
          >
            {saving ? 'Saving…' : isEdit ? 'Update' : 'Add Log'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function Timesheet() {
  const [search, setSearch] = useState('')
  const [range, setRange] = useState<RangeFilter>('today')
  const [sortKey, setSortKey] = useState<SortKey>('newest')
  const [memberFilter, setMemberFilter] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('summary')
  const [expanded, setExpanded] = useState<string[]>([])
  const [modalMode, setModalMode] = useState<ModalMode>('none')
  const [activeRow, setActiveRow] = useState<AttendanceRow | undefined>()
  const [modalError, setModalError] = useState('')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [flashId, setFlashId] = useState<string | null>(null)
  const tableWrapRef = useRef<HTMLDivElement>(null)
  useClickDragScroll(tableWrapRef)

  const { data: rosterUsers = [] } = useCrewsSummary({ statusEmployee: 'roster', limit: 100 })

  const members: RosterRow[] = useMemo(
    () =>
      rosterUsers.map((user: any) => ({
        id: user._id,
        rosterId: user._id ? user._id.slice(-4) : '',
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || 'Member',
        avatar: `https://i.pravatar.cc/64?img=${((user._id || '').charCodeAt(0) || 15) % 70}`,
        crewName: user.assignCrew?.name ?? null,
        crewColor: user.assignCrew?.crewColor ?? '#808080',
        role: user.role === 'crew-lead' ? 'Crew Lead' : 'Labor',
        rate: user.hourlyRate ?? 0,
        status: user.isActive ? 'Active' : 'Inactive',
      })),
    [rosterUsers],
  )

  /** Roster members, keyed by user id — the source of names/roles for a log. */
  const memberMap = useMemo(() => new Map(members.map((member) => [member.id, member])), [members])

  useEffect(() => {
    if (!flashId) return
    const timer = setTimeout(() => setFlashId(null), 2600)
    return () => clearTimeout(timer)
  }, [flashId])

  const today = useMemo(() => startOfDay(new Date()), [])
  /** Which week/month is being viewed. Any day inside the period works. */
  const [anchor, setAnchor] = useState<Date>(today)

  const bounds = useMemo(() => {
    if (range === 'today') return { start: today, end: today }
    if (range === 'weekly') {
      const start = startOfWeek(anchor)
      return { start, end: addDays(start, 6) }
    }
    if (range === 'monthly') return { start: startOfMonth(anchor), end: endOfMonth(anchor) }
    return null
  }, [range, anchor, today])

  /**
   * Every entry, fetched once. The list endpoint is not paginated and the
   * range/search/member filters below all run client-side — the period
   * navigator in particular needs the full span of logged dates to build its
   * list of selectable weeks/months.
   */
  const entriesQuery = useTimeEntries()
  const entries: TimeEntryItem[] = useMemo(() => entriesQuery.data ?? [], [entriesQuery.data])
  const loading = entriesQuery.isPending
  const loadError = entriesQuery.error
    ? getErrorMessage(entriesQuery.error, 'Could not load attendance logs.')
    : ''

  const rows = useMemo(
    () => entries.map((entry) => toAttendanceRow(entry, memberMap)),
    [entries, memberMap],
  )

  const { invalidateAll } = useInvalidateServerState()
  const loadEntries = invalidateAll

  /** Span of every logged date, so navigation stops where the data does. */
  const dataSpan = useMemo(() => {
    let min = today.getTime()
    let max = today.getTime()
    rows.forEach((row) => {
      const time = parseDate(row.date).getTime()
      if (time < min) min = time
      if (time > max) max = time
    })
    return { min: new Date(min), max: new Date(max) }
  }, [rows, today])

  const periods = useMemo(() => {
    if (range !== 'weekly' && range !== 'monthly') return []
    // The anchor can sit outside the logged span (e.g. after picking a far-off
    // date in the modal), so widen the span to always include it.
    const min = anchor < dataSpan.min ? anchor : dataSpan.min
    const max = anchor > dataSpan.max ? anchor : dataSpan.max
    return buildPeriods(range, min, max, today)
  }, [range, anchor, dataSpan, today])

  const activePeriodIndex = useMemo(() => {
    if (!bounds || periods.length === 0) return -1
    const target = range === 'weekly' ? startOfWeek(anchor) : startOfMonth(anchor)
    return periods.findIndex((period) => period.anchor.getTime() === target.getTime())
  }, [periods, bounds, range, anchor])

  const rangeLabel = useMemo(() => {
    if (range === 'today') return `${DAY_LABELS[(today.getDay() + 6) % 7]}, ${shortDate(today)} ${today.getFullYear()}`
    return 'All recorded attendance'
  }, [range, today])

  /** Columns for the grouped weekly/monthly grid. */
  const buckets = useMemo<Bucket[]>(() => {
    if (!bounds) return []
    if (range === 'weekly') {
      return Array.from({ length: 7 }, (_, index) => {
        const day = addDays(bounds.start, index)
        return { key: formatDate(day), label: DAY_LABELS[index], sub: shortDate(day), start: day, end: day }
      })
    }
    if (range === 'monthly') {
      const list: Bucket[] = []
      let cursor = startOfWeek(bounds.start)
      let week = 1
      while (cursor <= bounds.end) {
        const weekEnd = addDays(cursor, 6)
        const start = cursor < bounds.start ? bounds.start : cursor
        const end = weekEnd > bounds.end ? bounds.end : weekEnd
        list.push({ key: `week-${week}`, label: `Week ${week}`, sub: `${shortDate(start)} – ${shortDate(end)}`, start, end })
        cursor = addDays(cursor, 7)
        week += 1
      }
      return list
    }
    return []
  }, [range, bounds])

  const isGrouped = (range === 'weekly' || range === 'monthly') && viewMode === 'summary'

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
      const matchesSearch =
        !query ||
        row.name.toLowerCase().includes(query) ||
        row.rosterId.includes(query) ||
        row.role.toLowerCase().includes(query)
      const matchesMember = memberFilter.length === 0 || memberFilter.includes(row.memberId)
      if (!matchesSearch || !matchesMember) return false
      if (!bounds) return true
      const date = parseDate(row.date)
      return date >= bounds.start && date <= bounds.end
    })
  }, [rows, search, memberFilter, bounds])

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      switch (sortKey) {
        case 'newest': {
          const diff = parseDate(b.date).getTime() - parseDate(a.date).getTime()
          return diff !== 0 ? diff : b.createdAt - a.createdAt
        }
        case 'oldest': {
          const diff = parseDate(a.date).getTime() - parseDate(b.date).getTime()
          return diff !== 0 ? diff : a.createdAt - b.createdAt
        }
        case 'hours-desc':
          return b.hoursWorked - a.hoursWorked
        case 'hours-asc':
          return a.hoursWorked - b.hoursWorked
        case 'name-asc':
          return a.name.localeCompare(b.name)
        case 'name-desc':
          return b.name.localeCompare(a.name)
        default:
          return 0
      }
    })
  }, [filteredRows, sortKey])

  const summaries = useMemo<MemberSummary[]>(() => {
    const map = new Map<string, MemberSummary & { days: Set<string> }>()

    filteredRows.forEach((row) => {
      let summary = map.get(row.memberId)
      if (!summary) {
        summary = {
          memberId: row.memberId,
          rosterId: row.rosterId,
          name: row.name,
          avatar: row.avatar,
          role: row.role,
          entries: [],
          buckets: buckets.map(() => 0),
          totalHours: 0,
          daysWorked: 0,
          avgHours: 0,
          lastWorked: 0,
          days: new Set<string>(),
        }
        map.set(row.memberId, summary)
      }

      const date = parseDate(row.date)
      summary.entries.push(row)
      summary.totalHours += row.hoursWorked
      summary.days.add(row.date)
      summary.lastWorked = Math.max(summary.lastWorked, date.getTime())

      const index = buckets.findIndex((bucket) => date >= bucket.start && date <= bucket.end)
      if (index >= 0) summary.buckets[index] += row.hoursWorked
    })

    const list = [...map.values()].map(({ days, ...summary }) => ({
      ...summary,
      daysWorked: days.size,
      avgHours: days.size ? summary.totalHours / days.size : 0,
      entries: [...summary.entries].sort(
        (a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime() || b.createdAt - a.createdAt,
      ),
    }))

    return list.sort((a, b) => {
      switch (sortKey) {
        case 'newest':
          return b.lastWorked - a.lastWorked
        case 'oldest':
          return a.lastWorked - b.lastWorked
        case 'hours-desc':
          return b.totalHours - a.totalHours
        case 'hours-asc':
          return a.totalHours - b.totalHours
        case 'name-desc':
          return b.name.localeCompare(a.name)
        default:
          return a.name.localeCompare(b.name)
      }
    })
  }, [filteredRows, buckets, sortKey])

  const stats = useMemo(() => {
    const totalHours = filteredRows.reduce((sum, row) => sum + row.hoursWorked, 0)
    const days = new Set(filteredRows.map((row) => row.date))
    const members = new Set(filteredRows.map((row) => row.memberId))
    return {
      totalHours,
      members: members.size,
      days: days.size,
      avgPerDay: days.size ? totalHours / days.size : 0,
    }
  }, [filteredRows])

  const bucketTotals = useMemo(
    () => buckets.map((_, index) => summaries.reduce((sum, summary) => sum + summary.buckets[index], 0)),
    [buckets, summaries],
  )

  function toggleExpanded(memberId: string) {
    setExpanded((list) => (list.includes(memberId) ? list.filter((id) => id !== memberId) : [...list, memberId]))
  }

  function openAddModal() {
    setActiveRow(undefined)
    setModalError('')
    setModalMode('add')
  }

  function openEditModal(row: AttendanceRow) {
    setActiveRow(row)
    setModalError('')
    setModalMode('edit')
  }

  function closeModal() {
    setModalMode('none')
    setActiveRow(undefined)
    setModalError('')
  }

  /**
   * Reveal a just-saved log that the active range/search/member filters would
   * otherwise hide, so saving never looks like it silently did nothing.
   */
  function revealSaved(row: { memberId: string; date: string; name: string; rosterId: string; role: string }, isNew: boolean) {
    const date = parseDate(row.date)
    if (bounds && (date < bounds.start || date > bounds.end)) {
      // Move the viewed period onto the saved date rather than jumping to All Time.
      setAnchor(date)
      if (range === 'today' && date.getTime() !== today.getTime()) setRange('weekly')
    }
    if (memberFilter.length > 0 && !memberFilter.includes(row.memberId)) {
      setMemberFilter((list) => [...list, row.memberId])
    }
    const query = search.trim().toLowerCase()
    if (query && !row.name.toLowerCase().includes(query) && !row.rosterId.includes(query) && !row.role.toLowerCase().includes(query)) {
      setSearch('')
    }
    if (isNew) {
      setSortKey('newest')
      setExpanded((list) => (list.includes(row.memberId) ? list : [...list, row.memberId]))
    }
  }

  async function handleSubmit(form: AttendanceForm) {
    if (!form.memberId) return
    const member = memberMap.get(form.memberId)
    // A new log needs a real roster member; an edit only needs the entry id, so
    // it still works for a log whose member has since been removed.
    if (!member && modalMode === 'add') return

    setSaving(true)
    setModalError('')
    try {
      const clockIn = toTimestamp(form.date, form.clockIn)
      const clockOut = toClockOutTimestamp(form.date, form.clockIn, form.clockOut)

      let savedId: string
      if (modalMode === 'edit' && activeRow) {
        const res = await updateTimeEntry(activeRow.id, {
          date: toApiDate(parseDate(form.date)),
          clockIn,
          clockOut,
          override: form.overrideAutoCheckIn,
        })
        savedId = res.data?._id ?? activeRow.id
      } else {
        const res = await createTimesheetLog({
          userId: form.memberId,
          date: toApiDate(parseDate(form.date)),
          clockIn,
          clockOut,
          override: form.overrideAutoCheckIn,
        })
        savedId = res.data?._id ?? ''
      }

      await loadEntries()
      revealSaved(
        {
          memberId: form.memberId,
          date: form.date,
          name: member?.name ?? activeRow?.name ?? '',
          rosterId: member?.rosterId ?? activeRow?.rosterId ?? '',
          role: member?.role ?? activeRow?.role ?? '',
        },
        modalMode === 'add',
      )
      setFlashId(savedId || null)
      closeModal()
    } catch (err) {
      setModalError(getErrorMessage(err, 'Could not save this attendance log.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    if (!activeRow) return
    setRemoving(true)
    setModalError('')
    try {
      await deleteTimeEntry(activeRow.id)
      await loadEntries()
      closeModal()
    } catch (err) {
      setModalError(getErrorMessage(err, 'Could not delete this attendance log.'))
    } finally {
      setRemoving(false)
    }
  }

  const detailColSpan = 8
  const gridColSpan = buckets.length + 4
  const emptyMessage = loading
    ? 'Loading attendance…'
    : loadError || 'No attendance logged for this period.'

  return (
    <div className="dash ts-page">
      <Sidebar active="Timesheet" />

      <main className="dash__main ts-main">
        <div className="ts-header-row">
          <div>
            <h1 className="dash__title">Timesheet</h1>
            <p className="dash__subtitle">Manage your roster's attendance</p>
          </div>
        </div>

        <div className="ts-toolbar">
          <div className="ts-toolbar__left">
            <label className="ts-search-inline">
              <MagnifyingGlass size={16} weight="regular" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a member..." />
            </label>

            <Dropdown
              value={range}
              options={RANGE_OPTIONS.map((option) => ({ id: option.id, label: option.label }))}
              onChange={(id) => setRange(id as RangeFilter)}
              placeholder="Today"
              selectedLabel={RANGE_OPTIONS.find((option) => option.id === range)?.label}
            />

            <MemberFilter members={members} selected={memberFilter} onChange={setMemberFilter} />

            {(range === 'weekly' || range === 'monthly') && (
              <div className="ts-view-toggle">
                <button type="button" className={viewMode === 'summary' ? 'is-active' : ''} onClick={() => setViewMode('summary')}>
                  Summary
                </button>
                <button type="button" className={viewMode === 'detailed' ? 'is-active' : ''} onClick={() => setViewMode('detailed')}>
                  Detailed
                </button>
              </div>
            )}
          </div>

          <div className="ts-toolbar__right">
            <div className="ts-dd--sort">
              <Dropdown
                value={sortKey}
                options={SORT_OPTIONS.map((option) => ({ id: option.id, label: option.label }))}
                onChange={(id) => setSortKey(id as SortKey)}
                staticLabel="Sort by"
              />
            </div>
            <button type="button" className="btn btn--primary ts-log-btn" onClick={openAddModal}>
              <Icon.Plus width={16} height={16} />
              Log Attendance
            </button>
          </div>
        </div>

        <div className="ts-period">
          {range === 'weekly' || range === 'monthly' ? (
            <PeriodNavigator range={range} periods={periods} activeIndex={activePeriodIndex} onSelect={setAnchor} />
          ) : (
            <div className="ts-period__label">
              <Icon.Calendar width={15} height={15} />
              <span>{rangeLabel}</span>
            </div>
          )}
          <div className="ts-stats">
            <div className="ts-stat">
              <span className="ts-stat__value">{formatHours(stats.totalHours)}</span>
              <span className="ts-stat__label">Total hours</span>
            </div>
            <div className="ts-stat">
              <span className="ts-stat__value">{stats.members}</span>
              <span className="ts-stat__label">Members logged</span>
            </div>
            <div className="ts-stat">
              <span className="ts-stat__value">{stats.days}</span>
              <span className="ts-stat__label">Days covered</span>
            </div>
            <div className="ts-stat">
              <span className="ts-stat__value">{formatHours(stats.avgPerDay)}</span>
              <span className="ts-stat__label">Avg hrs / day</span>
            </div>
          </div>
        </div>

        <div className="ts-table-wrap" ref={tableWrapRef}>
          {isGrouped ? (
            <table className="ts-table ts-grid-table">
              <thead>
                <tr>
                  <th className="ts-grid-member">Member</th>
                  {buckets.map((bucket) => (
                    <th key={bucket.key} className="ts-grid-cell">
                      <span className="ts-grid-head__label">{bucket.label}</span>
                      <span className="ts-grid-head__sub">{bucket.sub}</span>
                    </th>
                  ))}
                  <th className="ts-grid-cell">Total</th>
                  <th className="ts-grid-cell">Days</th>
                  <th className="ts-grid-cell">Avg / day</th>
                </tr>
              </thead>
              <tbody>
                {summaries.length === 0 && (
                  <tr>
                    <td colSpan={gridColSpan} className="ts-empty">
                      {emptyMessage}
                    </td>
                  </tr>
                )}
                {summaries.map((summary) => {
                  const isOpen = expanded.includes(summary.memberId)
                  const peak = Math.max(...summary.buckets, 1)
                  return (
                    <Fragment key={summary.memberId}>
                      <tr className={`ts-grid-row ${isOpen ? 'is-open' : ''}`}>
                        <td className="ts-grid-member">
                          {/* A button, not a row click — the table also pans on drag. */}
                          <button
                            type="button"
                            className="ts-member-cell ts-member-toggle"
                            onClick={() => toggleExpanded(summary.memberId)}
                            aria-expanded={isOpen}
                            aria-label={`${isOpen ? 'Hide' : 'Show'} daily logs for ${summary.name}`}
                          >
                            <span className={`ts-expand ${isOpen ? 'is-open' : ''}`}>
                              <Icon.ChevronRight width={14} height={14} />
                            </span>
                            <Avatar name={summary.name} size={28} />
                            <span className="ts-member-cell__text">
                              <span>{summary.name}</span>
                              <span className="ts-member-cell__meta">{summary.role}</span>
                            </span>
                          </button>
                        </td>
                        {summary.buckets.map((hours, index) => (
                          <td key={buckets[index].key} className="ts-grid-cell">
                            {hours > 0 ? (
                              <span className="ts-hour-cell">
                                <span className="ts-hour-cell__value">{formatHours(hours)}</span>
                                <span className="ts-hour-cell__bar" style={{ width: `${(hours / peak) * 100}%` }} />
                              </span>
                            ) : (
                              <span className="ts-hour-cell__empty">–</span>
                            )}
                          </td>
                        ))}
                        <td className="ts-grid-cell ts-grid-cell--total">{formatHours(summary.totalHours)}</td>
                        <td className="ts-grid-cell">{summary.daysWorked}</td>
                        <td className="ts-grid-cell">{formatHours(summary.avgHours)}</td>
                      </tr>

                      {isOpen && (
                        <tr className="ts-grid-detail-row">
                          <td colSpan={gridColSpan}>
                            <table className="ts-detail-table">
                              <thead>
                                <tr>
                                  <th>Date</th>
                                  <th>Clock-in</th>
                                  <th>Clock-out</th>
                                  <th>Hours</th>
                                  <th>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {summary.entries.map((entry) => (
                                  <tr key={entry.id} className={flashId === entry.id ? 'is-new' : ''}>
                                    <td>{entry.date}</td>
                                    <td>{entry.clockIn || '—'}</td>
                                    <td>{entry.clockOut || '—'}</td>
                                    <td>{formatHours(entry.hoursWorked)}</td>
                                    <td>
                                      <button
                                        type="button"
                                        className="ts-inline-edit"
                                        onClick={() => openEditModal(entry)}
                                        aria-label={`Edit ${entry.date} attendance for ${entry.name}`}
                                      >
                                        <PenIcon size={14} />
                                        Edit
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
              {summaries.length > 0 && (
                <tfoot>
                  <tr>
                    <td className="ts-grid-member">Team total</td>
                    {bucketTotals.map((total, index) => (
                      <td key={buckets[index].key} className="ts-grid-cell">
                        {total > 0 ? formatHours(total) : '–'}
                      </td>
                    ))}
                    <td className="ts-grid-cell ts-grid-cell--total">{formatHours(stats.totalHours)}</td>
                    <td className="ts-grid-cell">{stats.days}</td>
                    <td className="ts-grid-cell">{formatHours(stats.avgPerDay)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          ) : (
            <table className="ts-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Date</th>
                  <th>Clock-in</th>
                  <th>Clock-out</th>
                  <th>Hours Worked</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.length === 0 && (
                  <tr>
                    <td colSpan={detailColSpan} className="ts-empty">
                      {emptyMessage}
                    </td>
                  </tr>
                )}
                {sortedRows.map((row) => (
                  <tr key={row.id} className={flashId === row.id ? 'is-new' : ''}>
                    <td>
                      <div className="ts-member-cell">
                        <Avatar name={row.name} size={26} />
                        <span>{row.name}</span>
                      </div>
                    </td>
                    <td>{row.role}</td>
                    <td>{row.date}</td>
                    <td>{row.clockIn || '—'}</td>
                    <td>{row.clockOut || '—'}</td>
                    <td>{formatHours(row.hoursWorked)}</td>
                    <td>
                      <button type="button" className="btn--primary btn" onClick={() => openEditModal(row)} aria-label={`Edit attendance for ${row.name}`}>
                        <PenIcon size={20} />
                        <p>Edit</p>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {modalMode !== 'none' && (
        <AttendanceModal
          mode={modalMode}
          members={members}
          record={activeRow}
          apiError={modalError}
          saving={saving}
          removing={removing}
          onCancel={closeModal}
          onSubmit={handleSubmit}
          onRemove={handleRemove}
        />
      )}
    </div>
  )
}
