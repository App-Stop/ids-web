import { useEffect, useMemo, useRef, useState } from 'react'
import { MagnifyingGlass, Plus, CalendarBlank } from '@phosphor-icons/react'
import Sidebar from '../components/dashboard/Sidebar'
import Modal from '../components/dashboard/Modal'
import Dropdown from '../components/dashboard/Dropdown'
import MenuDropdown from '../components/dashboard/MenuDropdown'
import NewActionMenu from '../components/dashboard/NewActionMenu'
import CreateJobModal, { type JobFormData } from '../components/dashboard/CreateJobModal'
import CreateCrewModal, { type CrewFormData } from '../components/dashboard/CreateCrewModal'
import JobDetailsModal from '../components/dashboard/JobDetailsModal'
import AssignCrewModal from '../components/dashboard/AssignCrewModal'
import ZoomControl from '../components/dashboard/ZoomControl'
import { Icon } from '../components/dashboard/icons'
import { crewRows as initialCrewRows, crewMenuOptions } from '../lib/crewData'
import { useClickDragScroll } from '../hooks/useClickDragScroll'
import {
  assignableCrews,
  crewLeads,
  formatMoney,
  type Job,
  type UnassignedCrew,
} from '../lib/dashboardData'
import { initialManagedJobs, type ManagedJob } from '../lib/jobsManagementData'
import './Dashboard.css'
import './CostTracking.css'

type ViewMode = 'jobs' | 'crew'
type RangeMode = 'Custom Range' | 'Weekly' | 'Monthly' | 'All Time'
type ModalMode = 'none' | 'add' | 'edit'
type JobFlow = { type: 'none' } | { type: 'details'; jobId: string } | { type: 'assignCrew'; jobId: string }

type JobCostRow = {
  id: string
  jobId: string
  jobName: string
  color: string
  date: string
  contract: number
  laborBudgetTotal: number
  laborBudgetUsed: number
  balanceLeft: number
  percentSpent: number
  cumulativeLaborCosts: number
  laborCost: number
  dumpstersCount: number
  dumpsterUnitCost: number
  totalCost: number
  weeklyCosts: Array<number | null>
}

type CrewCostRow = {
  id: string
  crewId: string
  crewName: string
  avatar: string
  color: string
  date: string
  hourlyRate: number
  totalHours: number
  cost: number
  laborCost: number
  dumpstersCount: number
  dumpsterUnitCost: number
  totalCost: number
}

type CostRecordForm = {
  jobId: string | null
  crewId: string | null
  date: string
  laborCost: string
  dumpstersCount: string
  dumpsterUnitCost: string
}

const RANGE_OPTIONS: { id: RangeMode; label: RangeMode }[] = [
  { id: 'Custom Range', label: 'Custom Range' },
  { id: 'Weekly', label: 'Weekly' },
  { id: 'Monthly', label: 'Monthly' },
  { id: 'All Time', label: 'All Time' },
]

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function getMonday(date: Date) {
  const monday = new Date(date)
  const day = monday.getDay()
  const offset = day === 0 ? -6 : 1 - day
  monday.setDate(monday.getDate() + offset)
  return monday
}

function formatToolbarDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const year = String(date.getFullYear())
  return `${month}-${day}-${year}`
}

function formatGridDate(date: Date) {
  const month = date.getMonth() + 1
  const day = date.getDate()
  const year = String(date.getFullYear()).slice(2)
  return `${month}-${day}-${year}`
}

function formatCrewDate(value: string) {
  const [month, day, year] = value.split('-')
  if (!month || !day || !year) return value
  return `${month}-${day}-${year}`
}

function makeWeeklyCosts(laborCost: number) {
  return [
    Math.round(laborCost * 0.5),
    Math.round(laborCost * 0.5),
    Math.round(laborCost * 0.35),
    Math.round(laborCost * 0.25),
    Math.round(laborCost * 0.2),
    Math.round(laborCost * 0.18),
    null,
  ]
}

function DateField({ value, onChange, className = '' }: { value: string; onChange: (value: string) => void; className?: string }) {
  const ref = useRef<HTMLInputElement>(null)

  return (
    <div className={`ct-date-field ${className}`}>
      <button
        type="button"
        className="ct-date-field__trigger"
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
        <span>{formatToolbarDate(parseIsoDate(value))}</span>
        <CalendarBlank size={16} weight="regular" />
      </button>
      <input ref={ref} type="date" value={value} onChange={(e) => onChange(e.target.value)} className="ct-date-field__native" />
    </div>
  )
}

