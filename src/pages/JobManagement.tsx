import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { MagnifyingGlass, Plus, CaretLeft, CaretRight } from '@phosphor-icons/react'
import Sidebar from '../components/dashboard/Sidebar'
import Dropdown from '../components/dashboard/Dropdown'
import ZoomControl from '../components/dashboard/ZoomControl'
import CreateJobModal, { type JobFormData } from '../components/dashboard/CreateJobModal'
import JobDetailsModal from '../components/dashboard/JobDetailsModal'
import AssignCrewModal from '../components/dashboard/AssignCrewModal'
import { assignableCrews, type Job, type UnassignedCrew } from '../lib/dashboardData'
import { type JobStatus, type ManagedJob } from '../lib/jobsManagementData'
import { useClickDragScroll } from '../hooks/useClickDragScroll'
import { SHEET_ZOOM_DEFAULT, sheetZoomStyle, stepSheetZoom } from '../lib/sheetZoom'
import { useAppStore } from '../lib/store'
import { type JobItem, type JobFinancials, type JobDayCost } from '../api/jobApi'
import { type UserItem } from '../api/crewApi'
import { crewColorFor } from '../lib/scheduleData'
import { getErrorMessage } from '../lib/errors'
import { useCrewsSummary, useJobsPaged, useJobMutations } from '../hooks/useQueryHooks'
import './JobsManagement.css'

type SortKey = 'newest' | 'oldest' | 'rateLowHigh' | 'rateHighLow' | 'workers' | 'ascending' | 'descending'

/** One crew on the job, as the "Assigned to" cell and the name stripe show it. */
type CrewChip = { id: string; name: string; color: string }

type Row = ManagedJob & {
  rawId: string
  note?: string
  /** Every crew scheduled on the job now or later, from `assignedTo`. */
  crews: CrewChip[]
  jobNo: string
  bidNo: string
  estimator: string
  budgetedDays: number | null
  /** Budget/revenue rollups; absent if the server didn't compute them. */
  financials?: JobFinancials
  /** `yearCostTracking` keyed by "YYYY-MM-DD" for O(1) lookup per day column. */
  costByDate: Record<string, JobDayCost>
}

/**
 * Every day of `year`, Jan 1 through Dec 31 — the span `yearCostTracking`
 * covers, and what the right-hand strip is for. Leap years come out at 366 by
 * construction rather than by a rule.
 */
function yearDays(year: number): Date[] {
  const out: Date[] = []
  const d = new Date(year, 0, 1)
  while (d.getFullYear() === year) {
    out.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return out
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec']

function shortDate(d: Date) {
  return `${d.getMonth() + 1}-${d.getDate()}-${String(d.getFullYear()).slice(2)}`
}

/** Local "YYYY-MM-DD" — the key shape `yearCostTracking` uses. */
function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
  )
}

/** Short money for the dense right-hand columns: $4,213, never $4,213.00. */
function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return `$${Math.round(value).toLocaleString()}`
}

function percent(value: number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return `${value.toFixed(1)}%`
}

/** Day-pane width in px: default (~5 columns visible), and its drag bounds. */
const DAY_PANE_DEFAULT_W = 520
const DAY_PANE_MIN_W = 180
const DAY_PANE_MAX_W = 1100

/**
 * Every row height of `source`, header row first, kept live.
 *
 * The two panes are separate `<table>`s so they can scroll apart, which means
 * nothing lines their rows up on its own — a job with four crews is taller on
 * the left than its (uniform) day cells are on the right. The left table owns
 * the heights and the right one is told what they are, index for index: both
 * render one header row followed by the same jobs in the same order.
 */
