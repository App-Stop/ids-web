import { useMemo, useRef, useState } from 'react'
import { MagnifyingGlass, Bell, Plus } from '@phosphor-icons/react'
import Sidebar from '../components/dashboard/Sidebar'
import Modal from '../components/dashboard/Modal'
import Dropdown from '../components/dashboard/Dropdown'
import Avatar from '../components/dashboard/Avatar'
import CreateJobModal, { type JobFormData } from '../components/dashboard/CreateJobModal'
import CreateCrewModal, { type CrewFormData } from '../components/dashboard/CreateCrewModal'
import ZoomControl from '../components/dashboard/ZoomControl'
import { Icon } from '../components/dashboard/icons'
import { rosterRows as initialRosterRows, type RosterRow } from '../lib/crewData'
import { crewLeads, jobs as initialJobs, type Job } from '../lib/dashboardData'
import { useClickDragScroll } from '../hooks/useClickDragScroll'
import './Dashboard.css'
import '../components/dashboard/crew-modals.css'
import './Timesheet.css'

type RangeFilter = 'today' | 'weekly' | 'monthly' | 'all-time'
type SortKey = 'newest' | 'oldest' | 'hours-desc' | 'hours-asc' | 'name-asc' | 'name-desc'
type ModalMode = 'none' | 'add' | 'edit'

type AttendanceRow = {
  id: string
  rosterId: string
  name: string
  avatar: string
  role: RosterRow['role']
  date: string
  clockIn: string
  clockOut: string
  hoursWorked: number
}

