import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { MagnifyingGlass, CaretLeft, CaretRight, CalendarBlank } from '@phosphor-icons/react'
import Sidebar from '../components/dashboard/Sidebar'
import Dropdown from '../components/dashboard/Dropdown'
import ZoomControl from '../components/dashboard/ZoomControl'
import { useSidebarCollapsed } from '../hooks/useSidebarCollapsed'
import { useSplitSheet, useSyncedRowHeights } from '../hooks/useSplitSheet'
import { useJobRevenue } from '../hooks/useQueryHooks'
import { getErrorMessage } from '../lib/errors'
import type { GetJobRevenueParams } from '../api/jobApi'
import { addDays, fromISO, getMonday, toISO } from '../lib/scheduleData'
import { SHEET_ZOOM_DEFAULT, sheetZoomStyle, stepSheetZoom } from '../lib/sheetZoom'
import { STATUS_COLORS, STATUS_LABELS, type JobStatus } from '../lib/jobsManagementData'
import './Dashboard.css'
import './JobsManagement.css'
import './CostTracking.css'
import './Revenue.css'

type PeriodMode = 'weekly' | 'monthly' | 'yearly' | 'custom' | 'all'
/** The calendar periods the prev/next arrows step through. */
type StepMode = Exclude<PeriodMode, 'custom' | 'all'>
type SortKey = NonNullable<GetJobRevenueParams['sortBy']>

const PERIOD_OPTIONS: { id: PeriodMode; label: string }[] = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
  { id: 'custom', label: 'Custom Date' },
  { id: 'all', label: 'All Time' },
]

const STATUS_OPTIONS: { id: JobStatus; label: string }[] = [
  { id: 'awarded', label: STATUS_LABELS.awarded },
  { id: 'in-progress', label: STATUS_LABELS['in-progress'] },
  { id: 'completed', label: STATUS_LABELS.completed },
]

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'nameAsc', label: 'Name A–Z' },
  { id: 'nameDesc', label: 'Name Z–A' },
]

const PERIOD_NOUN: Record<StepMode, string> = {
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Left-pane columns, for the loading/empty row's colSpan. */
const COLUMN_COUNT = 6

/** First and last day of the calendar week/month/year containing `anchor`. */
function periodBounds(mode: StepMode, anchor: Date): [Date, Date] {
  if (mode === 'weekly') {
    const monday = getMonday(anchor)
    return [monday, addDays(monday, 6)]
  }
  if (mode === 'monthly') {
    return [
      new Date(anchor.getFullYear(), anchor.getMonth(), 1),
      new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0),
    ]
  }
  return [new Date(anchor.getFullYear(), 0, 1), new Date(anchor.getFullYear(), 11, 31)]
}

/** The same kind of period one step back (-1) or forward (+1). */
function shiftAnchor(mode: StepMode, anchor: Date, dir: 1 | -1) {
  if (mode === 'weekly') return addDays(anchor, 7 * dir)
  if (mode === 'monthly') return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1)
  return new Date(anchor.getFullYear() + dir, 0, 1)
}

function periodLabel(mode: Exclude<PeriodMode, 'all'>, [from, to]: [Date, Date]) {
  if (mode === 'yearly') return String(from.getFullYear())
  if (mode === 'monthly') return from.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  if (mode === 'custom') {
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return `${fmt(from)} - ${fmt(to)}`
  }
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(from)} - ${fmt(to)}, ${to.getFullYear()}`
}

/** "10-27-2026", as the toolbar date fields show it. */
function toolbarDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${m}-${d}-${y}`
}

/** A toolbar date button over a hidden native picker, like Cost Tracking's. */
function DateField({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: string
  min?: string
  max?: string
  onChange: (value: string) => void
  label: string
}) {
  const ref = useRef<HTMLInputElement>(null)

  return (
    <div className="ct-date-field">
      <button
        type="button"
        className="ct-date-field__trigger"
        aria-label={label}
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
        <span>{toolbarDate(value)}</span>
        <CalendarBlank size={16} weight="regular" />
      </button>
      <input
        ref={ref}
        type="date"
        value={value}
        min={min}
        max={max}
        tabIndex={-1}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="ct-date-field__native"
      />
    </div>
  )
}

