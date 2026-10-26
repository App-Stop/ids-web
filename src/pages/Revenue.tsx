import { useEffect, useState } from 'react'
import { MagnifyingGlass, CaretLeft, CaretRight, ChartLineUp } from '@phosphor-icons/react'
import Sidebar from '../components/dashboard/Sidebar'
import Dropdown from '../components/dashboard/Dropdown'
import { useSidebarCollapsed } from '../hooks/useSidebarCollapsed'
import { useJobRevenue } from '../hooks/useQueryHooks'
import { getErrorMessage } from '../lib/errors'
import type { GetJobRevenueParams } from '../api/jobApi'
import { addDays, getMonday, toISO } from '../lib/scheduleData'
import { STATUS_COLORS, STATUS_LABELS, type JobStatus } from '../lib/jobsManagementData'
import './Dashboard.css'
import './JobsManagement.css'
import './CostTracking.css'
import './Revenue.css'

type PeriodMode = 'weekly' | 'monthly' | 'yearly' | 'all'
type SortKey = NonNullable<GetJobRevenueParams['sortBy']>

const PERIOD_OPTIONS: { id: PeriodMode; label: string }[] = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
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

const PERIOD_NOUN: Record<Exclude<PeriodMode, 'all'>, string> = {
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
}

/** First and last day of the calendar week/month/year containing `anchor`. */
function periodBounds(mode: Exclude<PeriodMode, 'all'>, anchor: Date): [Date, Date] {
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
function shiftAnchor(mode: Exclude<PeriodMode, 'all'>, anchor: Date, dir: 1 | -1) {
  if (mode === 'weekly') return addDays(anchor, 7 * dir)
  if (mode === 'monthly') return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1)
  return new Date(anchor.getFullYear() + dir, 0, 1)
}