function useSyncedRowHeights(
  source: React.RefObject<HTMLTableElement | null>,
  deps: unknown[],
): number[] {
  const [heights, setHeights] = useState<number[]>([])

  useLayoutEffect(() => {
    const table = source.current
    if (!table) return

    const measure = () => {
      const next = Array.from(table.rows).map((r) => r.getBoundingClientRect().height)
      setHeights((prev) =>
        prev.length === next.length && prev.every((h, i) => Math.abs(h - next[i]) < 0.5) ? prev : next,
      )
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(table)
    for (const row of Array.from(table.rows)) observer.observe(row)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return heights
}

/** A two-line cell: top value, hairline, bottom value. Blanks stay blank. */
function StackCell({ top, bottom }: { top?: string; bottom?: string }) {
  return (
    <div className="jm-stack">
      <span className="jm-stack__val">{top ?? ''}</span>
      <span className="jm-stack__rule" />
      <span className="jm-stack__val">{bottom ?? ''}</span>
    </div>
  )
}

type Flow =
  | { type: 'none' }
  | { type: 'details'; jobId: string }
  | { type: 'assignCrew'; jobId: string }

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'newest', label: 'Newest First' },
  { id: 'oldest', label: 'Oldest First' },
  { id: 'rateLowHigh', label: 'Hourly Rate Low-High' },
  { id: 'rateHighLow', label: 'Hourly Rate High-Low' },
  { id: 'workers', label: 'Number of Workers' },
  { id: 'ascending', label: 'Ascending A-Z' },
  { id: 'descending', label: 'Descending Z-A' },
]

const STATUS_OPTIONS: { id: JobStatus; label: string }[] = [
  { id: 'in-progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'awarded', label: 'Awarded' },
]

function toJob(row: Row): Job {
  const num = row.id.replace('#', '')
  return {
    id: row.rawId || row.id,
    name: row.name,
    color: row.color,
    bidNo: row.bidNo.replace('#', ''),
    jobNo: num,
    gc: row.gc,
    estimator: row.estimator || row.idsSuper,
    startDate: row.startDate,
    endDate: row.endDate,
    contractAmount: row.contract,
    laborBudgetUsed: row.laborBudgetUsed,
    laborBudgetTotal: row.laborBudgetTotal,
  }
}

function toCrew(row: Row): UnassignedCrew | null {
  if (!row.crewName || row.crewName === 'Unassigned') return null
  const match = assignableCrews.find((c) => c.name === row.crewName)
  return {
    id: match?.id ?? row.id,
    name: row.crewName,
    leadName: match?.leadName ?? row.crewName.replace(/'s Crew$/, ''),
    rate: row.crewRate || match?.rate || 0,
    avatar: match?.avatar,
  }
}

/**
 * A money field as a number, whatever shape the API sent it in.
 *
 * Mongo currency fields arrive as a plain number, as a numeric string, or —
 * when the column is a Decimal128 — as `{ $numberDecimal: "50000" }`. Only the
 * first survives `.toLocaleString()` intact: a string passes through unformatted
 * and the object renders as "[object Object]", so the cell has to normalise
 * before it formats. Anything unparseable becomes 0.
 */
function toAmount(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (value && typeof value === 'object' && '$numberDecimal' in value) {
    const parsed = Number((value as { $numberDecimal: string }).$numberDecimal)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

/** Flattens a JobItem (with its populated crew) into the sheet's row shape. */
function toRow(j: JobItem): Row {
  const crewObj = typeof j.currentCrew === 'object' && j.currentCrew !== null ? j.currentCrew : null
  const crewLeadObj =
    crewObj && typeof crewObj.crewLead === 'object' && crewObj.crewLead !== null
      ? (crewObj.crewLead as UserItem)
      : null
  const leadName = crewLeadObj
    ? `${crewLeadObj.firstName || ''} ${crewLeadObj.lastName || ''}`.trim()
    : crewObj?.name || 'Unassigned'
  const crewColor = crewObj?.crewColor || '#3b82f6'

  const numStr = String(j.jobIdNumber || 0).padStart(3, '0')
  const formattedStart = j.startDate ? new Date(j.startDate).toISOString().slice(0, 10) : ''
  const formattedEnd = j.endDate ? new Date(j.endDate).toISOString().slice(0, 10) : ''

  let normalizedStatus: JobStatus = 'awarded'
  if (j.status === 'in-progress' || j.status === 'completed' || j.status === 'awarded') {
    normalizedStatus = j.status
  }

  const gcSuperVal = j.gcSuper || '-'
  // The IDS super is the assigned crew's lead. The stored idsSuper string is
  // only a fallback for jobs saved before that rule, or ones with no crew yet.
  let idsSuperVal = '-'
  if (leadName !== 'Unassigned') {
    idsSuperVal = leadName
  } else if (j.idsSuper) {
    if (typeof j.idsSuper === 'object' && j.idsSuper !== null) {
      idsSuperVal = `${j.idsSuper.firstName || ''} ${j.idsSuper.lastName || ''}`.trim() || '-'
    } else if (typeof j.idsSuper === 'string') {
      idsSuperVal = j.idsSuper
    }
  }

  // `assignedTo` is every crew scheduled now or later; `currentCrew` only
  // covers today, so it is just the fallback for a response without it.
  const crews: CrewChip[] = Array.isArray(j.assignedTo)
    ? j.assignedTo.map((c, i) => ({
        id: c.crewId || `${j._id}-${i}`,
        name: c.name || 'Unassigned',
        color: c.crewColor || '#3b82f6',
      }))
    : crewObj
      ? [{ id: crewObj._id || j._id, name: crewObj.name || 'Unassigned', color: crewColor }]
      : []

  const costByDate: Record<string, JobDayCost> = {}
  for (const day of j.financials?.yearCostTracking ?? []) {
    costByDate[day.date] = day
  }

  return {
    financials: j.financials,
    costByDate,
    id: `#${numStr}`,
    rawId: j._id,
    name: j.name,
    color: crewColor,
    crews,
    jobNo: `#${numStr}`,
    bidNo: j.bidNumber === null || j.bidNumber === undefined ? '' : `#${j.bidNumber}`,
    estimator: j.estimator || '',
    budgetedDays: typeof j.budgetedDays === 'number' ? j.budgetedDays : null,
    crewName: crewObj ? crewObj.name : 'Unassigned',
    gc: j.generalContractor || '-',
    gcSuper: gcSuperVal,
    idsSuper: idsSuperVal,
    contract: toAmount(j.contractAmount),
    startDate: formattedStart,
    endDate: formattedEnd,
    status: normalizedStatus,
    laborBudgetUsed: toAmount(j.laborBudgetUsed),
    laborBudgetTotal: toAmount(j.laborBudget),
    crewRate: toAmount(crewLeadObj?.hourlyRate),
    workers: Array.isArray(crewObj?.members) ? crewObj.members.length : 1,
    note: j.note || undefined,
  }
}

export default function JobsManagement() {
  const [actionError, setActionError] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<JobStatus | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('newest')
  const [zoom, setZoom] = useState(SHEET_ZOOM_DEFAULT)
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [flow, setFlow] = useState<Flow>({ type: 'none' })
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  const today = useMemo(() => new Date(), [])
  // The strip is the cost-tracking year, so it spans the calendar year today
  // falls in rather than the current week.
  const days = useMemo(() => yearDays(today.getFullYear()), [today])

  // The sheet is two panes that scroll independently: the job columns on the
  // left, the day strip on the right. Only their vertical scroll is kept in
  // step, so the day strip pans sideways without dragging the table with it.
  const mainPaneRef = useRef<HTMLDivElement>(null)
  const dayPaneRef = useRef<HTMLDivElement>(null)
  useClickDragScroll(mainPaneRef)
  useClickDragScroll(dayPaneRef)
  const [dayPaneWidth, setDayPaneWidth] = useState(DAY_PANE_DEFAULT_W)
  const [leftCollapsed, setLeftCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('jm_left_collapsed') === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('jm_left_collapsed', String(leftCollapsed))
    } catch {
      // ignore
    }
  }, [leftCollapsed])

  const [crewHover, setCrewHover] = useState<{ x: number; y: number; color: string; names: string[] } | null>(null)
  const { assignCrew } = useAppStore()

  const { data: crewsList = [] } = useCrewsSummary()

  // Debounce so a query key isn't swapped (and a request fired) per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(timer)
  }, [search])

  const sortByParam =
    sortKey === 'newest'
      ? 'newest'
      : sortKey === 'oldest'
        ? 'oldest'
        : sortKey === 'ascending'
          ? 'nameAsc'
          : sortKey === 'descending'
            ? 'nameDesc'
            : undefined

  const jobsQuery = useJobsPaged({
    page,
    limit,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    sortBy: sortByParam,
  })

  const jobs = useMemo(() => (jobsQuery.data?.items ?? []).map(toRow), [jobsQuery.data])

  // Every job's `fourMonths` covers the same four months (current + next 3),
  // so the first row that has them defines the header. With no rows — or on a
  // response predating the rollup — the same run is derived locally.
  const months = useMemo(() => {
    const fromApi = jobs.find((j) => j.financials?.fourMonths?.length)?.financials?.fourMonths
    if (fromApi?.length) return fromApi.map((m) => ({ key: m.month, label: m.label }))
    const now = new Date()
    return Array.from({ length: 4 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      return {
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: `${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`,
      }
    })
  }, [jobs])
  /** Columns in the left pane only — the day strip is its own table now. */
  const columnCount = leftCollapsed ? 1 : 10 + months.length
  const pagination = jobsQuery.data?.pagination ?? { page, limit, totalCount: 0, totalPages: 1 }
  const loading = jobsQuery.isPending
  const apiError =
    actionError || (jobsQuery.error ? getErrorMessage(jobsQuery.error, 'Failed to fetch jobs listing.') : '')

  const { updateJobMutation, deleteJobMutation, invalidateAll } = useJobMutations()

  const mainTableRef = useRef<HTMLTableElement>(null)
  // [0] is the header row; job i is at [i + 1].
  const rowHeights = useSyncedRowHeights(mainTableRef, [jobs, zoom, months.length, loading, leftCollapsed])

  // Vertical only, and guarded so the echo from setting the other pane's
  // scrollTop doesn't bounce straight back.
  const syncingRef = useRef(false)
  const syncVertical = useCallback((from: 'main' | 'day') => {
    if (syncingRef.current) return
    const source = from === 'main' ? mainPaneRef.current : dayPaneRef.current
    const target = from === 'main' ? dayPaneRef.current : mainPaneRef.current
    if (!source || !target || target.scrollTop === source.scrollTop) return
    syncingRef.current = true
    target.scrollTop = source.scrollTop
    requestAnimationFrame(() => {
      syncingRef.current = false
    })
  }, [])

  function toggleLeftCollapse() {
    setLeftCollapsed((prev) => {
      const next = !prev
      if (next && mainPaneRef.current) {
        mainPaneRef.current.scrollLeft = 0
      }
      return next
    })
  }

  // A year of columns opens on Jan 1, which is rarely what anyone wants to see.
  // Park today a little in from the left edge, once, as soon as the strip has
  // been laid out. Later widths/zooms leave the user's own position alone.
  const didScrollToTodayRef = useRef(false)
  useLayoutEffect(() => {
    if (didScrollToTodayRef.current || loading || jobs.length === 0) return
    const pane = dayPaneRef.current
    if (!pane) return
    const column = pane.querySelector<HTMLElement>('thead .jm-day-col.is-today')
    if (!column) return
    didScrollToTodayRef.current = true
    // Measured rather than read off offsetLeft, which is relative to whichever
    // ancestor happens to be positioned.
    const paneRect = pane.getBoundingClientRect()
    const columnRect = column.getBoundingClientRect()
    pane.scrollLeft = Math.max(
      0,
      pane.scrollLeft + columnRect.left - paneRect.left - columnRect.width,
    )
  }, [loading, jobs.length])

  /** Drag the grip to resize, or click to toggle collapse of left columns. */
  function startPaneResize(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const startWidth = dayPaneWidth
    let moved = false

    const onMove = (ev: PointerEvent) => {
      if (!moved) {
        if (Math.abs(ev.clientX - startX) > 4 || Math.abs(ev.clientY - startY) > 4) {
          moved = true
          document.body.classList.add('is-col-resizing')
        }
      }
      if (moved) {
        if (leftCollapsed) {
          setLeftCollapsed(false)
        }
        const next = startWidth + (startX - ev.clientX)
        setDayPaneWidth(Math.min(DAY_PANE_MAX_W, Math.max(DAY_PANE_MIN_W, next)))
      }
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.classList.remove('is-col-resizing')
      if (!moved) {
        toggleLeftCollapse()
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }


  const editingJob = editingId ? jobs.find((j) => j.id === editingId) : undefined
  const activeRow = flow.type !== 'none' ? jobs.find((j) => j.rawId === flow.jobId || j.id === flow.jobId) : undefined

  function handleCreate(_data: JobFormData, createdJob?: JobItem) {
    setShowCreate(false)
    if (createdJob) {
      invalidateAll()
    }
  }

  function handleUpdate(_data: JobFormData, updatedJob?: JobItem) {
    setEditingId(null)
    if (updatedJob) {
      invalidateAll()
    }
  }

  async function handleStatusChange(jobId: string, newStatus: JobStatus) {
    setActionError('')
    try {
      await updateJobMutation.mutateAsync({ id: jobId, payload: { status: newStatus } })
    } catch (err: any) {
      setActionError(getErrorMessage(err, 'Failed to update job status.'))
    }
  }

  async function handleDeleteJob(jobId: string) {
    setActionError('')
    try {
      await deleteJobMutation.mutateAsync(jobId)
      setFlow({ type: 'none' })
    } catch (err: any) {
      setActionError(getErrorMessage(err, 'Failed to delete job.'))
    }
  }

  return (
    <div className="dash">
      <Sidebar active="Jobs Management" />

      <main className="dash__main jm-main">
        <div className="jm-header-row">
          <div>
            <h1 className="dash__title">Jobs</h1>
            <p className="dash__subtitle">All jobs &amp; revenue</p>
          </div>
          <div className="page-header__right">
            <div className="sb-legend">
              {crewsList.map((crew) => (
                <span key={crew._id} className="sb-legend__item">
                  <i style={{ background: crewColorFor(crew._id, crew.crewColor) }} />
                  {crew.name}
                </span>
              ))}
            </div>
            <ZoomControl
              zoom={zoom}
              onZoomIn={() => setZoom((z) => stepSheetZoom(z, 1))}
              onZoomOut={() => setZoom((z) => stepSheetZoom(z, -1))}
            />
          </div>
        </div>

        <div className="jm-toolbar">
          <label className="jm-search">
            <MagnifyingGlass size={16} weight="regular" />
            <input
              placeholder="Search a job..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </label>

          <span className="jm-count">{pagination.totalCount || jobs.length} Total Jobs</span>

          <div className="jm-toolbar__right">
            <div className="jm-dd jm-dd--status">
              <Dropdown
                value={statusFilter ?? '__all'}
                selectedLabel={
                  statusFilter ? `${STATUS_OPTIONS.find((s) => s.id === statusFilter)?.label}` : 'Status'
                }
                onChange={(v) => {
                  setStatusFilter(v === '__all' ? null : (v as JobStatus))
                  setPage(1)
                }}
                options={[
                  { id: '__all', label: 'All Statuses' },
                  ...STATUS_OPTIONS.map((s) => ({ id: s.id, label: s.label })),
                ]}
              />
            </div>

            <div className="jm-dd jm-dd--sort">
              <Dropdown
                value={sortKey}
                selectedLabel={`${SORT_OPTIONS.find((s) => s.id === sortKey)?.label}`}
                onChange={(v) => {
                  setSortKey(v as SortKey)
                  setPage(1)
                }}
                options={SORT_OPTIONS.map((s) => ({ id: s.id, label: s.label }))}
              />
            </div>
            <button type="button" className="btn btn--primary jm-create-btn" onClick={() => setShowCreate(true)}>
              <Plus size={16} weight="bold" />
              Create Job
            </button>
          </div>
        </div>

        {apiError && <p className="field-error" style={{ margin: '12px 0' }}>{apiError}</p>}

        <div className="jm-sheet">
        <div
          className={`jm-table-wrap jm-pane--main${leftCollapsed ? ' is-collapsed' : ''}`}
          ref={mainPaneRef}
          onScroll={() => syncVertical('main')}
        >
          <div className="jm-table-zoom" style={sheetZoomStyle(zoom)}>
          <table className="jm-table" ref={mainTableRef}>
            <colgroup>
              <col className="jm-col-name-w" />
              {!leftCollapsed && (
                <>
                  <col className="jm-col-xs" />
                  <col className="jm-col-xs" />
                  <col className="jm-col-sm" />
                  <col className="jm-col-md" />
                  <col className="jm-col-sm" />
                  <col className="jm-col-stack" />
                  <col className="jm-col-stack" />
                  <col className="jm-col-stack" />
                  <col className="jm-col-stack-lg" />
                  {months.map((m) => (
                    <col key={`c-m-${m.key}`} className="jm-col-month" />
                  ))}
                </>
              )}
            </colgroup>
            <thead>
              <tr>
                <th className="jm-sticky jm-sticky--name">Job Name</th>
                {!leftCollapsed && (
                  <>
                    <th>Job #</th>
                    <th>Bid #</th>
                    <th>Estimator</th>
                    <th>Assigned to</th>
                    <th>Contractor</th>
                    <th className="jm-center">
                      <span className="jm-th-stack jm-th-stack--split">
                        <span>Contract Amt</span>
                        <span className="jm-th-stack__rule" />
                        <span>Budgeted Labor</span>
                      </span>
                    </th>
                    <th className="jm-center">
                      <span className="jm-th-stack jm-th-stack--split">
                        <span>Budgeted Days</span>
                        <span className="jm-th-stack__rule" />
                        <span>Balance to Spend</span>
                      </span>
                    </th>
                    <th className="jm-center">
                      <span className="jm-th-stack jm-th-stack--split">
                        <span>Revenue per Day</span>
                        <span className="jm-th-stack__rule" />
                        <span>Percent of Total</span>
                      </span>
                    </th>
                    <th className="jm-center">
                      <span className="jm-th-stack jm-th-stack--split">
                        <span>Cumulative Revenue</span>
                        <span className="jm-th-stack__rule" />
                        <span>Cumulative Labor Cost</span>
                      </span>
                    </th>
                    {months.map((m) => (
                      <th key={`h-m-${m.key}`} className="jm-center jm-month-col" title={m.label}>
                        {MONTH_SHORT[Number(m.key.slice(5, 7)) - 1] ?? m.label}
                      </th>
                    ))}
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columnCount} className="crew-empty-cell" style={{ textAlign: 'center', padding: '32px 0' }}>
                    Loading jobs...
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="crew-empty-cell" style={{ textAlign: 'center', padding: '32px 0' }}>
                    No jobs found
                  </td>
                </tr>
              ) : (
                jobs.map((job) => {
                  const stripes = job.crews.length
                    ? job.crews
                    : [{ id: 'none', name: 'Unassigned', color: '#94a3b8' }]
                  const fin = job.financials
                  // The server's laborBudgetRemaining, or the same subtraction
                  // locally when a response predates the financials rollup.
                  const balanceToSpend =
                    fin?.laborBudgetRemaining ?? job.laborBudgetTotal - job.laborBudgetUsed
                  // "Percent of Total": one day's revenue as a share of the
                  // whole contract. The API has no such field, so it is derived
                  // from the two it does return.
                  const percentOfTotal =
                    fin?.revenuePerDay && job.contract > 0
                      ? (fin.revenuePerDay / job.contract) * 100
                      : null
                  const monthsByKey = new Map((fin?.fourMonths ?? []).map((m) => [m.month, m]))
                  return (
                    <tr key={job.rawId || job.id} className="jm-row">
                      <td className="jm-name-cell jm-sticky jm-sticky--name">
                        <span
                          className="jm-color-bar-hit"
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect()
                            setCrewHover({
                              x: rect.right + 14,
                              y: rect.top + rect.height / 2,
                              color: stripes[0].color,
                              names: stripes.map((c) => c.name),
                            })
                          }}
                          onMouseLeave={() => setCrewHover(null)}
                        >
                          <span className="jm-color-bar">
                            {stripes.map((c) => (
                              <span key={c.id} className="jm-color-bar__seg" style={{ background: c.color }} />
                            ))}
                          </span>
                        </span>
                        <button
                          type="button"
                          className="jm-name-btn"
                          onClick={() => setFlow({ type: 'details', jobId: job.rawId || job.id })}
                        >
                          <span className="jm-name-inner">
                            <span>{job.name}</span>
                            <CaretRight size={16} />
                          </span>
                        </button>
                      </td>
                      {!leftCollapsed && (
                        <>
                          <td>{job.jobNo}</td>
                          <td>{job.bidNo}</td>
                          <td>{job.estimator}</td>
                          <td className="jm-crew-cell">
                            <span className="jm-crew-list">
                              {job.crews.length === 0 ? (
                                <span className="jm-crew-chip">
                                  <i style={{ background: '#94a3b8' }} />
                                  Unassigned
                                </span>
                              ) : (
                                job.crews.map((c) => (
                                  <span key={c.id} className="jm-crew-chip">
                                    <i style={{ background: c.color }} />
                                    {c.name}
                                  </span>
                                ))
                              )}
                            </span>
                          </td>
                          <td>{job.gc}</td>
                          <td className="jm-center">
                            <StackCell top={money(job.contract)} bottom={money(job.laborBudgetTotal)} />
                          </td>
                          <td className="jm-center">
                            <StackCell
                              top={job.budgetedDays === null ? '' : String(job.budgetedDays)}
                              bottom={money(balanceToSpend)}
                            />
                          </td>
                          <td className="jm-center">
                            <StackCell top={money(fin?.revenuePerDay)} bottom={percent(percentOfTotal)} />
                          </td>
                          <td className="jm-center">
                            <StackCell
                              top={money(fin?.cumulativeRevenue)}
                              bottom={money(fin?.cumulativeLaborCost)}
                            />
                          </td>
                          {months.map((m) => {
                            const bucket = monthsByKey.get(m.key)
                            return (
                              <td key={`${job.rawId}-m-${m.key}`} className="jm-center jm-month-col">
                                <StackCell
                                  top={money(bucket?.revenueParked)}
                                  bottom={money(bucket?.totalLaborCost)}
                                />
                              </td>
                            )
                          })}
                        </>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
          </div>
        </div>

        <div
          className={`jm-pane-grip${leftCollapsed ? ' is-collapsed' : ''}`}
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-label={leftCollapsed ? 'Expand columns' : 'Collapse columns'}
          title={leftCollapsed ? 'Click to expand columns' : 'Click to collapse columns'}
          onPointerDown={startPaneResize}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              toggleLeftCollapse()
            }
          }}
        >
          <div className="jm-pane-grip__toggle" aria-hidden>
            {leftCollapsed ? (
              <CaretRight size={13} weight="bold" />
            ) : (
              <CaretLeft size={13} weight="bold" />
            )}
          </div>
          <span className="jm-grip" />
        </div>

        {/* Its own scroller: panning the day strip sideways leaves the job
            columns where they are. Only vertical scroll is shared. */}
        <div
          className={`jm-table-wrap jm-pane--days${leftCollapsed ? ' is-expanded' : ''}`}
          style={leftCollapsed ? undefined : { width: `${dayPaneWidth}px` }}
          ref={dayPaneRef}
          onScroll={() => syncVertical('day')}
        >
          <div className="jm-table-zoom" style={sheetZoomStyle(zoom)}>
          <table className="jm-table jm-table--days">
            <colgroup>
              {days.map((d) => (
                <col key={`c-d-${d.getTime()}`} className="jm-col-day" />
              ))}
            </colgroup>
            <thead>
              <tr style={rowHeights[0] ? { height: `${rowHeights[0]}px` } : undefined}>
                {days.map((d) => {
                  const isToday = isSameDay(d, today)
                  return (
                    <th
                      key={`h-d-${d.getTime()}`}
                      className={`jm-center jm-day-col${isToday ? ' is-today' : ''}`}
                    >
                      <span className="jm-th-stack">
                        <span>
                          {isToday ? `Today, ${WEEKDAY_SHORT[d.getDay()]}` : WEEKDAY_SHORT[d.getDay()]}
                        </span>
                        <span className="jm-day-col__date">{shortDate(d)}</span>
                      </span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {loading || jobs.length === 0 ? (
                <tr>
                  <td colSpan={days.length} className="crew-empty-cell" style={{ padding: '32px 0' }} />
                </tr>
              ) : (
                jobs.map((job, rowIndex) => (
                  <tr
                    key={job.rawId || job.id}
                    className="jm-row"
                    style={
                      rowHeights[rowIndex + 1] ? { height: `${rowHeights[rowIndex + 1]}px` } : undefined
                    }
                  >
                    {days.map((d) => {
                      const day = job.costByDate[isoDay(d)]
                      return (
                        <td
                          key={`${job.rawId}-d-${d.getTime()}`}
                          className={`jm-center jm-day-col${isSameDay(d, today) ? ' is-today' : ''}`}
                        >
                          {/* Cost alone — no second line, so no hairline either. */}
                          <span className="jm-day-cost">{money(day?.laborCost)}</span>
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
        </div>

        <div className="jm-pagination-bar">
          <div className="jm-pagination-limit">
            <span>Show:</span>
            <Dropdown
              placement="top"
              value={String(limit)}
              onChange={(v) => {
                setLimit(Number(v))
                setPage(1)
              }}
              options={[
                { id: '10', label: '10 per page' },
                { id: '20', label: '20 per page' },
                { id: '50', label: '50 per page' },
                { id: '100', label: '100 per page' },
              ]}
            />
          </div>

          <div className="jm-pagination-controls">
            <span className="jm-pagination-info">
              Page {pagination.page || page} of {pagination.totalPages || 1}
            </span>
            <div className="jm-pagination-btns">
              <button
                type="button"
                className="btn btn--outline jm-page-btn"
                disabled={loading || (pagination.page || page) <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <CaretLeft size={16} /> Previous
              </button>
              <button
                type="button"
                className="btn btn--outline jm-page-btn"
                disabled={loading || (pagination.page || page) >= (pagination.totalPages || 1)}
                onClick={() => setPage((p) => Math.min(pagination.totalPages || 1, p + 1))}
              >
                Next <CaretRight size={16} />
              </button>
            </div>
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

      {showCreate && <CreateJobModal onCancel={() => setShowCreate(false)} onSubmit={handleCreate} />}
      {editingJob && <CreateJobModal job={toJob(editingJob)} onCancel={() => setEditingId(null)} onSubmit={handleUpdate} />}

      {flow.type === 'details' && activeRow && (
        <JobDetailsModal
          job={toJob(activeRow)}
          crew={toCrew(activeRow)}
          note={activeRow.note ?? ''}
          status={activeRow.status}
          onDone={() => setFlow({ type: 'none' })}
          onChangeStatus={(next) => handleStatusChange(activeRow.rawId || activeRow.id, next)}
          onEditJob={() => {
            setFlow({ type: 'none' })
            setEditingId(activeRow.id)
          }}
          onChangeCrew={() => setFlow({ type: 'assignCrew', jobId: activeRow.rawId || activeRow.id })}
          onSaveNote={(text: string) => {
            updateJobMutation
              .mutateAsync({ id: activeRow.rawId || activeRow.id, payload: { note: text } })
              .catch((err) => setActionError(getErrorMessage(err, 'Failed to save note.')))
          }}
          onDeleteJob={() => handleDeleteJob(activeRow.rawId || activeRow.id)}
        />
      )}

      {flow.type === 'assignCrew' && activeRow && (
        <AssignCrewModal
          job={toJob(activeRow)}
          onCancel={() => setFlow({ type: 'details', jobId: activeRow.rawId || activeRow.id })}
          onAssign={(crewId, startDate, endDate, note) => {
            const crew = assignableCrews.find((c) => c.id === crewId)
            if (!crew) return
            
            // This will throw if there's an overlap
            assignCrew(activeRow.id, crewId, startDate, endDate, note)

            // NOTE: `assignableCrews` is still local demo data, so this path has
            // no server write to invalidate against yet — see Crew.tsx for the
            // real createCrewAssignment + assignToCrew pair.
            invalidateAll()
            setFlow({ type: 'details', jobId: activeRow.rawId || activeRow.id })
          }}
        />
      )}
    </div>
  )
}