/** Every day from `from` to `to`, inclusive. */
function daysBetween(from: Date, to: Date): Date[] {
  const out: Date[] = []
  for (let d = new Date(from); d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

function shortDate(d: Date) {
  return `${d.getMonth() + 1}-${d.getDate()}-${String(d.getFullYear()).slice(2)}`
}

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Exact money for the summary cards. */
function formatCurrency(value: number | null | undefined) {
  return value == null ? '—' : currency.format(value)
}

/** Short money for the sheet, as Jobs Management shows it: $4,213. */
function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return `$${Math.round(value).toLocaleString()}`
}

/** "10-27-2026, 2:05 PM" in the viewer's timezone, like the Last Synced line. */
function formatRefreshedAt(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  const date = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`
  return `${date}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

function StackCell({ top, bottom }: { top?: string; bottom?: string }) {
  return (
    <div className="jm-stack">
      <span className="jm-stack__val">{top ?? ''}</span>
      <span className="jm-stack__rule" />
      <span className="jm-stack__val">{bottom ?? ''}</span>
    </div>
  )
}

function SplitHeader({ top, bottom }: { top: string; bottom: string }) {
  return (
    <span className="jm-th-stack jm-th-stack--split">
      <span>{top}</span>
      <span className="jm-th-stack__rule" />
      <span>{bottom}</span>
    </span>
  )
}

export default function Revenue() {
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed()
  const [mode, setMode] = useState<PeriodMode>('monthly')
  const [anchor, setAnchor] = useState(() => new Date())
  // Inclusive "YYYY-MM-DD" range for the Custom Date tab.
  const [customRange, setCustomRange] = useState(() => {
    const [from, to] = periodBounds('monthly', new Date())
    return { from: toISO(from), to: toISO(to) }
  })
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<JobStatus | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('newest')
  const [limit, setLimit] = useState(10)
  const [zoom, setZoom] = useState(SHEET_ZOOM_DEFAULT)
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null)

  const {
    mainPaneRef,
    dayPaneRef,
    dayPaneWidth,
    leftCollapsed,
    syncVertical,
    toggleLeftCollapse,
    startPaneResize,
  } = useSplitSheet('rv_left_collapsed')

  // Debounce so a query key isn't swapped (and a request fired) per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(timer)
  }, [search])

  const todayIso = toISO(new Date())
  const bounds: [Date, Date] | null =
    mode === 'all'
      ? null
      : mode === 'custom'
        ? [fromISO(customRange.from), fromISO(customRange.to)]
        : periodBounds(mode, anchor)
  const fromIso = bounds ? toISO(bounds[0]) : null
  const toIso = bounds ? toISO(bounds[1]) : null
  // Today's period is the latest one with any revenue — later ones are empty.
  const isCurrentPeriod = toIso !== null && toIso >= todayIso

  // Any change to the period or filters snaps back to page 1 — the stored page
  // is keyed to them rather than reset in an effect.
  const filterKey = `${fromIso}|${toIso}|${debouncedSearch}|${statusFilter ?? ''}|${sortKey}|${limit}`
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 })
  const page = pageState.key === filterKey ? pageState.page : 1
  const setPage = (next: number) => setPageState({ key: filterKey, page: next })

  // The backend's own week/month/year periods are rolling 7/30/365-day
  // windows, so calendar periods are sent as an explicit custom range.
  const params: GetJobRevenueParams = {
    ...(fromIso && toIso ? { period: 'custom', from: fromIso, to: toIso } : { period: 'all' }),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    sortBy: sortKey,
    page,
    limit,
  }

  const revenueQuery = useJobRevenue(params)
  const data = revenueQuery.data
  const rows = useMemo(() => data?.jobs ?? [], [data])
  const summary = data?.summary
  const pagination = data?.pagination
  const totalPages = Math.max(pagination?.totalPages ?? 1, 1)
  const currentPage = pagination?.page ?? page
  const loading = revenueQuery.isPending
  const error = revenueQuery.error ? getErrorMessage(revenueQuery.error, 'Failed to load revenue data.') : ''
  const refreshedAt = data?.refreshedAt ? formatRefreshedAt(data.refreshedAt) : null

  const totalRevenue = summary?.totalRevenue ?? 0
  const totalWorkDays = summary?.totalWorkDayCount ?? 0
  const avgPerWorkDay = totalWorkDays > 0 ? totalRevenue / totalWorkDays : null
  const hasActiveFilters = Boolean(search.trim()) || statusFilter !== null
  const rangeText = bounds && mode !== 'all' ? periodLabel(mode, bounds) : null

  /** Each job's revenueByDate keyed by "YYYY-MM-DD" for O(1) lookup per day column. */
  const revenueByJobDay = useMemo(
    () => new Map(rows.map((row) => [row._id, new Map(row.revenueByDate.map((d) => [d.date, d.revenue]))])),
    [rows],
  )

  // The day strip is the selected period. All Time has no bounds of its own,
  // so it runs from the earliest worked day on this page up to today.
  const days = useMemo(() => {
    if (fromIso && toIso) return daysBetween(fromISO(fromIso), fromISO(toIso))
    let first: string | null = null
    for (const row of rows) {
      const day = row.revenueByDate[0]?.date
      if (day && (!first || day < first)) first = day
    }
    if (!first) return []
    const last = first > todayIso ? first : todayIso
    return daysBetween(fromISO(first), fromISO(last))
  }, [fromIso, toIso, rows, todayIso])

  const mainTableRef = useRef<HTMLTableElement>(null)
  // [0] is the header row; job i is at [i + 1].
  const rowHeights = useSyncedRowHeights(mainTableRef, [rows, zoom, loading])

  // A month or a year of columns opens on its first day; when today is in the
  // strip, park it a little in from the left edge instead. Redone whenever the
  // period changes, since the strip is a new set of days.
  const scrolledForRef = useRef<string | null>(null)
  const stripKey = `${mode}|${fromIso}|${toIso}`
  useLayoutEffect(() => {
    if (scrolledForRef.current === stripKey || loading || days.length === 0) return
    const pane = dayPaneRef.current
    if (!pane) return
    scrolledForRef.current = stripKey
    const column = pane.querySelector<HTMLElement>('thead .jm-day-col.is-today')
    if (!column) {
      pane.scrollLeft = 0
      return
    }
    const paneRect = pane.getBoundingClientRect()
    const columnRect = column.getBoundingClientRect()
    pane.scrollLeft = Math.max(0, pane.scrollLeft + columnRect.left - paneRect.left - columnRect.width)
  }, [stripKey, loading, days.length, dayPaneRef])

  function changeMode(next: PeriodMode) {
    // Custom Date opens on whatever period was being viewed, so it starts as
    // a tweak of that rather than from scratch.
    if (next === 'custom' && mode !== 'custom' && fromIso && toIso) {
      setCustomRange({ from: fromIso, to: toIso })
    }
    setMode(next)
    setAnchor(new Date())
  }

  // A start after the end (or the reverse) drags the other bound along, so the
  // range sent is never inverted.
  function setCustomFrom(from: string) {
    setCustomRange((r) => ({ from, to: from > r.to ? from : r.to }))
  }

  function setCustomTo(to: string) {
    setCustomRange((r) => ({ from: to < r.from ? to : r.from, to }))
  }

  function clearFilters() {
    setSearch('')
    setDebouncedSearch('')
    setStatusFilter(null)
  }

  const emptyMessage = hasActiveFilters
    ? 'No jobs match your search and filters'
    : rangeText
      ? `No work logged in ${rangeText}`
      : 'No work logged yet'

  return (
    <div className="dash">
      <Sidebar active="Revenue" collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />

      <main className="dash__main jm-main rv-main">
        <div className="jm-header-row">
          <div>
            <h1 className="dash__title">Revenue &amp; Analytics</h1>
            <p className="dash__subtitle">Revenue earned per job from days worked on site</p>
          </div>
          <div className="page-header__right">
            <ZoomControl
              zoom={zoom}
              onZoomIn={() => setZoom((z) => stepSheetZoom(z, 1))}
              onZoomOut={() => setZoom((z) => stepSheetZoom(z, -1))}
            />
          </div>
        </div>

        <div className="ct-toolbar">
          <div className="ct-view-toggle" role="tablist" aria-label="Revenue period">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={mode === option.id}
                className={mode === option.id ? 'is-active' : ''}
                onClick={() => changeMode(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {mode === 'custom' && (
            <div className="rv-period-nav">
              <DateField
                label="From date"
                value={customRange.from}
                max={customRange.to}
                onChange={setCustomFrom}
              />
              <span className="ct-range-sep">TO</span>
              <DateField label="To date" value={customRange.to} min={customRange.from} onChange={setCustomTo} />
            </div>
          )}

          {mode !== 'all' && mode !== 'custom' && (
            <div className="rv-period-nav">
              <button
                type="button"
                className="icon-btn icon-btn--bordered ct-nav-btn"
                onClick={() => setAnchor((a) => shiftAnchor(mode, a, -1))}
                aria-label={`Previous ${PERIOD_NOUN[mode]}`}
              >
                <CaretLeft size={16} weight="bold" />
              </button>
              <span className="rv-period-label">{rangeText}</span>
              <button
                type="button"
                className="icon-btn icon-btn--bordered ct-nav-btn"
                onClick={() => setAnchor((a) => shiftAnchor(mode, a, 1))}
                disabled={isCurrentPeriod}
                aria-label={`Next ${PERIOD_NOUN[mode]}`}
              >
                <CaretRight size={16} weight="bold" />
              </button>
              {!isCurrentPeriod && (
                <button type="button" className="rv-today-btn" onClick={() => setAnchor(new Date())}>
                  This {PERIOD_NOUN[mode]}
                </button>
              )}
            </div>
          )}

          <label className="ct-search-inline">
            <MagnifyingGlass size={16} weight="regular" />
            <input placeholder="Search job name or #..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>

          <div className="ct-toolbar__end">
            <div className="ct-dd rv-dd">
              <Dropdown
                value={statusFilter ?? '__all'}
                selectedLabel={statusFilter ? STATUS_LABELS[statusFilter] : 'All Statuses'}
                onChange={(v) => setStatusFilter(v === '__all' ? null : (v as JobStatus))}
                options={[{ id: '__all', label: 'All Statuses' }, ...STATUS_OPTIONS]}
              />
            </div>
            <div className="ct-dd rv-dd">
              <Dropdown
                value={sortKey}
                selectedLabel={SORT_OPTIONS.find((s) => s.id === sortKey)?.label}
                onChange={(v) => setSortKey(v as SortKey)}
                options={SORT_OPTIONS}
              />
            </div>
          </div>
        </div>

        <div className="stat-grid ct-stats-grid rv-stats-grid">
          <div className="stat-card">
            <div className="stat-card__head">
              <span className="stat-card__label">Total Revenue</span>
            </div>
            <div className="stat-card__value">{formatCurrency(totalRevenue)}</div>
            <span className="stat-card__sub">{rangeText ?? 'All time'}</span>
          </div>
          <div className="stat-card">
            <div className="stat-card__head">
              <span className="stat-card__label">Jobs Earning Revenue</span>
            </div>
            <div className="stat-card__value">
              {(summary?.jobsWithRevenue ?? 0).toLocaleString()}
              <span className="rv-stat-of"> / {(summary?.jobCount ?? 0).toLocaleString()}</span>
            </div>
            <span className="stat-card__sub">Of the jobs worked in this period</span>
          </div>
          <div className="stat-card">
            <div className="stat-card__head">
              <span className="stat-card__label">Avg. Revenue / Work Day</span>
            </div>
            <div className="stat-card__value">{formatCurrency(avgPerWorkDay)}</div>
            <span className="stat-card__sub">Total revenue ÷ work days</span>
          </div>
        </div>

        {error && <div style={{ color: '#ef4444', margin: '12px 0', fontSize: '14px' }}>{error}</div>}

        <p className="last-synced">
          Work days updated : <span className="last-synced__time">{refreshedAt ?? (loading ? '…' : '-')}</span>
          <span className="rv-refresh-note"> · refreshed hourly</span>
        </p>

        <div className="jm-sheet" style={sheetZoomStyle(zoom)}>
          <div
            className={`jm-table-wrap jm-pane--main${leftCollapsed ? ' is-collapsed' : ''}`}
            style={
              leftCollapsed
                ? { width: 'var(--jm-name-w)' }
                : { width: `calc(100% - ${dayPaneWidth}px - 14px)` }
            }
            ref={mainPaneRef}
            onScroll={() => syncVertical('main')}
          >
            <div className="jm-table-zoom" style={sheetZoomStyle(zoom)}>
              <table className="jm-table" ref={mainTableRef}>
                <colgroup>
                  <col className="jm-col-name-w" />
                  <col className="jm-col-xs" />
                  <col className="jm-col-md" />
                  <col className="jm-col-stack" />
                  <col className="jm-col-stack" />
                  <col className="jm-col-stack-lg" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="jm-sticky jm-sticky--name">Job Name</th>
                    <th>Job #</th>
                    <th className="jm-center">Status</th>
                    <th className="jm-center">
                      <SplitHeader top="Contract Amt" bottom="Budgeted Days" />
                    </th>
                    <th className="jm-center">
                      <SplitHeader top="Current Rate / Day" bottom="Work Days" />
                    </th>
                    <th className="jm-center">
                      <SplitHeader top="Revenue" bottom="Share of Total" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading || rows.length === 0 ? (
                    <tr>
                      <td colSpan={COLUMN_COUNT} className="crew-empty-cell rv-empty-cell">
                        {loading ? (
                          'Loading revenue...'
                        ) : (
                          <>
                            {emptyMessage}
                            {hasActiveFilters && (
                              <button type="button" className="rv-today-btn" onClick={clearFilters}>
                                Clear filters
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const status = row.status as JobStatus | null
                      const statusColor = status ? STATUS_COLORS[status] : undefined
                      const share = row.revenue && totalRevenue > 0 ? (row.revenue / totalRevenue) * 100 : null
                      return (
                        <tr
                          key={row._id}
                          className={`jm-row${selectedRowId === row._id ? ' is-selected' : ''}${hoveredRowId === row._id ? ' is-hovered' : ''}`}
                          onClick={() => setSelectedRowId((prev) => (prev === row._id ? null : row._id))}
                          onMouseEnter={() => setHoveredRowId(row._id)}
                          onMouseLeave={() => setHoveredRowId(null)}
                        >
                          <td className="jm-name-cell jm-sticky jm-sticky--name">
                            <span className="jm-name-inner" title={row.name ?? undefined}>
                              <span>{row.name || 'Unnamed Job'}</span>
                            </span>
                          </td>
                          <td>{row.jobIdNumber != null ? String(row.jobIdNumber).padStart(3, '0') : ''}</td>
                          <td className="jm-center">
                            {status && statusColor && (
                              <span className="jm-status rv-status" style={{ color: statusColor, borderColor: statusColor }}>
                                {STATUS_LABELS[status]}
                              </span>
                            )}
                          </td>
                          <td
                            className="jm-center"
                            title={
                              row.revisedContractAmount != null && row.revisedContractAmount !== row.contractAmount
                                ? `Original ${money(row.contractAmount)}, revised by change orders`
                                : undefined
                            }
                          >
                            <StackCell
                              top={money(row.revisedContractAmount ?? row.contractAmount)}
                              bottom={row.budgetedDays == null ? '' : String(row.budgetedDays)}
                            />
                          </td>
                          <td className="jm-center">
                            <StackCell top={money(row.revenuePerDay)} bottom={String(row.workDayCount)} />
                          </td>
                          <td
                            className="jm-center rv-revenue"
                            title={
                              row.revenuePerDay === null
                                ? 'Set a contract amount and budgeted days to calculate revenue'
                                : undefined
                            }
                          >
                            <StackCell
                              top={row.revenuePerDay === null ? 'Not set' : money(row.revenue)}
                              bottom={share === null ? '' : `${share.toFixed(1)}%`}
                            />
                          </td>
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
              {leftCollapsed ? <CaretRight size={13} weight="bold" /> : <CaretLeft size={13} weight="bold" />}
            </div>
            <span className="jm-grip" />
          </div>

          {/* Its own scroller: panning the day strip sideways leaves the job
              columns where they are. Only vertical scroll is shared. */}
          <div
            className={`jm-table-wrap jm-pane--days${leftCollapsed ? ' is-expanded' : ''}`}
            style={
              leftCollapsed
                ? { width: 'calc(100% - var(--jm-name-w) - 14px)' }
                : { width: `${dayPaneWidth}px` }
            }
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
                      const isToday = toISO(d) === todayIso
                      return (
                        <th key={`h-d-${d.getTime()}`} className={`jm-center jm-day-col${isToday ? ' is-today' : ''}`}>
                          <span className="jm-th-stack">
                            <span>{isToday ? `Today, ${WEEKDAY_SHORT[d.getDay()]}` : WEEKDAY_SHORT[d.getDay()]}</span>
                            <span className="jm-day-col__date">{shortDate(d)}</span>
                          </span>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {loading || rows.length === 0 ? (
                    <tr style={rowHeights[1] ? { height: `${rowHeights[1]}px` } : undefined}>
                      <td colSpan={Math.max(days.length, 1)} className="crew-empty-cell" />
                    </tr>
                  ) : (
                    rows.map((row, rowIndex) => {
                      const byDay = revenueByJobDay.get(row._id)
                      return (
                        <tr
                          key={row._id}
                          className={`jm-row${selectedRowId === row._id ? ' is-selected' : ''}${hoveredRowId === row._id ? ' is-hovered' : ''}`}
                          style={rowHeights[rowIndex + 1] ? { height: `${rowHeights[rowIndex + 1]}px` } : undefined}
                          onClick={() => setSelectedRowId((prev) => (prev === row._id ? null : row._id))}
                          onMouseEnter={() => setHoveredRowId(row._id)}
                          onMouseLeave={() => setHoveredRowId(null)}
                        >
                          {days.map((d) => {
                            const iso = toISO(d)
                            const worked = byDay?.has(iso) ?? false
                            const revenue = byDay?.get(iso) ?? null
                            return (
                              <td
                                key={`${row._id}-d-${d.getTime()}`}
                                className={`jm-center jm-day-col${iso === todayIso ? ' is-today' : ''}`}
                              >
                                {worked &&
                                  (revenue === null ? (
                                    <span className="jm-day-cost rv-day-unpriced" title="Worked — no revenue rate set">
                                      Worked
                                    </span>
                                  ) : (
                                    <span className="jm-day-cost">{money(revenue)}</span>
                                  ))}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })
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
              onChange={(v) => setLimit(Number(v))}
              options={[
                { id: '5', label: '5 per page' },
                { id: '10', label: '10 per page' },
              ]}
            />
          </div>

          <div className="jm-pagination-controls">
            <span className="jm-pagination-info">
              Page {currentPage} of {totalPages}
              {pagination ? ` · ${pagination.totalCount} Jobs` : ''}
            </span>
            <div className="jm-pagination-btns">
              <button
                type="button"
                className="btn btn--outline jm-page-btn"
                disabled={loading || currentPage <= 1}
                onClick={() => setPage(Math.max(1, currentPage - 1))}
              >
                <CaretLeft size={16} /> Previous
              </button>
              <button
                type="button"
                className="btn btn--outline jm-page-btn"
                disabled={loading || currentPage >= totalPages}
                onClick={() => setPage(currentPage + 1)}
              >
                Next <CaretRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