function periodLabel(mode: Exclude<PeriodMode, 'all'>, [from, to]: [Date, Date]) {
  if (mode === 'yearly') return String(from.getFullYear())
  if (mode === 'monthly') return from.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(from)} - ${fmt(to)}, ${to.getFullYear()}`
}

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatCurrency(value: number | null | undefined) {
  return value == null ? '—' : currency.format(value)
}

/** "10-27-2026, 2:05 PM" in the viewer's timezone, like the Last Synced line. */
function formatRefreshedAt(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  const date = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`
  return `${date}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

export default function Revenue() {
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed()
  const [mode, setMode] = useState<PeriodMode>('monthly')
  const [anchor, setAnchor] = useState(() => new Date())
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<JobStatus | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('newest')
  const [limit, setLimit] = useState(20)

  // Debounce so a query key isn't swapped (and a request fired) per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(timer)
  }, [search])

  const bounds = mode === 'all' ? null : periodBounds(mode, anchor)
  const fromIso = bounds ? toISO(bounds[0]) : null
  const toIso = bounds ? toISO(bounds[1]) : null
  // Today's period is the latest one with any revenue — later ones are empty.
  const isCurrentPeriod = toIso !== null && toIso >= toISO(new Date())

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
  const rows = data?.jobs ?? []
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
  const rangeText = bounds ? periodLabel(mode as Exclude<PeriodMode, 'all'>, bounds) : null

  function changeMode(next: PeriodMode) {
    setMode(next)
    setAnchor(new Date())
  }

  function clearFilters() {
    setSearch('')
    setDebouncedSearch('')
    setStatusFilter(null)
  }

  return (
    <div className="dash">
      <Sidebar active="Revenue" collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />

      <main className="dash__main ct-main">
        <div className="ct-head-row">
          <div>
            <h1 className="dash__title">Revenue &amp; Analytics</h1>
            <p className="dash__subtitle">Revenue earned per job from days worked on site</p>
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

          {mode !== 'all' && (
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

        <div className="stat-grid ct-stats-grid">
          <div className="stat-card">
            <div className="stat-card__head">
              <span className="stat-card__label">Total Revenue</span>
            </div>
            <div className="stat-card__value">{formatCurrency(totalRevenue)}</div>
            <span className="stat-card__sub">{rangeText ?? 'All time'}</span>
          </div>
          <div className="stat-card">
            <div className="stat-card__head">
              <span className="stat-card__label">Work Days</span>
            </div>
            <div className="stat-card__value">{totalWorkDays.toLocaleString()}</div>
            <span className="stat-card__sub">Days with crew time logged</span>
          </div>
          <div className="stat-card">
            <div className="stat-card__head">
              <span className="stat-card__label">Jobs Earning Revenue</span>
            </div>
            <div className="stat-card__value">
              {(summary?.jobsWithRevenue ?? 0).toLocaleString()}
              <span className="rv-stat-of"> / {(summary?.jobCount ?? 0).toLocaleString()}</span>
            </div>
            <span className="stat-card__sub">Of the jobs matching your filters</span>
          </div>
          <div className="stat-card">
            <div className="stat-card__head">
              <span className="stat-card__label">Avg. Revenue / Work Day</span>
            </div>
            <div className="stat-card__value">{formatCurrency(avgPerWorkDay)}</div>
            <span className="stat-card__sub">Total revenue ÷ work days</span>
          </div>
        </div>

        <p className="last-synced">
          Work days updated : <span className="last-synced__time">{refreshedAt ?? (loading ? '…' : '-')}</span>
          <span className="rv-refresh-note"> · refreshed hourly</span>
        </p>

        {error && <div style={{ color: '#ef4444', margin: '12px 0', fontSize: '14px' }}>{error}</div>}

        <div className={`rv-table-wrap${!loading && rows.length === 0 ? ' rv-table-wrap--empty' : ''}`}>
          {loading ? (
            <div className="ct-empty">
              <p className="ct-empty__text">Loading revenue data...</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="ct-empty">
              <span className="ct-empty__icon" aria-hidden>
                {hasActiveFilters ? <MagnifyingGlass size={26} /> : <ChartLineUp size={26} />}
              </span>
              <h3 className="ct-empty__title">No jobs to show</h3>
              <p className="ct-empty__text">
                {hasActiveFilters
                  ? 'Nothing matches your current search and filters. Clear them to see every job.'
                  : 'There are no jobs yet.'}
              </p>
              {hasActiveFilters && (
                <div className="ct-empty__actions">
                  <button type="button" className="btn btn--outline" onClick={clearFilters}>
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          ) : (
            <table className="ct-table ct-table--crew rv-table">
              <thead>
                <tr>
                  <th>Job #</th>
                  <th>Job Name</th>
                  <th>Status</th>
                  <th className="rv-num">Contract</th>
                  <th className="rv-num">Budgeted Days</th>
                  <th className="rv-num">Revenue / Day</th>
                  <th className="rv-num">Work Days</th>
                  <th className="rv-num">Revenue</th>
                  <th>Share of Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const status = row.status as JobStatus | null
                  const statusColor = status ? STATUS_COLORS[status] : undefined
                  const share = row.revenue && totalRevenue > 0 ? row.revenue / totalRevenue : 0
                  const missingRate = row.revenuePerDay === null
                  return (
                    <tr key={row._id}>
                      <td className="ct-id-cell">
                        {row.jobIdNumber != null ? `#${String(row.jobIdNumber).padStart(3, '0')}` : '—'}
                      </td>
                      <td className="rv-name-cell" title={row.name ?? undefined}>
                        {row.name || 'Unnamed Job'}
                      </td>
                      <td>
                        {status && statusColor ? (
                          <span className="jm-status rv-status" style={{ color: statusColor, borderColor: statusColor }}>
                            {STATUS_LABELS[status]}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="rv-num">{formatCurrency(row.contractAmount)}</td>
                      <td className="rv-num">{row.budgetedDays ?? '—'}</td>
                      <td className="rv-num">{formatCurrency(row.revenuePerDay)}</td>
                      <td className="rv-num">{row.workDayCount}</td>
                      <td
                        className="rv-num rv-revenue"
                        title={missingRate ? 'Set a contract amount and budgeted days to calculate revenue' : undefined}
                      >
                        {missingRate ? <span className="rv-missing">Not set</span> : formatCurrency(row.revenue)}
                      </td>
                      <td>
                        <div className="rv-share">
                          <span className="rv-share__track">
                            <span className="rv-share__fill" style={{ width: `${share * 100}%` }} />
                          </span>
                          <span className="rv-share__pct">{share > 0 ? `${(share * 100).toFixed(1)}%` : '—'}</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="jm-pagination-bar">
          <div className="jm-pagination-limit">
            <span>Show:</span>
            <Dropdown
              placement="top"
              value={String(limit)}
              onChange={(v) => setLimit(Number(v))}
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