function managedToJob(job: ManagedJob): Job {
  const num = job.id.replace(/\D/g, '') || '1'
  return {
    id: job.id,
    name: job.name,
    color: job.color,
    bidNo: String(1000 + Number(num)),
    jobNo: num.padStart(3, '0'),
    gc: job.gc,
    estimator: job.idsSuper,
    startDate: job.startDate,
    endDate: job.endDate,
    contractAmount: job.contract,
    laborBudgetUsed: job.laborBudgetUsed,
    laborBudgetTotal: job.laborBudgetTotal,
  }
}

function makeCostJobs(): Job[] {
  return initialManagedJobs.map(managedToJob)
}

function makeJobRows(): JobCostRow[] {
  return initialManagedJobs.map((job, index) => {
    const dumpstersCount = 1 + (index % 3)
    const dumpsterUnitCost = 500 + index * 25
    const laborCost = job.laborBudgetUsed
    const balanceLeft = Math.max(0, job.laborBudgetTotal - job.laborBudgetUsed)
    const percentSpent = job.laborBudgetTotal > 0 ? job.laborBudgetUsed / job.laborBudgetTotal : 0
    return {
      id: job.id,
      jobId: job.id,
      jobName: job.name,
      color: job.color,
      date: job.startDate,
      contract: job.contract,
      laborBudgetTotal: job.laborBudgetTotal,
      laborBudgetUsed: job.laborBudgetUsed,
      balanceLeft,
      percentSpent,
      cumulativeLaborCosts: job.laborBudgetUsed,
      laborCost,
      dumpstersCount,
      dumpsterUnitCost,
      totalCost: laborCost + dumpstersCount * dumpsterUnitCost,
      weeklyCosts: makeWeeklyCosts(laborCost),
    }
  })
}

function makeCrewRows(): CrewCostRow[] {
  return initialCrewRows.map((crew, index) => {
    const totalHours = crew.workers * 11 + index * 3
    const laborCost = totalHours * crew.rate
    const dumpstersCount = Math.max(1, (crew.laborNames.length % 3) + 1)
    const dumpsterUnitCost = 450 + index * 30
    return {
      id: crew.id,
      crewId: crew.crewId,
      crewName: crew.name,
      avatar: crew.avatar,
      color: crew.color,
      date: crew.jobs[0]?.date ?? '01-01-2026',
      hourlyRate: crew.rate,
      totalHours,
      cost: laborCost,
      laborCost,
      dumpstersCount,
      dumpsterUnitCost,
      totalCost: laborCost + dumpstersCount * dumpsterUnitCost,
    }
  })
}

function toDetailsJob(row: JobCostRow, catalog: Job[]): Job {
  const match = catalog.find((j) => j.name === row.jobName)
  const num = row.id.replace(/[^0-9]/g, '') || '1'
  return {
    id: row.jobId,
    name: row.jobName,
    color: row.color,
    bidNo: match?.bidNo ?? String(1000 + Number(num)),
    jobNo: match?.jobNo ?? num.padStart(3, '0'),
    gc: match?.gc ?? 'Turner Const.',
    estimator: match?.estimator ?? 'John D.',
    startDate: match?.startDate ?? row.date,
    endDate: match?.endDate ?? row.date,
    contractAmount: row.contract,
    laborBudgetUsed: row.laborBudgetUsed,
    laborBudgetTotal: row.laborBudgetTotal,
  }
}

