import { useEffect, useMemo, useRef, useState } from 'react'
import { MagnifyingGlass, Plus, CalendarBlank } from '@phosphor-icons/react'
import Sidebar from '../components/dashboard/Sidebar'
import Modal from '../components/dashboard/Modal'
import Dropdown from '../components/dashboard/Dropdown'
import MenuDropdown from '../components/dashboard/MenuDropdown'
import JobDetailsModal from '../components/dashboard/JobDetailsModal'
import AssignCrewModal from '../components/dashboard/AssignCrewModal'
import ZoomControl from '../components/dashboard/ZoomControl'
import { Icon } from '../components/dashboard/icons'
import { crewRows as initialCrewRows, crewMenuOptions } from '../lib/crewData'
import { useClickDragScroll } from '../hooks/useClickDragScroll'
import { useSidebarCollapsed } from '../hooks/useSidebarCollapsed'
import { SHEET_ZOOM_DEFAULT, sheetZoomStyle, stepSheetZoom } from '../lib/sheetZoom'
import { AddDailyDumpsterCountModal } from '../components/dashboard/CostTrackingModals'
import {
  getCostTrackingReport,
  type CostTrackingReportData,
  type CostTrackingReportParams,
} from '../api/dumpsterCostApi'
import {
  assignableCrews,
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
  /** ISO start date of the job. */
  date: string
  /** ISO end date of the job — a row shows whenever it overlaps the range. */
  endDate: string
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
  dailyCosts?: Record<string, number | null>
}

