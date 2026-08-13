import { useEffect, useMemo, useRef, useState } from 'react'
import { MagnifyingGlass, Plus, CalendarBlank } from '@phosphor-icons/react'
import Sidebar from '../components/dashboard/Sidebar'
import Dropdown from '../components/dashboard/Dropdown'
import MenuDropdown from '../components/dashboard/MenuDropdown'
import JobDetailsModal from '../components/dashboard/JobDetailsModal'
import AssignCrewModal from '../components/dashboard/AssignCrewModal'
import ZoomControl from '../components/dashboard/ZoomControl'
import { Icon } from '../components/dashboard/icons'
import { useClickDragScroll } from '../hooks/useClickDragScroll'
import { useSidebarCollapsed } from '../hooks/useSidebarCollapsed'
import { SHEET_ZOOM_DEFAULT, sheetZoomStyle, stepSheetZoom } from '../lib/sheetZoom'
import { AddDailyDumpsterCountModal, EditCostAdjustmentModal } from '../components/dashboard/CostTrackingModals'
import {
  useCrewsSummary,
  useJobsList,
  useCostTrackingReport,
  useInvalidateServerState,
} from '../hooks/useQueryHooks'
import { getErrorMessage } from '../lib/errors'
import type { CostTrackingReportData, CostTrackingReportParams } from '../api/dumpsterCostApi'
import { crewColorFor } from '../lib/scheduleData'
import { TableRowSkeleton } from '../components/common/Shimmer'
import {
  assignableCrews,
  formatMoney,
  type Job,
  type UnassignedCrew,
} from '../lib/dashboardData'
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
  currentCrewName?: string
  currentCrewId?: string
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
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${month}-${day}-${year}`
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

function toISO(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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

function getCurrentMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { start: toISO(start), end: toISO(end) }
}

function getCurrentWeekRange() {
  const now = new Date()
  const monday = getMonday(now)
  const sunday = addDays(monday, 6)
  return { start: toISO(monday), end: toISO(sunday) }
}

const DEFAULT_RANGE = getCurrentWeekRange()

function toDetailsJob(row: JobCostRow, catalog: Job[]): Job {
  const match = catalog.find((j) => j.name === row.jobName)
  const num = row.id.replace(/[^0-9]/g, '') || '1'
  return {
    id: row.jobId,
    name: row.jobName,
    color: row.color,
    bidNo: match?.bidNo ?? String(1000 + Number(num)),
    jobNo: match?.jobNo ?? num.padStart(3, '0'),
    gc: match?.gc ?? 'N/A',
    estimator: match?.estimator ?? 'N/A',
    startDate: match?.startDate ?? row.date,
    endDate: match?.endDate ?? row.date,
    contractAmount: row.contract,
    laborBudgetUsed: row.laborBudgetUsed,
    laborBudgetTotal: row.laborBudgetTotal,
  }
}



export default function CostTracking() {
  const [isPhone, setIsPhone] = useState(() => window.innerWidth <= 720)
  const [tab, setTab] = useState<ViewMode>('jobs')
  const [range, setRange] = useState<RangeMode>('Weekly')
  const [search, setSearch] = useState('')
  const [jobFilter, setJobFilter] = useState<string | null>(null)
  const [crewFilter, setCrewFilter] = useState<string | null>(null)
  const [modalMode, setModalMode] = useState<ModalMode>('none')
  const [activeRecord, setActiveRecord] = useState<JobCostRow | CrewCostRow | undefined>()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [extraDays, setExtraDays] = useState(0)
  const [jobs] = useState<Job[]>([])
  const [startDate, setStartDate] = useState(DEFAULT_RANGE.start)
  const [endDate, setEndDate] = useState(DEFAULT_RANGE.end)

  // Both dropdowns read the shared crew/job caches the other screens fill.
  const { data: crewsList = [] } = useCrewsSummary()
  const { data: jobsList = [] } = useJobsList({ limit: 100 })
  const { invalidateAll } = useInvalidateServerState()

  const reportParams = useMemo<CostTrackingReportParams>(() => {
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

      return params
  }, [range, startDate, endDate, tab, search, jobFilter, crewFilter])

  const reportQuery = useCostTrackingReport(reportParams)
  const reportData: CostTrackingReportData | null = reportQuery.data?.success
    ? reportQuery.data.data
    : null
  const loadingReport = reportQuery.isPending
  const reportError = reportQuery.error
    ? getErrorMessage(reportQuery.error, 'Failed to load report data.')
    : ''

  const jobRows: JobCostRow[] = useMemo(() => {
    if (!reportData || reportParams.groupBy !== 'jobs') return []
    return reportData.groups.map((grp, index) => {
              const dailyCosts: Record<string, number | null> = {}
              grp.costByDate.forEach((c) => {
                dailyCosts[c.date] = c.totalCost
              })

              const jobIdStr = grp.jobId ?? `job-${index}`
              const idNumStr = grp.jobIdNumber ? String(grp.jobIdNumber).padStart(3, '0') : String(index + 1).padStart(3, '0')

              const currentCrew = (grp as any).currentCrew
              const crewObj = typeof currentCrew === 'object' && currentCrew !== null ? currentCrew : null
              const crewId = crewObj?._id ?? (typeof currentCrew === 'string' ? currentCrew : null)
              const crewName = crewObj?.name ?? (crewId ? 'Crew' : 'Unassigned')
              const color = crewId ? crewColorFor(crewId, crewObj?.crewColor) : '#94a3b8'

              return {
                id: `#${idNumStr}`,
                jobId: jobIdStr,
                jobName: grp.jobName || 'Unnamed Job',
                color,
                currentCrewName: crewName,
                currentCrewId: crewId ?? undefined,
                date: grp.jobStartDate
                  ? grp.jobStartDate.slice(0, 10)
                  : grp.startDate
                  ? grp.startDate.slice(0, 10)
                  : grp.costByDate[0]?.date || new Date().toISOString().slice(0, 10),
                endDate: grp.costByDate[grp.costByDate.length - 1]?.date || new Date().toISOString().slice(0, 10),
                contract: (grp as any).contractAmount ?? 0,
                laborBudgetTotal: (grp as any).laborBudget ?? 0,
                laborBudgetUsed: grp.totalLaborCost,
                balanceLeft: (grp as any).laborBudgetBalance ?? 0,
                percentSpent: (grp as any).laborBudgetPercentSpent,
                cumulativeLaborCosts: grp.totalLaborCost,
                laborCost: grp.totalLaborCost,
                dumpstersCount: (grp as any).dumpsterCount ?? 0,
                dumpsterUnitCost: 0,
                totalCost: grp.totalLaborCost + grp.totalDumpsterCost,
                weeklyCosts: [],
                dailyCosts,
              }
    })
  }, [reportData, reportParams.groupBy])

  const crewRows: CrewCostRow[] = useMemo(() => {
    if (!reportData || reportParams.groupBy !== 'crews') return []
    return reportData.groups.map((grp, index) => {
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
  }, [reportData, reportParams.groupBy])

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
  const [jobCrews, setJobCrews] = useState<Record<string, UnassignedCrew | null>>({})

  const detailsRow =
    jobFlow.type !== 'none' ? jobRows.find((row) => row.jobId === jobFlow.jobId || row.id === jobFlow.jobId) : undefined
  const detailsJob = detailsRow ? toDetailsJob(detailsRow, jobs) : undefined
  const detailsCrew = detailsRow ? (jobCrews[detailsRow.jobId] ?? jobCrews[detailsRow.id] ?? null) : null

  function openJobDetails(row: JobCostRow) {
    setJobFlow({ type: 'details', jobId: row.jobId })
  }

  const jobFilterOptions = useMemo(
    () => jobsList.map((job) => ({ id: job._id, label: job.name })),
    [jobsList],
  )
  const crewOptions = useMemo(
    () =>
      crewsList.map((crew) => {
        const leadObj = typeof crew.crewLead === 'object' && crew.crewLead !== null ? crew.crewLead : null
        const leadName = leadObj ? `${leadObj.firstName || ''} ${leadObj.lastName || ''}`.trim() : ''
        return {
          id: crew._id,
          label: crew.name,
          color: crew.crewColor || '#94a3b8',
          avatar: '',
          avatarName: leadName || crew.name.slice(0, 2).toUpperCase(),
        }
      }),
    [crewsList],
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
    return () => el.removeEventListener('scroll', handleScroll)
  }, [range])

  const weekDays = useMemo(() => {
    let baseDays: Date[] = []
    const start = parseIsoDate(startDate)

    if (range === 'Weekly') {
      const weekStart = getMonday(start)
      baseDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
    } else if (range === 'Monthly') {
      const year = start.getFullYear()
      const month = start.getMonth()
      const numDays = new Date(year, month + 1, 0).getDate()
      baseDays = Array.from({ length: numDays }, (_, index) => new Date(year, month, index + 1))
    } else if (range === 'All Time') {
      const startAll = parseIsoDate(startDate)
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
            {crewsList.map((crew) => (
              <span key={crew._id} className="sb-legend__item">
                <i style={{ background: crewColorFor(crew._id, crew.crewColor) }} />
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
              onChange={(id) => {
                const newRange = id as RangeMode
                setRange(newRange)
                if (newRange === 'Weekly') {
                  const week = getCurrentWeekRange()
                  setStartDate(week.start)
                  setEndDate(week.end)
                } else if (newRange === 'Monthly' || newRange === 'Custom Range') {
                  const month = getCurrentMonthRange()
                  setStartDate(month.start)
                  setEndDate(month.end)
                }
              }}
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
              <span className="stat-card__label">Total Labor Cost</span>
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
            <table className={`ct-table ct-table--grid${metaVisible ? ' ct-table--meta' : ''}`}>
              <tbody>
                <TableRowSkeleton cols={metaVisible ? 15 : 9} rows={6} height="22px" />
              </tbody>
            </table>
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
                  <th className="ct-sticky ct-sticky--id">Job ID</th>
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
                          const name = row.currentCrewName || 'Unassigned'
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
                      const jobStartIso = row.date ? row.date.slice(0, 10) : null
                      const isBeforeJobStart = Boolean(jobStartIso && dayStr < jobStartIso)

                      if (isBeforeJobStart) {
                        return (
                          <td
                            key={day.toISOString()}
                            className="ct-grid-cell ct-grid-cell--disabled"
                          />
                        )
                      }

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
                  <th>Crew ID</th>
                  <th>Crew Name</th>
                  <th>Date</th>
                  <th>Total Hours</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {filteredCrewRows.map((row) => (
                  <tr key={row.id}>
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
                    <td>{row.jobDates && row.jobDates.length > 0 ? formatCrewDate(row.date) : '-'}</td>
                    <td>{row.totalHours}</td>
                    <td>{formatMoney(row.cost)}</td>
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
            invalidateAll()
          }}
        />
      )}

      {modalMode === 'edit' && activeRecord && 'jobId' in activeRecord && (
        <EditCostAdjustmentModal
          jobId={activeRecord.jobId}
          jobName={activeRecord.jobName}
          jobIdNumber={Number(activeRecord.id.replace(/\D/g, '')) || undefined}
          date={selectedDate || activeRecord.date}
          onCancel={closeModal}
          onSuccess={() => {
            invalidateAll()
          }}
        />
      )}

      {jobFlow.type === 'details' && detailsJob && (
        <JobDetailsModal
          job={detailsJob}
          crew={detailsCrew}
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
          onAssign={(crewId) => {
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
            // Rows come from the cost report now; re-read it rather than
            // recolouring a local copy.
            invalidateAll()
            setJobFlow({ type: 'details', jobId: detailsJob.id })
          }}
        />
      )}

    </div>
  )
}