function CostModal({
  mode,
  scope,
  jobs,
  jobRows,
  crews,
  record,
  onCancel,
  onSubmit,
}: {
  mode: 'add' | 'edit'
  scope: ViewMode
  jobs: Job[]
  jobRows: JobCostRow[]
  crews: typeof crewMenuOptions
  record?: JobCostRow | CrewCostRow
  onCancel: () => void
  onSubmit: (form: CostRecordForm) => void
}) {
  const isCrewScope = scope === 'crew'
  const initialJobId = record && 'jobId' in record ? record.jobId : null
  const initialCrewId = record && 'crewId' in record ? record.crewId : null
  const [form, setForm] = useState<CostRecordForm>(() => {
    const jobId = !isCrewScope ? initialJobId ?? jobs[0]?.id ?? null : jobs[0]?.id ?? null
    const existing = jobId ? jobRows.find((row) => row.jobId === jobId || row.id === jobId) : undefined
    const job = jobId ? jobs.find((item) => item.id === jobId) : undefined
    return {
      jobId,
      crewId: isCrewScope ? initialCrewId ?? crews[0]?.id ?? null : crews[0]?.id ?? null,
      date: record?.date ?? new Date().toISOString().slice(0, 10),
      laborCost: String(record?.laborCost ?? existing?.laborCost ?? job?.laborBudgetUsed ?? 0),
      dumpstersCount: String(record?.dumpstersCount ?? existing?.dumpstersCount ?? 1),
      dumpsterUnitCost: String(record?.dumpsterUnitCost ?? existing?.dumpsterUnitCost ?? 500),
    }
  })

  const selectedJob = jobs.find((job) => job.id === form.jobId)
  const laborCost = Number(form.laborCost) || 0
  const dumpstersCount = Number(form.dumpstersCount) || 0
  const dumpsterUnitCost = Number(form.dumpsterUnitCost) || 0
  const totalCost = laborCost + dumpstersCount * dumpsterUnitCost

  function selectJob(id: string | null) {
    if (!id) {
      setForm((current) => ({ ...current, jobId: null }))
      return
    }
    const existing = jobRows.find((row) => row.jobId === id || row.id === id)
    const job = jobs.find((item) => item.id === id)
    setForm((current) => ({
      ...current,
      jobId: id,
      laborCost: String(existing?.laborCost ?? job?.laborBudgetUsed ?? current.laborCost),
      dumpstersCount: String(existing?.dumpstersCount ?? current.dumpstersCount),
      dumpsterUnitCost: String(existing?.dumpsterUnitCost ?? current.dumpsterUnitCost),
    }))
  }

  return (
    <Modal onClose={onCancel} width={540}>
      <div className="ct-modal-head">
        <h2 className="modal-title">{mode === 'edit' ? 'Edit Accumulated Cost' : 'Add Daily Dumpster Count'}</h2>
        <span className="ct-modal-id">ID #{selectedJob?.jobNo ?? '001'}</span>
      </div>

      <label className="field-label">{isCrewScope ? 'Crew' : 'Job'}</label>
      {isCrewScope ? (
        <MenuDropdown
          options={crews}
          value={form.crewId}
          onChange={(id) => setForm((current) => ({ ...current, crewId: id }))}
          placeholder="Select crew"
          includeAll={false}
          showDot
          showAvatar
          className="ct-modal-dropdown"
        />
      ) : (
        <MenuDropdown
          options={jobs.map((job) => ({
            id: job.id,
            label: job.name,
          }))}
          value={form.jobId}
          onChange={selectJob}
          placeholder="Select job"
          includeAll={false}
          showDot={false}
          className="ct-modal-dropdown"
        />
      )}

      <label className="field-label">Date*</label>
      <DateField value={form.date} onChange={(date) => setForm((current) => ({ ...current, date }))} className="ct-modal-date" />

      <div className="field-row">
        <label className="field-label">
          {mode === 'edit' ? 'Labor Cost*' : 'Dumpsters Count*'}
          <input
            className="field-input"
            inputMode="decimal"
            value={form.laborCost}
            onChange={(e) => setForm((current) => ({ ...current, laborCost: e.target.value }))}
            placeholder="6,000"
          />
        </label>
        <label className="field-label">
          {mode === 'edit' ? 'Dumpsters Count*' : 'Each Cost*'}
          <input
            className="field-input"
            inputMode="decimal"
            value={mode === 'edit' ? form.dumpstersCount : form.dumpsterUnitCost}
            onChange={(e) =>
              setForm((current) =>
                mode === 'edit'
                  ? { ...current, dumpstersCount: e.target.value }
                  : { ...current, dumpsterUnitCost: e.target.value },
              )
            }
            placeholder={mode === 'edit' ? '4' : '600'}
          />
        </label>
      </div>

      {mode === 'add' && (
        <label className="field-label">
          Add a note
          <textarea
            className="field-textarea"
            placeholder="30 yard, fuel, etc"
            rows={5}
            onChange={() => {}}
          />
        </label>
      )}

      <div className="ct-total-row">
        <span>Total Cost</span>
        <strong>{formatMoney(totalCost)}</strong>
      </div>

      <div className="modal-actions">
        <button type="button" className="btn btn--outline" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() =>
            onSubmit({
              jobId: form.jobId,
              crewId: form.crewId,
              date: form.date,
              laborCost: form.laborCost,
              dumpstersCount: String(mode === 'edit' ? dumpstersCount : dumpstersCount),
              dumpsterUnitCost: String(dumpsterUnitCost),
            })
          }
        >
          {mode === 'edit' ? 'Update Entry' : 'Add Entry'}
        </button>
      </div>
    </Modal>
  )
}