type AttendanceForm = {
  memberId: string | null
  date: string
  clockIn: string
  clockOut: string
  overrideAutoCheckIn: boolean
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

const DEFAULT_DATE = '07-20-2026'

const INITIAL_HOURS = [7, 8, 4.5, 6, 8.5, 9, 4, 6]
const INITIAL_TIMES = [
  { clockIn: '08:30', clockOut: '15:30' },
  { clockIn: '07:30', clockOut: '15:30' },
  { clockIn: '08:00', clockOut: '12:30' },
  { clockIn: '08:30', clockOut: '14:30' },
  { clockIn: '07:30', clockOut: '16:00' },
  { clockIn: '07:30', clockOut: '16:30' },
  { clockIn: '08:30', clockOut: '12:30' },
  { clockIn: '09:00', clockOut: '15:00' },
]

type ActionChooserMode = 'none' | 'chooser' | 'job' | 'crew'

function buildInitialRows(): AttendanceRow[] {
  return initialRosterRows.map((row, index) => {
    const pair = INITIAL_TIMES[index] ?? INITIAL_TIMES[0]
    return {
      id: row.id,
      rosterId: row.rosterId,
      name: row.name,
      avatar: row.avatar,
      role: row.role,
      date: DEFAULT_DATE,
      clockIn: pair.clockIn,
      clockOut: pair.clockOut,
      hoursWorked: INITIAL_HOURS[index] ?? 8,
    }
  })
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
      <input ref={ref} type="date" value={value.split('-').reverse().join('-')} onChange={(e) => onChange(e.target.value.split('-').reverse().join('-'))} className="ts-date-field__native" />
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

function ActionChooserModal({ onCancel, onAddJob, onCreateCrew }: { onCancel: () => void; onAddJob: () => void; onCreateCrew: () => void }) {
  return (
    <div className="cm-overlay" onClick={onCancel}>
      <div className="cm-card cm-card--narrow" onClick={(e) => e.stopPropagation()}>
        <div className="cm-card__header">
          <h2 className="cm-card__title">New Action</h2>
          <button type="button" className="cm-close" onClick={onCancel} aria-label="Close">
            <Icon.X width={16} height={16} />
          </button>
        </div>

        <p className="cm-subtitle">What would you like to do?</p>

        <div className="cm-choice-list">
          <button type="button" className="cm-choice" onClick={onAddJob}>
            <Icon.Wrench width={22} height={22} />
            <span>Add New Job</span>
          </button>
          <button type="button" className="cm-choice" onClick={onCreateCrew}>
            <Icon.Building width={22} height={22} />
            <span>Create New Crew</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function AttendanceModal({
  mode,
  members,
  record,
  onCancel,
  onSubmit,
  onRemove,
}: {
  mode: 'add' | 'edit'
  members: AttendanceRow[]
  record?: AttendanceRow
  onCancel: () => void
  onSubmit: (form: AttendanceForm) => void
  onRemove?: () => void
}) {
  const isEdit = mode === 'edit'
  const [memberId, setMemberId] = useState<string | null>(record?.id ?? members[0]?.id ?? null)
  const [date, setDate] = useState(record?.date ?? DEFAULT_DATE)
  const [clockIn, setClockIn] = useState(record?.clockIn ?? '08:30')
  const [clockOut, setClockOut] = useState(record?.clockOut ?? '16:30')
  const [overrideAutoCheckIn, setOverrideAutoCheckIn] = useState(false)
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
          <div className="modal-actions modal-actions--split">
            <button type="button" className="btn btn--outline" onClick={() => setConfirmingRemove(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                onRemove?.()
                setConfirmingRemove(false)
              }}
            >
              Confirm Delete
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
        <span className="ts-modal-head__meta">{record?.date ?? DEFAULT_DATE}</span>
      </div>

      {isEdit && selectedMember && (
        <div className="ts-modal-summary">
          <div className="ts-modal-person">
            <Avatar name={selectedMember.name} size={42} />
            <span>{selectedMember.name}</span>
          </div>
          <span className="ts-modal-head__meta">{date}</span>
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
          <button type="button" className="ts-remove-btn" onClick={() => setConfirmingRemove(true)}>
            <Icon.Trash width={16} height={16} />
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
            {isEdit ? 'Update' : 'Add Log'}
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
  const [rows, setRows] = useState<AttendanceRow[]>(buildInitialRows)
  const [modalMode, setModalMode] = useState<ModalMode>('none')
  const [activeRow, setActiveRow] = useState<AttendanceRow | undefined>()
  const [actionMode, setActionMode] = useState<ActionChooserMode>('none')
  const [jobs, setJobs] = useState<Job[]>(initialJobs)
  const [zoom, setZoom] = useState(1)
  const tableWrapRef = useRef<HTMLDivElement>(null)
  useClickDragScroll(tableWrapRef)

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesSearch =
        !search ||
        row.name.toLowerCase().includes(search.toLowerCase()) ||
        row.rosterId.includes(search) ||
        row.role.toLowerCase().includes(search.toLowerCase())
      const matchesRange = range === 'all-time' ? true : row.date === DEFAULT_DATE
      return matchesSearch && matchesRange
    })
  }, [rows, search, range])

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      switch (sortKey) {
        case 'newest':
          return b.rosterId.localeCompare(a.rosterId)
        case 'oldest':
          return a.rosterId.localeCompare(b.rosterId)
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

  function openAddModal() {
    setActiveRow(undefined)
    setModalMode('add')
  }

  function openEditModal(row: AttendanceRow) {
    setActiveRow(row)
    setModalMode('edit')
  }

  function closeModal() {
    setModalMode('none')
    setActiveRow(undefined)
  }

  function handleSubmit(form: AttendanceForm) {
    const member = initialRosterRows.find((row) => row.id === form.memberId) ?? initialRosterRows[0]
    if (!member) return

    const nextRow: AttendanceRow = {
      id: activeRow?.id ?? `att-${Date.now()}`,
      rosterId: member.rosterId,
      name: member.name,
      avatar: member.avatar,
      role: member.role,
      date: form.date,
      clockIn: form.clockIn,
      clockOut: form.clockOut,
      hoursWorked: calculateHours(form.clockIn, form.clockOut),
    }

    setRows((list) => {
      if (modalMode === 'edit' && activeRow) {
        return list.map((row) => (row.id === activeRow.id ? nextRow : row))
      }
      return [nextRow, ...list]
    })

    closeModal()
  }

  function handleRemove() {
    if (!activeRow) return
    setRows((list) => list.filter((row) => row.id !== activeRow.id))
    closeModal()
  }

  function handleAddJob(data: JobFormData) {
    const selectedLead = crewLeads.find((lead) => lead.id === data.crewLeadId)
    const nextIndex = jobs.length + 1
    const nextJob: Job = {
      id: `j${Date.now()}`,
      name: data.name,
      color: data.color,
      bidNo: String(1000 + nextIndex),
      jobNo: String(nextIndex).padStart(3, '0'),
      gc: data.gc,
      estimator: selectedLead?.name ?? 'TBD',
      startDate: data.startDate,
      endDate: data.endDate,
      contractAmount: data.contractAmount,
      laborBudgetUsed: 0,
      laborBudgetTotal: data.laborBudgetTotal,
    }
    setJobs((list) => [...list, nextJob])
    setActionMode('none')
  }

  function handleAddCrew(data: CrewFormData) {
    void data
    setActionMode('none')
  }

  return (
    <div className="dash ts-page">
      <Sidebar active="Timesheet" />

      <main className="dash__main ts-main" style={{ zoom }}>
        <div className="topbar ts-topbar">
          <label className="topbar__search ts-search">
            <MagnifyingGlass size={18} weight="regular" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search anything..." />
          </label>

          <div className="topbar__actions ts-topbar__actions">
            <ZoomControl
              zoom={zoom}
              onZoomIn={() => setZoom((z) => Math.min(1.5, +(z + 0.05).toFixed(2)))}
              onZoomOut={() => setZoom((z) => Math.max(0.75, +(z - 0.05).toFixed(2)))}
            />
            <button type="button" className="icon-btn icon-btn--bordered" aria-label="Notifications">
              <Bell size={18} weight="regular" />
              <i className="dot-badge" />
            </button>
            <button type="button" className="btn btn--primary ts-log-action" onClick={() => setActionMode('chooser')}>
              <Plus size={16} weight="bold" />
              New Action
            </button>
          </div>
        </div>

        <div className="ts-header-row">
          <div>
            <h1 className="dash__title">Timesheet</h1>
            <p className="dash__subtitle">Manage your roster's attendance</p>
          </div>
        </div>

        <div className="ts-toolbar">
          <div className="ts-toolbar__left">
            <Dropdown
              value={range}
              options={RANGE_OPTIONS.map((option) => ({ id: option.id, label: option.label }))}
              onChange={(id) => setRange(id as RangeFilter)}
              placeholder="Today"
              staticLabel="Today"
            />
          </div>

          <div className="ts-toolbar__right">
            <Dropdown
              value={sortKey}
              options={SORT_OPTIONS.map((option) => ({ id: option.id, label: option.label }))}
              onChange={(id) => setSortKey(id as SortKey)}
              placeholder="Sort by"
              staticLabel="Sort by"
            />
            <button type="button" className="btn btn--primary ts-log-btn" onClick={openAddModal}>
              <Icon.Plus width={16} height={16} />
              Log Attendance
            </button>
          </div>
        </div>

        <div className="ts-table-wrap" ref={tableWrapRef}>
          <table className="ts-table">
            <thead>
              <tr>
                <th className="ts-col-check">
                  <input type="checkbox" />
                </th>
                <th>Roster ID</th>
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
              {sortedRows.map((row) => (
                <tr key={row.id}>
                  <td className="ts-col-check">
                    <input type="checkbox" />
                  </td>
                  <td className="ts-id-cell">#{row.rosterId}</td>
                  <td>
                    <div className="ts-member-cell">
                      <Avatar name={row.name} size={26} />
                      <span>{row.name}</span>
                    </div>
                  </td>
                  <td>{row.role}</td>
                  <td>{row.date}</td>
                  <td>{row.clockIn}</td>
                  <td>{row.clockOut}</td>
                  <td>{row.hoursWorked}</td>
                  <td>
                    <button type="button" className="ts-action-btn" onClick={() => openEditModal(row)} aria-label={`Edit attendance for ${row.name}`}>
                      <Icon.Edit width={15} height={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {actionMode === 'chooser' && (
        <ActionChooserModal
          onCancel={() => setActionMode('none')}
          onAddJob={() => setActionMode('job')}
          onCreateCrew={() => setActionMode('crew')}
        />
      )}

      {actionMode === 'job' && (
        <CreateJobModal
          onCancel={() => setActionMode('none')}
          onSubmit={handleAddJob}
        />
      )}

      {actionMode === 'crew' && (
        <CreateCrewModal
          jobs={jobs}
          onCancel={() => setActionMode('none')}
          onSubmit={handleAddCrew}
        />
      )}

      {modalMode !== 'none' && (
        <AttendanceModal
          mode={modalMode}
          members={rows}
          record={activeRow}
          onCancel={closeModal}
          onSubmit={handleSubmit}
          onRemove={handleRemove}
        />
      )}
    </div>
  )
}