type CrewCostRow = {
  id: string
  /** Crew identity as used by crewMenuOptions (`c8742`) — what the filter matches on. */
  crewKey: string
  /** Display-only crew number (`8742`), shown as #8742 in the ID column. */
  crewId: string
  crewName: string
  avatar: string
  color: string
  /** ISO date shown in the Date column. */
  date: string
  /** ISO dates of every job the crew worked — used to match the range. */
  jobDates: string[]
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

const MONTH_OPTIONS = [
  { id: '1', label: 'January' },
  { id: '2', label: 'February' },
  { id: '3', label: 'March' },
  { id: '4', label: 'April' },
  { id: '5', label: 'May' },
  { id: '6', label: 'June' },
  { id: '7', label: 'July' },
  { id: '8', label: 'August' },
  { id: '9', label: 'September' },
  { id: '10', label: 'October' },
  { id: '11', label: 'November' },
  { id: '12', label: 'December' },
]

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Parses `YYYY-MM-DD` (the format every date input and every row date uses). */
function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** Job data stores dates day-first (`30-07-2026`). */
function dmyToIso(value: string) {
  const [day, month, year] = value.split('-')
  if (!day || !month || !year) return value
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

/** Crew data stores dates month-first (`07-14-2026`). */
function mdyToIso(value: string) {
  const [month, day, year] = value.split('-')
  if (!month || !day || !year) return value
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
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

/** ISO row date -> `MM-DD-YYYY` for display in the crew table. */
function formatCrewDate(value: string) {
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
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

function toISO(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getDeterministicDailyCost(laborCost: number, dateString: string, jobId: string) {
  const d = parseIsoDate(dateString)
  const dayOfWeek = d.getDay()
  if (dayOfWeek === 0) return null // Sunday no work
  const idNum = Number(jobId.replace(/\D/g, '')) || 1
  if (dayOfWeek === 6 && (idNum % 2 === 0)) return null // Saturday off for some
  const dayNum = d.getDate()
  const factor = 0.03 + ((dayNum * 7 + idNum * 13) % 8) * 0.015
  return Math.round(laborCost * factor)
}

/** Inclusive ISO bounds of the selected range; `null` = no date filtering. */
function getRangeBounds(range: RangeMode, startDate: string, endDate: string): [string, string] | null {
  if (range === 'All Time') return null

  const start = parseIsoDate(startDate)
  if (range === 'Weekly') {
    const weekStart = getMonday(start)
    return [toISO(weekStart), toISO(addDays(weekStart, 6))]
  }
  if (range === 'Monthly') {
    const year = start.getFullYear()
    const month = start.getMonth()
    return [toISO(new Date(year, month, 1)), toISO(new Date(year, month + 1, 0))]
  }

  const end = parseIsoDate(endDate)
  return start <= end ? [toISO(start), toISO(end)] : [toISO(end), toISO(start)]
}

const EARLIEST_JOB_ISO =
  initialManagedJobs.map((job) => dmyToIso(job.startDate)).sort()[0] ?? toISO(new Date())

/** Open on the month the earliest job starts in, so the grid never lands on an empty window. */
const DEFAULT_RANGE = (() => {
  const anchor = parseIsoDate(EARLIEST_JOB_ISO)
  return {
    start: toISO(new Date(anchor.getFullYear(), anchor.getMonth(), 1)),
    end: toISO(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)),
  }
})()

function makeJobRows(): JobCostRow[] {
  return initialManagedJobs.map((job, index) => {
    const dumpstersCount = 1 + (index % 3)
    const dumpsterUnitCost = 500 + index * 25
    const laborCost = job.laborBudgetUsed
    const balanceLeft = Math.max(0, job.laborBudgetTotal - job.laborBudgetUsed)
    const percentSpent = job.laborBudgetTotal > 0 ? job.laborBudgetUsed / job.laborBudgetTotal : 0
    const startIso = dmyToIso(job.startDate)
    const endIso = dmyToIso(job.endDate)

    const dailyCosts: Record<string, number | null> = {}
    const baseDate = parseIsoDate(startIso)
    for (let i = 0; i < 90; i++) {
      const currentDay = addDays(baseDate, i)
      const dayStr = toISO(currentDay)
      dailyCosts[dayStr] = getDeterministicDailyCost(laborCost, dayStr, job.id)
    }

    return {
      id: job.id,
      jobId: job.id,
      jobName: job.name,
      color: job.color,
      date: startIso,
      endDate: endIso,
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
      dailyCosts,
    }
  })
}

function makeCrewRows(): CrewCostRow[] {
  return initialCrewRows.map((crew, index) => {
    const totalHours = crew.workers * 11 + index * 3
    const laborCost = totalHours * crew.rate
    const dumpstersCount = Math.max(1, (crew.laborNames.length % 3) + 1)
    const dumpsterUnitCost = 450 + index * 30
    const jobDates = crew.jobs.map((job) => mdyToIso(job.date)).sort()
    return {
      id: crew.id,
      crewKey: crew.id,
      crewId: crew.crewId,
      crewName: crew.name,
      avatar: crew.avatar,
      color: crew.color,
      date: jobDates[0] ?? toISO(new Date()),
      jobDates,
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
  selectedDate,
  onCancel,
  onSubmit,
}: {
  mode: 'add' | 'edit'
  scope: ViewMode
  jobs: Job[]
  jobRows: JobCostRow[]
  crews: typeof crewMenuOptions
  record?: JobCostRow | CrewCostRow
  selectedDate?: string | null
  onCancel: () => void
  onSubmit: (form: CostRecordForm) => void
}) {
  const isCrewScope = scope === 'crew'
  const initialJobId = record && 'jobId' in record ? record.jobId : null
  // The dropdown is keyed on crewMenuOptions ids, so seed it from crewKey — not
  // the display number in crewId.
  const initialCrewId = record && 'crewKey' in record ? record.crewKey : null
  const [form, setForm] = useState<CostRecordForm>(() => {
    const jobId = !isCrewScope ? initialJobId ?? jobs[0]?.id ?? null : jobs[0]?.id ?? null
    const existing = jobId ? jobRows.find((row) => row.jobId === jobId || row.id === jobId) : undefined
    const job = jobId ? jobs.find((item) => item.id === jobId) : undefined

    let initialLaborCost = String(record?.laborCost ?? existing?.laborCost ?? job?.laborBudgetUsed ?? 0)
    if (selectedDate && record && 'dailyCosts' in record) {
      const dailyCosts = (record as JobCostRow).dailyCosts
      const dayVal = dailyCosts && dailyCosts[selectedDate] !== undefined
        ? dailyCosts[selectedDate]
        : getDeterministicDailyCost((record as JobCostRow).laborCost, selectedDate, record.jobId)
      initialLaborCost = String(dayVal ?? 0)
    }

    return {
      jobId,
      crewId: isCrewScope ? initialCrewId ?? crews[0]?.id ?? null : crews[0]?.id ?? null,
      date: selectedDate ?? record?.date ?? new Date().toISOString().slice(0, 10),
      laborCost: initialLaborCost,
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
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [extraDays, setExtraDays] = useState(0)
  const [jobs] = useState<Job[]>(makeCostJobs)
  const [jobRows, setJobRows] = useState<JobCostRow[]>(makeJobRows)
  const [crewRows, setCrewRows] = useState<CrewCostRow[]>(makeCrewRows)
  const [crewOptions] = useState(crewMenuOptions)
  const [startDate, setStartDate] = useState(DEFAULT_RANGE.start)
  const [endDate, setEndDate] = useState(DEFAULT_RANGE.end)

  const [reportData, setReportData] = useState<CostTrackingReportData | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [reportError, setReportError] = useState<string>('')
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    let isMounted = true

    async function fetchReport() {
      setLoadingReport(true)
      setReportError('')

      let dateFilterParam: 'allTime' | 'custom' | 'weekly' | 'monthly' = 'allTime'
      if (range === 'Weekly') dateFilterParam = 'weekly'
      else if (range === 'Monthly') dateFilterParam = 'monthly'
      else if (range === 'Custom Range') dateFilterParam = 'custom'

      const params: CostTrackingReportParams = {
        dateFilter: dateFilterParam,
        groupBy: tab === 'jobs' ? 'jobs' : 'crews',
        limit: 100,
      }

      if (dateFilterParam === 'custom') {
        params.dateFrom = startDate
        params.dateTo = endDate
      } else if (dateFilterParam === 'weekly' || dateFilterParam === 'monthly') {
        params.startDate = startDate
      }

      if (search.trim()) {
        params.search = search.trim()
      }

      if (tab === 'jobs' && jobFilter) {
        params.jobId = jobFilter
      } else if (tab === 'crew' && crewFilter) {
        params.crewId = crewFilter
      }

      try {
        const response = await getCostTrackingReport(params)
        if (isMounted && response.success) {
          setReportData(response.data)

          if (params.groupBy === 'jobs') {
            const mappedJobRows: JobCostRow[] = response.data.groups.map((grp, index) => {
              const dailyCosts: Record<string, number | null> = {}
              grp.costByDate.forEach((c) => {
                dailyCosts[c.date] = c.totalCost
              })

              const jobIdStr = grp.jobId ?? `job-${index}`
              const idNumStr = grp.jobIdNumber ? String(grp.jobIdNumber).padStart(3, '0') : String(index + 1).padStart(3, '0')

              return {
                id: `#${idNumStr}`,
                jobId: jobIdStr,
                jobName: grp.jobName || 'Unnamed Job',
                color: assignableCrews[index % assignableCrews.length]?.color ?? '#94a3b8',
                date: grp.costByDate[0]?.date || new Date().toISOString().slice(0, 10),
                endDate: grp.costByDate[grp.costByDate.length - 1]?.date || new Date().toISOString().slice(0, 10),
                contract: 0,
                laborBudgetTotal: 0,
                laborBudgetUsed: grp.totalLaborCost,
                balanceLeft: 0,
                percentSpent: 0,
                cumulativeLaborCosts: grp.totalLaborCost,
                laborCost: grp.totalLaborCost,
                dumpstersCount: 0,
                dumpsterUnitCost: 0,
                totalCost: grp.totalLaborCost + grp.totalDumpsterCost,
                weeklyCosts: [],
                dailyCosts,
              }
            })
            setJobRows(mappedJobRows)
          } else {
            const mappedCrewRows: CrewCostRow[] = response.data.groups.map((grp, index) => {
              const dates = grp.costByDate.map((c) => c.date)
              const crewKey = grp.crewId ?? `crew-${index}`
              const crewDisplayId = grp.crewId ? grp.crewId.slice(-4) : String(8742 + index)

              return {
                id: crewKey,
                crewKey,
                crewId: crewDisplayId,
                crewName: grp.crewName || 'Unnamed Crew',
                avatar: assignableCrews[index % assignableCrews.length]?.avatar || '',
                color: assignableCrews[index % assignableCrews.length]?.color || '#94a3b8',
                date: dates[0] || new Date().toISOString().slice(0, 10),
                jobDates: dates,
                hourlyRate: grp.hourlyRate ?? 0,
                totalHours: grp.totalHoursWorked,
                cost: grp.totalLaborCost,
                laborCost: grp.totalLaborCost,
                dumpstersCount: 0,
                dumpsterUnitCost: 0,
                totalCost: grp.totalLaborCost,
              }
            })
            setCrewRows(mappedCrewRows)
          }
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Failed to fetch cost tracking report:', err)
          setReportError(err.response?.data?.message || err.message || 'Failed to load report data.')
        }
      } finally {
        if (isMounted) setLoadingReport(false)
      }
    }

    fetchReport()

    return () => {
      isMounted = false
    }
  }, [range, startDate, endDate, tab, search, jobFilter, crewFilter, refreshTrigger])

  const [prevRange, setPrevRange] = useState(range)
  const [prevStart, setPrevStart] = useState(startDate)
  const [prevEnd, setPrevEnd] = useState(endDate)

  if (range !== prevRange || startDate !== prevStart || endDate !== prevEnd) {
    setPrevRange(range)
    setPrevStart(startDate)
    setPrevEnd(endDate)
    setExtraDays(0)
  }
  const [metaVisible, setMetaVisible] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed()
  const [zoom, setZoom] = useState(SHEET_ZOOM_DEFAULT)
  const tableWrapRef = useRef<HTMLDivElement>(null)
  useClickDragScroll(tableWrapRef)
  const [jobFlow, setJobFlow] = useState<JobFlow>({ type: 'none' })
  const [crewHover, setCrewHover] = useState<{ x: number; y: number; color: string; names: string[] } | null>(null)
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

  const jobFilterOptions = useMemo(
    () => jobs.map((job) => ({ id: job.id, label: job.name })),
    [jobs],
  )
  const crewFilterOptions = useMemo(
    () => crewOptions.map((crew) => ({ id: crew.id, label: crew.label, color: crew.color, avatar: crew.avatar, avatarName: crew.avatarName })),
    [crewOptions],
  )

  const filteredJobRows = jobRows
  const filteredCrewRows = crewRows

  useEffect(() => {
    const el = tableWrapRef.current
    if (!el) return

    function handleScroll() {
      if (!el) return
      if (el.scrollWidth - el.scrollLeft - el.clientWidth < 100) {
        if (range === 'All Time') {
          setExtraDays((prev) => prev + 7)
        }
      }
    }

    el.addEventListener('scroll', handleScroll)
    return () => {
      if (el) {
        el.removeEventListener('scroll', handleScroll)
      }
    }
  }, [range])

  const weekDays = useMemo(() => {
    const start = parseIsoDate(startDate)
    let baseDays: Date[]

    if (range === 'Weekly') {
      const weekStart = getMonday(start)
      baseDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
    } else if (range === 'Monthly') {
      const year = start.getFullYear()
      const month = start.getMonth()
      const numDays = new Date(year, month + 1, 0).getDate()
      baseDays = Array.from({ length: numDays }, (_, index) => new Date(year, month, index + 1))
    } else if (range === 'All Time') {
      const startAll = parseIsoDate(EARLIEST_JOB_ISO)
      baseDays = Array.from({ length: 60 }, (_, index) => addDays(startAll, index))
    } else {
      const end = parseIsoDate(endDate)
      const diffTime = end.getTime() - start.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
      const count = Math.min(Math.max(1, diffDays), 90)
      baseDays = Array.from({ length: count }, (_, index) => addDays(start, index))
    }

    if (extraDays > 0) {
      const lastDay = baseDays[baseDays.length - 1]
      const extra = Array.from({ length: extraDays }, (_, index) => addDays(lastDay, index + 1))
      return [...baseDays, ...extra]
    }

    return baseDays
  }, [range, startDate, endDate, extraDays])

  const dayColWidth = useMemo(() => {
    if (range === 'Monthly' || range === 'All Time' || (range === 'Custom Range' && weekDays.length > 7)) {
      return isPhone ? 64 : 96
    }
    return isPhone ? 92 : 140
  }, [range, isPhone, weekDays.length])

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

  const isTableEmpty = (tab === 'jobs' ? filteredJobRows : filteredCrewRows).length === 0
  const hasActiveFilters = Boolean(search.trim()) || Boolean(tab === 'jobs' ? jobFilter : crewFilter)
  const rangeBounds = getRangeBounds(range, startDate, endDate)
  const rangeLabel = rangeBounds
    ? `${formatToolbarDate(parseIsoDate(rangeBounds[0]))} and ${formatToolbarDate(parseIsoDate(rangeBounds[1]))}`
    : null

  function clearFilters() {
    setSearch('')
    if (tab === 'jobs') {
      setJobFilter(null)
    } else {
      setCrewFilter(null)
    }
  }

  function openAddModal() {
    setActiveRecord(undefined)
    setSelectedDate(null)
    setModalMode('add')
  }

  function openEditModal(record: JobCostRow | CrewCostRow, date?: string) {
    setActiveRecord(record)
    setSelectedDate(date ?? null)
    setModalMode('edit')
  }

  function closeModal() {
    setModalMode('none')
    setActiveRecord(undefined)
    setSelectedDate(null)
  }

  function handleSubmit(form: CostRecordForm) {
    if (tab === 'jobs') {
      const job = jobs.find((item) => item.id === form.jobId) ?? jobs[0]
      const laborCost = Number(form.laborCost) || 0
      const dumpstersCount = Number(form.dumpstersCount) || 0
      const dumpsterUnitCost = Number(form.dumpsterUnitCost) || 0
      const baseRow = activeRecord && 'jobId' in activeRecord ? activeRecord : undefined
      const budgetTotal = baseRow?.laborBudgetTotal ?? job?.laborBudgetTotal ?? laborCost

      const updatedDailyCosts = { ...(baseRow?.dailyCosts ?? {}) }
      if (selectedDate) {
        updatedDailyCosts[selectedDate] = laborCost
      } else {
        updatedDailyCosts[form.date] = laborCost
      }

      const totalLaborCost = Object.values(updatedDailyCosts).reduce((sum: number, val) => sum + (val ?? 0), 0)

      const nextRow: JobCostRow = {
        id: baseRow
          ? baseRow.id
          : `#${String(
              Math.max(0, ...jobRows.map((row) => Number(row.id.replace(/\D/g, '')) || 0)) + 1,
            ).padStart(3, '0')}`,
        jobId: job?.id ?? form.jobId ?? jobs[0]?.id ?? '',
        jobName: job?.name ?? 'New Job',
        color: job?.color ?? '#94a3b8',
        date: baseRow?.date ?? form.date,
        endDate: baseRow?.endDate ?? form.date,
        contract: baseRow?.contract ?? job?.contractAmount ?? 0,
        laborBudgetTotal: budgetTotal,
        laborBudgetUsed: totalLaborCost,
        balanceLeft: Math.max(0, budgetTotal - totalLaborCost),
        percentSpent: budgetTotal > 0 ? totalLaborCost / budgetTotal : 0,
        cumulativeLaborCosts: totalLaborCost,
        laborCost: totalLaborCost,
        dumpstersCount,
        dumpsterUnitCost,
        totalCost: totalLaborCost + dumpstersCount * dumpsterUnitCost,
        weeklyCosts: baseRow ? baseRow.weeklyCosts : makeWeeklyCosts(totalLaborCost),
        dailyCosts: updatedDailyCosts,
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
      const baseCrewRow = activeRecord && 'crewId' in activeRecord ? activeRecord : undefined
      const jobDates = Array.from(new Set([...(baseCrewRow?.jobDates ?? []), form.date])).sort()
      const nextRow: CrewCostRow = {
        id: baseCrewRow ? baseCrewRow.id : `crew-cost-${Date.now()}`,
        crewKey: crew?.id ?? form.crewId ?? '',
        crewId: crew?.crewId ?? '',
        crewName: crew?.name ?? 'New Crew',
        avatar: crew?.avatar ?? '',
        color: crew?.color ?? '#94a3b8',
        date: form.date,
        jobDates,
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

      <main className="dash__main ct-main">
        <div className="ct-topbar">
          <div className="ct-topbar__actions">
            <ZoomControl
              zoom={zoom}
              onZoomIn={() => setZoom((z) => stepSheetZoom(z, 1))}
              onZoomOut={() => setZoom((z) => stepSheetZoom(z, -1))}
            />
          </div>
        </div>

        <div className="ct-head-row">
          <div>
            <h1 className="dash__title">Cost Tracking</h1>
            <p className="dash__subtitle">Labor and dumpster cost analysis</p>
          </div>
          <div className="sb-legend">
            {assignableCrews.map((crew) => (
              <span key={crew.id} className="sb-legend__item">
                <i style={{ background: crew.color }} />
                {crew.name}
              </span>
            ))}
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

          {range !== 'All Time' && (
            <>
              <span className="ct-range-label" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)', alignSelf: 'center', marginLeft: '0.5rem' }}>
                {range === 'Weekly' ? 'Week of:' : range === 'Monthly' ? 'Month:' : 'From:'}
              </span>
              {range === 'Monthly' ? (
                <div className="ct-dd ct-dd--month" style={{ width: '140px', marginLeft: '0.5rem', display: 'inline-block' }}>
                  <Dropdown
                    value={String(parseIsoDate(startDate).getMonth() + 1)}
                    options={MONTH_OPTIONS}
                    selectedLabel={MONTH_OPTIONS.find(m => m.id === String(parseIsoDate(startDate).getMonth() + 1))?.label ?? 'January'}
                    onChange={(mId) => {
                      const newMonth = String(mId).padStart(2, '0')
                      setStartDate(`2026-${newMonth}-01`)
                    }}
                    placeholder="Select Month"
                  />
                </div>
              ) : (
                <DateField value={startDate} onChange={setStartDate} className="ct-range-date" />
              )}
              {range === 'Custom Range' && (
                <>
                  <span className="ct-range-sep">TO</span>
                  <DateField value={endDate} onChange={setEndDate} className="ct-range-date" />
                </>
              )}
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
            <div className="stat-card__value">{formatMoney(reportData?.totalLaborCost ?? 0)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__head">
              <span className="stat-card__label">Total Dumpster Cost</span>
              <Icon.ChevronRight width={14} height={14} />
            </div>
            <div className="stat-card__value">{formatMoney(reportData?.totalDumpsterCost ?? 0)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__head">
              <span className="stat-card__label">Total Hours</span>
              <Icon.ChevronRight width={14} height={14} />
            </div>
            <div className="stat-card__value">{(reportData?.totalHoursWorked ?? 0).toLocaleString()} hrs</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__head">
              <span className="stat-card__label">Total Entries</span>
              <Icon.ChevronRight width={14} height={14} />
            </div>
            <div className="stat-card__value">{(reportData?.totalEntries ?? 0).toLocaleString()}</div>
          </div>
        </div>

        {reportError && (
          <div style={{ color: '#ef4444', margin: '12px 0', fontSize: '14px' }}>
            {reportError}
          </div>
        )}

        <div className={`ct-table-wrap${isTableEmpty ? ' ct-table-wrap--empty' : ''}`} ref={tableWrapRef}>
          <div className="ct-table-zoom" style={sheetZoomStyle(zoom)}>
          {loadingReport ? (
            <div className="ct-empty" style={{ padding: '40px' }}>
              <p className="ct-empty__text">Loading cost tracking data...</p>
            </div>
          ) : isTableEmpty ? (
            <div className="ct-empty">
              <span className="ct-empty__icon" aria-hidden>
                {hasActiveFilters ? (
                  <MagnifyingGlass size={26} weight="regular" />
                ) : (
                  <CalendarBlank size={26} weight="regular" />
                )}
              </span>
              <h3 className="ct-empty__title">
                No {tab === 'jobs' ? 'jobs' : 'crews'} to show
              </h3>
              <p className="ct-empty__text">
                {hasActiveFilters
                  ? 'Nothing matches your current search and filters. Clear them to see every entry in this date range.'
                  : rangeLabel
                    ? `There are no cost entries between ${rangeLabel}. Pick a different date range to see more.`
                    : 'There are no cost entries yet. Add one to start tracking costs.'}
              </p>
              <div className="ct-empty__actions">
                {hasActiveFilters ? (
                  <button type="button" className="btn btn--outline" onClick={clearFilters}>
                    Clear filters
                  </button>
                ) : (
                  range !== 'All Time' && (
                    <button type="button" className="btn btn--outline" onClick={() => setRange('All Time')}>
                      View all time
                    </button>
                  )
                )}
                <button type="button" className="btn btn--primary" onClick={openAddModal}>
                  <Plus size={16} weight="bold" />
                  Add Entry
                </button>
              </div>
            </div>
          ) : tab === 'jobs' ? (
            <table className={`ct-table ct-table--grid${metaVisible ? ' ct-table--meta' : ''}`}>
              <colgroup>
                <col className="ct-col-id-w" />
                <col className="ct-col-job-w" />
                {metaVisible && <col style={{ width: (isPhone ? 92 : 120) * zoom }} />}
                {metaVisible && <col style={{ width: (isPhone ? 104 : 140) * zoom }} />}
                {metaVisible && <col style={{ width: (isPhone ? 96 : 130) * zoom }} />}
                {metaVisible && <col style={{ width: (isPhone ? 104 : 120) * zoom }} />}
                {metaVisible && <col style={{ width: (isPhone ? 104 : 130) * zoom }} />}
                {metaVisible && <col style={{ width: (isPhone ? 72 : 90) * zoom }} />}
                <col className="ct-grid-divider-col" style={{ width: (isPhone ? 8 : 10) * zoom }} />
                {weekDays.map((day) => (
                  <col key={day.toISOString()} style={{ width: dayColWidth * zoom }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th className="ct-sticky ct-sticky--id">Job #</th>
                  <th className="ct-sticky ct-sticky--job">Job</th>
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
                        {WEEKDAY_SHORT[day.getDay()]}
                        <span>{formatGridDate(day)}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredJobRows.map((row, rowIndex) => (
                  <tr key={row.id}>
                    <td className="ct-id-cell ct-sticky ct-sticky--id">
                      {row.id.replace(/^#/, '')}
                    </td>
                    <td className="ct-job-cell ct-sticky ct-sticky--job">
                      <span
                        className="ct-job-bar-hit"
                        onMouseEnter={(e) => {
                          const assigned = jobCrews[row.jobId] ?? jobCrews[row.id]
                          const matched = assignableCrews.find((c) => c.color === row.color)
                          const name = assigned?.name ?? matched?.name
                          if (!name) return
                          const rect = e.currentTarget.getBoundingClientRect()
                          setCrewHover({
                            x: rect.right + 8,
                            y: rect.top + rect.height / 2,
                            color: row.color,
                            names: [name],
                          })
                        }}
                        onMouseLeave={() => setCrewHover(null)}
                      >
                        <span className="ct-job-bar" style={{ background: row.color }} />
                      </span>
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
                    {weekDays.map((day) => {
                      const dayStr = toISO(day)
                      const value = row.dailyCosts ? row.dailyCosts[dayStr] : null
                      return (
                        <td key={day.toISOString()} className="ct-grid-cell">
                          {value != null ? (
                            <button type="button" className="ct-grid-cell__value" onClick={() => openEditModal(row, dayStr)}>
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
                      <span
                        className="ct-crew-name-bar-hit"
                        onMouseEnter={(e) => {
                          if (!row.crewName) return
                          const rect = e.currentTarget.getBoundingClientRect()
                          setCrewHover({
                            x: rect.right + 8,
                            y: rect.top + rect.height / 2,
                            color: row.color,
                            names: [row.crewName],
                          })
                        }}
                        onMouseLeave={() => setCrewHover(null)}
                      >
                        <span className="ct-crew-name-bar" style={{ background: row.color }} />
                      </span>
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
        </div>
      </main>

      {crewHover && (
        <div
          className="sb-jobno-tooltip sb-jobno-tooltip--fixed"
          style={{ left: crewHover.x, top: crewHover.y }}
        >
          {crewHover.names.map((name) => (
            <span key={name} className="sb-jobno-tooltip__pill" style={{ background: crewHover.color }}>
              {name}
            </span>
          ))}
        </div>
      )}

      {modalMode === 'add' && (
        <AddDailyDumpsterCountModal
          onCancel={closeModal}
          onSuccess={() => {
            setRefreshTrigger((prev) => prev + 1)
          }}
        />
      )}

      {modalMode === 'edit' && (
        <CostModal
          mode={modalMode}
          scope={tab}
          jobs={jobs}
          jobRows={jobRows}
          crews={crewOptions}
          record={activeRecord}
          selectedDate={selectedDate}
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

    </div>
  )
}