export default function CostTracking() {
  const [isPhone, setIsPhone] = useState(() => window.innerWidth <= 720)
  const [tab, setTab] = useState<ViewMode>('jobs')
  const [range, setRange] = useState<RangeMode>('Custom Range')
  const [search, setSearch] = useState('')
  const [jobFilter, setJobFilter] = useState<string | null>(null)
  const [crewFilter, setCrewFilter] = useState<string | null>(null)
  const [modalMode, setModalMode] = useState<ModalMode>('none')
  const [activeRecord, setActiveRecord] = useState<JobCostRow | CrewCostRow | undefined>()
  const [jobs, setJobs] = useState<Job[]>(makeCostJobs)
  const [jobRows, setJobRows] = useState<JobCostRow[]>(makeJobRows)
  const [crewRows, setCrewRows] = useState<CrewCostRow[]>(makeCrewRows)
  const [crewOptions, setCrewOptions] = useState(crewMenuOptions)
  const [startDate, setStartDate] = useState('2026-01-20')
  const [endDate, setEndDate] = useState('2026-01-21')
  const [metaVisible, setMetaVisible] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [actionMenuOpen, setActionMenuOpen] = useState(false)
  const [actionMenuPlacement, setActionMenuPlacement] = useState<'up' | 'down'>('up')
  const [showCreateJob, setShowCreateJob] = useState(false)
  const [showCreateCrew, setShowCreateCrew] = useState(false)
  const [zoom, setZoom] = useState(1)
  const tableWrapRef = useRef<HTMLDivElement>(null)
  useClickDragScroll(tableWrapRef)
  const [jobFlow, setJobFlow] = useState<JobFlow>({ type: 'none' })
  const [jobNotes, setJobNotes] = useState<Record<string, string>>({
    '#001': 'Coordinate with suppliers and schedule weekly progress meetings.',
  })
  const [jobCrews, setJobCrews] = useState<Record<string, UnassignedCrew | null>>({
    '#001': { id: 'hank', name: "Hank's Crew", leadName: 'Hank Williams', rate: 25, avatar: assignableCrews.find((c) => c.id === 'hank')?.avatar },
  })

  const detailsRow =
    jobFlow.type !== 'none' ? jobRows.find((row) => row.jobId === jobFlow.jobId || row.id === jobFlow.jobId) : undefined
  const detailsJob = detailsRow ? toDetailsJob(detailsRow, jobs) : undefined
  const detailsCrew = detailsRow ? (jobCrews[detailsRow.jobId] ?? jobCrews[detailsRow.id] ?? null) : null
  const detailsNote = detailsRow ? (jobNotes[detailsRow.jobId] ?? jobNotes[detailsRow.id] ?? '') : ''

  function openJobDetails(row: JobCostRow) {
    setJobFlow({ type: 'details', jobId: row.jobId })
  }

  function toggleActionMenu(button: HTMLButtonElement) {
    if (actionMenuOpen) {
      setActionMenuOpen(false)
      return
    }

    const rect = button.getBoundingClientRect()
    const estimatedMenuHeight = 190
    const spaceAbove = rect.top
    const spaceBelow = window.innerHeight - rect.bottom
    setActionMenuPlacement(spaceAbove >= estimatedMenuHeight || spaceAbove > spaceBelow ? 'up' : 'down')
    setActionMenuOpen(true)
  }

  const jobFilterOptions = useMemo(
    () => jobs.map((job) => ({ id: job.id, label: job.name })),
    [jobs],
  )
  const crewFilterOptions = useMemo(
    () => crewOptions.map((crew) => ({ id: crew.id, label: crew.label, color: crew.color, avatar: crew.avatar, avatarName: crew.avatarName })),
    [crewOptions],
  )

  const filteredJobRows = useMemo(() => {
    return jobRows.filter((row) => {
      const matchesSearch = !search || row.jobName.toLowerCase().includes(search.toLowerCase()) || row.id.includes(search)
      const matchesFilter = !jobFilter || row.jobId === jobFilter
      return matchesSearch && matchesFilter
    })
  }, [jobRows, search, jobFilter])

  const filteredCrewRows = useMemo(() => {
    return crewRows.filter((row) => {
      const matchesSearch = !search || row.crewName.toLowerCase().includes(search.toLowerCase()) || row.crewId.includes(search)
      const matchesFilter = !crewFilter || row.crewId === crewFilter
      return matchesSearch && matchesFilter
    })
  }, [crewRows, search, crewFilter])

  const weekDays = useMemo(() => {
    const weekStart = getMonday(parseIsoDate(startDate))
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  }, [startDate])

  useEffect(() => {
    function handleResize() {
      setIsPhone(window.innerWidth <= 720)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  function toggleMeta() {
    setMetaVisible((current) => {
      const next = !current
      if (next) setSidebarCollapsed(true)
      return next
    })
  }

  function openAddModal() {
    setActiveRecord(undefined)
    setModalMode('add')
  }

  function openEditModal(record: JobCostRow | CrewCostRow) {
    setActiveRecord(record)
    setModalMode('edit')
  }

  function closeModal() {
    setModalMode('none')
    setActiveRecord(undefined)
  }

  function handleSubmit(form: CostRecordForm) {
    if (tab === 'jobs') {
      const job = jobs.find((item) => item.id === form.jobId) ?? jobs[0]
      const laborCost = Number(form.laborCost) || 0
      const dumpstersCount = Number(form.dumpstersCount) || 0
      const dumpsterUnitCost = Number(form.dumpsterUnitCost) || 0
      const baseRow = activeRecord && 'jobId' in activeRecord ? activeRecord : undefined
      const budgetTotal = baseRow?.laborBudgetTotal ?? job?.laborBudgetTotal ?? laborCost
      const nextRow: JobCostRow = {
        id: baseRow
          ? baseRow.id
          : `#${String(
              Math.max(0, ...jobRows.map((row) => Number(row.id.replace(/\D/g, '')) || 0)) + 1,
            ).padStart(3, '0')}`,
        jobId: job?.id ?? form.jobId ?? jobs[0]?.id ?? '',
        jobName: job?.name ?? 'New Job',
        color: job?.color ?? '#94a3b8',
        date: form.date,
        contract: baseRow?.contract ?? job?.contractAmount ?? 0,
        laborBudgetTotal: budgetTotal,
        laborBudgetUsed: laborCost,
        balanceLeft: Math.max(0, budgetTotal - laborCost),
        percentSpent: budgetTotal > 0 ? laborCost / budgetTotal : 0,
        cumulativeLaborCosts: laborCost,
        laborCost,
        dumpstersCount,
        dumpsterUnitCost,
        totalCost: laborCost + dumpstersCount * dumpsterUnitCost,
        weeklyCosts: baseRow ? baseRow.weeklyCosts : makeWeeklyCosts(laborCost),
      }
      setJobRows((list) => {
        if (modalMode === 'edit' && activeRecord && 'jobId' in activeRecord) {
          return list.map((row) => (row.id === activeRecord.id ? nextRow : row))
        }
        return [nextRow, ...list]
      })
    } else {
      const crew = initialCrewRows.find((item) => item.id === form.crewId) ?? initialCrewRows[0]
      const laborCost = Number(form.laborCost) || 0
      const dumpstersCount = Number(form.dumpstersCount) || 0
      const dumpsterUnitCost = Number(form.dumpsterUnitCost) || 0
      const totalHours = crew?.workers ?? 1
      const hourlyRate = crew?.rate ?? 0
      const nextRow: CrewCostRow = {
        id: activeRecord && 'crewId' in activeRecord ? activeRecord.id : `crew-cost-${Date.now()}`,
        crewId: crew?.crewId ?? form.crewId ?? '',
        crewName: crew?.name ?? 'New Crew',
        avatar: crew?.avatar ?? '',
        color: crew?.color ?? '#94a3b8',
        date: form.date,
        hourlyRate,
        totalHours,
        cost: laborCost,
        laborCost,
        dumpstersCount,
        dumpsterUnitCost,
        totalCost: laborCost + dumpstersCount * dumpsterUnitCost,
      }
      setCrewRows((list) => {
        if (modalMode === 'edit' && activeRecord && 'crewId' in activeRecord) {
          return list.map((row) => (row.id === activeRecord.id ? nextRow : row))
        }
        return [nextRow, ...list]
      })
    }
    closeModal()
  }

  return (
    <div className="dash">
      <Sidebar
        active="Cost Tracking"
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />

      <main className="dash__main ct-main" style={{ zoom }}>
        <div className="ct-topbar">
          <label className="topbar__search ct-search">
            <MagnifyingGlass size={18} weight="regular" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search anything..." />
          </label>

          <div className="ct-topbar__actions">
            <ZoomControl
              zoom={zoom}
              onZoomIn={() => setZoom((z) => Math.min(1.5, +(z + 0.05).toFixed(2)))}
              onZoomOut={() => setZoom((z) => Math.max(0.75, +(z - 0.05).toFixed(2)))}
            />
            <button type="button" className="icon-btn icon-btn--bordered" aria-label="Notifications">
              <Icon.Bell />
              <i className="dot-badge" />
            </button>
            <div className="ct-new-action">
              <button
                type="button"
                className="btn btn--primary"
                onClick={(e) => toggleActionMenu(e.currentTarget)}
              >
                <Plus size={16} weight="bold" />
                New Action
              </button>
              {actionMenuOpen && (
                <div className={`ct-new-action__menu ct-new-action__menu--${actionMenuPlacement}`}>
                  <NewActionMenu
                    onClose={() => setActionMenuOpen(false)}
                    onAddJob={() => {
                      setActionMenuOpen(false)
                      setShowCreateJob(true)
                    }}
                    onCreateCrew={() => {
                      setActionMenuOpen(false)
                      setShowCreateCrew(true)
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="ct-head-row">
          <div>
            <h1 className="dash__title">Cost Tracking</h1>
            <p className="dash__subtitle">Labor and dumpster cost analysis</p>
          </div>
          <button type="button" className="btn btn--outline ct-export-btn">
            Export
          </button>
        </div>

        <div className="ct-toolbar">
          <div className="ct-dd ct-dd--range">
            <Dropdown
              value={range}
              options={RANGE_OPTIONS.map((option) => ({ id: option.id, label: option.label }))}
              selectedLabel={range}
              onChange={(id) => setRange(id as RangeMode)}
              placeholder="Custom Range"
            />
          </div>

          {tab === 'jobs' && (
            <>
              <DateField value={startDate} onChange={setStartDate} className="ct-range-date" />
              <span className="ct-range-sep">TO</span>
              <DateField value={endDate} onChange={setEndDate} className="ct-range-date" />
            </>
          )}

          <label className="ct-search-inline">
            <MagnifyingGlass size={16} weight="regular" />
            <input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>

          <div className="ct-view-toggle">
            <button type="button" className={tab === 'jobs' ? 'is-active' : ''} onClick={() => setTab('jobs')}>
              Jobs
            </button>
            <button type="button" className={tab === 'crew' ? 'is-active' : ''} onClick={() => setTab('crew')}>
              Crew
            </button>
          </div>

          <div className="ct-toolbar__end">
            <div className="ct-dd ct-dd--filter">
              {tab === 'jobs' ? (
                <MenuDropdown
                  options={jobFilterOptions}
                  value={jobFilter}
                  onChange={setJobFilter}
                  placeholder="All Jobs"
                  includeAll
                  allLabel="All Jobs"
                  showDot={false}
                  align="right"
                />
              ) : (
                <MenuDropdown
                  options={crewFilterOptions}
                  value={crewFilter}
                  onChange={setCrewFilter}
                  placeholder="All Crews"
                  includeAll
                  allLabel="All Crews"
                  showAvatar
                  showDot
                />
              )}
            </div>

            <button type="button" className="btn btn--primary ct-add-btn" onClick={openAddModal}>
              <Plus size={16} weight="bold" />
              Add Entry
            </button>
          </div>
        </div>

        <div className="stat-grid ct-stats-grid">
          <div className="stat-card">
            <div className="stat-card__head">
              <span className="stat-card__label">Total Labor</span>
              <Icon.ChevronRight width={14} height={14} />
            </div>
            <div className="stat-card__value">{formatMoney(97605)}</div>
            <div className="stat-card__sub">Last Month: $135,231</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__head">
              <span className="stat-card__label">Total Dumpster Cost</span>
              <Icon.ChevronRight width={14} height={14} />
            </div>
            <div className="stat-card__value">{formatMoney(7695)}</div>
            <div className="stat-card__sub">Last Month: $6,983</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__head">
              <span className="stat-card__label">Total Hours</span>
              <Icon.ChevronRight width={14} height={14} />
            </div>
            <div className="stat-card__value">1,023 hrs</div>
            <div className="stat-card__sub">Among 12 crews</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__head">
              <span className="stat-card__label">Total Entries</span>
              <Icon.ChevronRight width={14} height={14} />
            </div>
            <div className="stat-card__value">104</div>
            <div className="stat-card__sub">Among 12 crews</div>
          </div>
        </div>

        <div className="ct-table-wrap" ref={tableWrapRef}>
          {tab === 'jobs' ? (
            <table className={`ct-table ct-table--grid${metaVisible ? ' ct-table--meta' : ''}`}>
              <colgroup>
                <col style={{ width: isPhone ? '56px' : '72px' }} />
                <col style={{ width: isPhone ? '180px' : '240px' }} />
                {metaVisible && <col style={{ width: isPhone ? '92px' : '120px' }} />}
                {metaVisible && <col style={{ width: isPhone ? '104px' : '140px' }} />}
                {metaVisible && <col style={{ width: isPhone ? '96px' : '130px' }} />}
                {metaVisible && <col style={{ width: isPhone ? '104px' : '120px' }} />}
                {metaVisible && <col style={{ width: isPhone ? '104px' : '130px' }} />}
                {metaVisible && <col style={{ width: isPhone ? '72px' : '90px' }} />}
                <col className="ct-grid-divider-col" style={{ width: isPhone ? '8px' : '10px' }} />
                {weekDays.map((day) => (
                  <col key={day.toISOString()} style={{ width: isPhone ? '92px' : '140px' }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th>Job #</th>
                  <th>Job</th>
                  {metaVisible && <th>Total Contract</th>}
                  {metaVisible && <th>Labor Budget per Proposal</th>}
                  {metaVisible && <th>Balance Left To Spend</th>}
                  {metaVisible && <th>Percent of Labor Budget Spent</th>}
                  {metaVisible && <th>Cumulative Labor Costs</th>}
                  {metaVisible && <th>Dumpsters Count</th>}
                  <th className="ct-grid-divider" />
                  {weekDays.map((day, index) => (
                    <th key={day.toISOString()} className={index === 2 ? 'is-today' : ''}>
                      <div className="ct-grid-day-head">
                        {index === 2 ? <span className="ct-grid-day-head__today">Today, {WEEKDAY_SHORT[day.getDay()]}</span> : WEEKDAY_SHORT[day.getDay()]}
                        <span>{formatGridDate(day)}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredJobRows.map((row, rowIndex) => (
                  <tr key={row.id}>
                    <td className="ct-id-cell">
                      {row.id.replace(/^#/, '')}
                    </td>
                    <td className="ct-job-cell">
                      <span className="ct-job-bar" style={{ background: row.color }} />
                      <button type="button" className="ct-name-cell" onClick={() => openJobDetails(row)}>
                        <span className="ct-job-title" title={row.jobName}>
                          {row.jobName}
                        </span>
                        <span className="ct-name-cell__chevron" aria-hidden>
                          <Icon.ChevronRight width={16} height={16} />
                        </span>
                      </button>
                    </td>
                    {metaVisible && <td className="ct-money">{formatMoney(row.contract)}</td>}
                    {metaVisible && <td>{formatMoney(row.laborBudgetTotal)}</td>}
                    {metaVisible && <td>{formatMoney(row.balanceLeft)}</td>}
                    {metaVisible && <td>{`${(row.percentSpent * 100).toFixed(1)}%`}</td>}
                    {metaVisible && <td>{formatMoney(row.cumulativeLaborCosts)}</td>}
                    {metaVisible && <td>{row.dumpstersCount}</td>}
                    <td className="ct-grid-divider">
                      <div className="ct-grid-divider__inner">
                        <button
                          type="button"
                          className={`ct-grid-divider__toggle${metaVisible ? ' is-open' : ''}${
                            rowIndex === Math.floor((filteredJobRows.length - 1) / 2) ? ' is-visible' : ''
                          }`}
                          onClick={toggleMeta}
                          aria-label={metaVisible ? 'Hide details columns' : 'Show details columns'}
                        >
                          <span className="ct-grid-divider__dots" aria-hidden>
                            <i /><i /><i />
                          </span>
                          <span className="ct-grid-divider__arrow" aria-hidden>
                            {metaVisible ? (
                              <Icon.ArrowLeft width={14} height={14} />
                            ) : (
                              <Icon.ArrowRight width={14} height={14} />
                            )}
                          </span>
                        </button>
                      </div>
                    </td>
                    {weekDays.map((day, index) => {
                      const value = row.weeklyCosts[index]
                      return (
                        <td key={day.toISOString()} className="ct-grid-cell">
                          {value != null ? (
                            <button type="button" className="ct-grid-cell__value" onClick={() => openEditModal(row)}>
                              {formatMoney(value)}
                            </button>
                          ) : null}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="ct-table ct-table--crew">
              <thead>
                <tr>
                  <th className="ct-col-check">
                    <input type="checkbox" />
                  </th>
                  <th>Crew ID</th>
                  <th>Crew Name</th>
                  <th>Date</th>
                  <th>Hourly Rate ($)</th>
                  <th>Total Hours</th>
                  <th>Cost</th>
                  <th className="ct-col-action">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCrewRows.map((row) => (
                  <tr key={row.id}>
                    <td className="ct-col-check">
                      <input type="checkbox" />
                    </td>
                    <td className="ct-id-cell">#{row.crewId}</td>
                    <td className="ct-crew-name-cell">
                      <span className="ct-crew-name-bar" style={{ background: row.color }} />
                      <div className="ct-crew-cell">
                        <img src={row.avatar} alt="" className="ct-crew-cell__avatar" />
                        <span>{row.crewName}</span>
                      </div>
                    </td>
                    <td>{formatCrewDate(row.date)}</td>
                    <td>{row.hourlyRate}</td>
                    <td>{row.totalHours}</td>
                    <td>{formatMoney(row.cost)}</td>
                    <td className="ct-col-action">
                      <button type="button" className="ct-action-btn" onClick={() => openEditModal(row)} aria-label="Edit accumulated cost">
                        <Icon.Edit width={15} height={15} />
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
        <CostModal
          mode={modalMode}
          scope={tab}
          jobs={jobs}
          jobRows={jobRows}
          crews={crewOptions}
          record={activeRecord}
          onCancel={closeModal}
          onSubmit={handleSubmit}
        />
      )}

      {jobFlow.type === 'details' && detailsJob && (
        <JobDetailsModal
          job={detailsJob}
          crew={detailsCrew}
          note={detailsNote}
          onDone={() => setJobFlow({ type: 'none' })}
          onChangeCrew={() => setJobFlow({ type: 'assignCrew', jobId: detailsJob.id })}
          onRemoveCrew={() => {
            setJobCrews((prev) => ({ ...prev, [detailsJob.id]: null }))
            setJobFlow({ type: 'none' })
          }}
        />
      )}

      {jobFlow.type === 'assignCrew' && detailsJob && (
        <AssignCrewModal
          job={detailsJob}
          onCancel={() => setJobFlow({ type: 'details', jobId: detailsJob.id })}
          onAssign={(crewId, note) => {
            const crew = assignableCrews.find((c) => c.id === crewId)
            if (!crew) return
            setJobCrews((prev) => ({
              ...prev,
              [detailsJob.id]: {
                id: crew.id,
                name: crew.name,
                leadName: crew.leadName,
                rate: crew.rate,
                avatar: crew.avatar,
              },
            }))
            if (note) {
              setJobNotes((prev) => ({ ...prev, [detailsJob.id]: note }))
            }
            setJobRows((list) =>
              list.map((row) => (row.jobId === detailsJob.id || row.id === detailsJob.id ? { ...row, color: crew.color } : row)),
            )
            setJobFlow({ type: 'details', jobId: detailsJob.id })
          }}
        />
      )}

      {showCreateJob && (
        <CreateJobModal
          presetJobs={jobs}
          onCancel={() => setShowCreateJob(false)}
          onSubmit={(data: JobFormData) => {
            const selectedLead = crewLeads.find((lead) => lead.id === data.crewLeadId)
            const nextIndex = jobs.length + 1
            const nextId = `#${String(
              Math.max(0, ...jobRows.map((row) => Number(row.id.replace(/\D/g, '')) || 0)) + 1,
            ).padStart(3, '0')}`
            const nextJob: Job = {
              id: nextId,
              name: data.name,
              color: data.color,
              bidNo: String(1000 + Number(nextId.replace(/\D/g, '') || nextIndex)),
              jobNo: nextId.replace(/^#/, ''),
              gc: data.gc,
              estimator: selectedLead?.name ?? 'TBD',
              startDate: data.startDate,
              endDate: data.endDate,
              contractAmount: data.contractAmount,
              laborBudgetUsed: 0,
              laborBudgetTotal: data.laborBudgetTotal,
            }
            const laborCost = 0
            const dumpstersCount = 1
            const dumpsterUnitCost = 500
            setJobs((list) => [...list, nextJob])
            setJobRows((list) => [
              {
                id: nextId,
                jobId: nextId,
                jobName: nextJob.name,
                color: nextJob.color,
                date: nextJob.startDate,
                contract: nextJob.contractAmount,
                laborBudgetTotal: nextJob.laborBudgetTotal,
                laborBudgetUsed: laborCost,
                balanceLeft: nextJob.laborBudgetTotal,
                percentSpent: 0,
                cumulativeLaborCosts: laborCost,
                laborCost,
                dumpstersCount,
                dumpsterUnitCost,
                totalCost: dumpstersCount * dumpsterUnitCost,
                weeklyCosts: makeWeeklyCosts(laborCost),
              },
              ...list,
            ])
            setShowCreateJob(false)
          }}
        />
      )}

      {showCreateCrew && (
        <CreateCrewModal
          jobs={jobs}
          onCancel={() => setShowCreateCrew(false)}
          onSubmit={(data: CrewFormData) => {
            const selectedLead = crewLeads.find((lead) => lead.id === data.crewLeadId)
            const selectedColor = data.color
            const totalHours = Math.max(1, data.laborNames.length) * 11
            const hourlyRate = selectedLead?.rate ?? 0
            const laborCost = totalHours * hourlyRate
            const dumpstersCount = Math.max(1, (data.laborNames.length % 3) + 1)
            const dumpsterUnitCost = 450
            const newCrewOption = {
              id: `c${Date.now()}`,
              label: data.crewName,
              color: selectedColor,
              avatar: selectedLead?.avatar ?? `https://i.pravatar.cc/64?img=${Math.floor(Math.random() * 70)}`,
              avatarName: selectedLead?.name ?? data.crewName,
            }
            setCrewOptions((list) => [...list, newCrewOption])
            setCrewRows((list) => [
              ...list,
              {
                id: `c-${Date.now()}`,
                crewId: String(Math.floor(1000 + Math.random() * 9000)),
                crewName: data.crewName,
                avatar: `https://i.pravatar.cc/64?img=${Math.floor(Math.random() * 70)}`,
                color: selectedColor,
                date: formatToolbarDate(new Date()),
                hourlyRate,
                totalHours,
                cost: laborCost,
                laborCost,
                dumpstersCount,
                dumpsterUnitCost,
                totalCost: laborCost + dumpstersCount * dumpsterUnitCost,
              },
            ])
            setShowCreateCrew(false)
          }}
        />
      )}
    </div>
  )
}
