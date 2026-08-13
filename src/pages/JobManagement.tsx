import { useEffect, useMemo, useRef, useState } from 'react'
import { MagnifyingGlass, Plus, CaretLeft, CaretRight, CaretDown, PenIcon } from '@phosphor-icons/react'
import Sidebar from '../components/dashboard/Sidebar'
import Topbar from '../components/dashboard/Topbar'
import Dropdown from '../components/dashboard/Dropdown'
import Avatar from '../components/dashboard/Avatar'
import ZoomControl from '../components/dashboard/ZoomControl'
import CreateJobModal, { type JobFormData } from '../components/dashboard/CreateJobModal'
import JobDetailsModal from '../components/dashboard/JobDetailsModal'
import AssignCrewModal from '../components/dashboard/AssignCrewModal'
import { assignableCrews, formatMoney, type Job, type UnassignedCrew } from '../lib/dashboardData'
import { STATUS_COLORS, STATUS_LABELS, type JobStatus, type ManagedJob } from '../lib/jobsManagementData'
import { useClickDragScroll } from '../hooks/useClickDragScroll'
import { SHEET_ZOOM_DEFAULT, sheetZoomStyle, stepSheetZoom } from '../lib/sheetZoom'
import { useAppStore } from '../lib/store'
import { type JobItem } from '../api/jobApi'
import { type UserItem } from '../api/crewApi'
import { crewColorFor } from '../lib/scheduleData'
import { getErrorMessage } from '../lib/errors'
import { useCrewsSummary, useJobsPaged, useJobMutations } from '../hooks/useQueryHooks'
import { TableRowSkeleton } from '../components/common/Shimmer'
import './JobsManagement.css'

type SortKey = 'newest' | 'oldest' | 'rateLowHigh' | 'rateHighLow' | 'workers' | 'ascending' | 'descending'
type Row = ManagedJob & { rawId: string; note?: string }

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
    bidNo: String(1000 + Number(num)),
    jobNo: num,
    gc: row.gc,
    estimator: row.idsSuper,
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
  let idsSuperVal = '-'
  if (j.idsSuper) {
    if (typeof j.idsSuper === 'object' && j.idsSuper !== null) {
      idsSuperVal = `${j.idsSuper.firstName || ''} ${j.idsSuper.lastName || ''}`.trim() || '-'
    } else if (typeof j.idsSuper === 'string') {
      idsSuperVal = j.idsSuper
    }
  } else if (leadName !== 'Unassigned') {
    idsSuperVal = leadName
  }

  return {
    id: `#${numStr}`,
    rawId: j._id,
    name: j.name,
    color: crewColor,
    crewName: crewObj ? crewObj.name : 'Unassigned',
    gc: j.generalContractor || '-',
    gcSuper: gcSuperVal,
    idsSuper: idsSuperVal,
    contract: j.contractAmount || 0,
    startDate: formattedStart,
    endDate: formattedEnd,
    status: normalizedStatus,
    laborBudgetUsed: j.laborBudgetUsed ?? 0,
    laborBudgetTotal: j.laborBudget || 0,
    crewRate: crewLeadObj?.hourlyRate || 0,
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

  const tableWrapRef = useRef<HTMLDivElement>(null)
  useClickDragScroll(tableWrapRef)
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
  const pagination = jobsQuery.data?.pagination ?? { page, limit, totalCount: 0, totalPages: 1 }
  const loading = jobsQuery.isPending
  const apiError =
    actionError || (jobsQuery.error ? getErrorMessage(jobsQuery.error, 'Failed to fetch jobs listing.') : '')

  const { updateJobMutation, deleteJobMutation, invalidateAll } = useJobMutations()


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
        <Topbar
          extra={
            <ZoomControl
              zoom={zoom}
              onZoomIn={() => setZoom((z) => stepSheetZoom(z, 1))}
              onZoomOut={() => setZoom((z) => stepSheetZoom(z, -1))}
            />
          }
        />

        <div className="jm-header-row">
          <div>
            <h1 className="dash__title">Jobs</h1>
            <p className="dash__subtitle">Master list of all projects</p>
          </div>
          <div className="sb-legend">
            {crewsList.map((crew) => (
              <span key={crew._id} className="sb-legend__item">
                <i style={{ background: crewColorFor(crew._id, crew.crewColor) }} />
                {crew.name}
              </span>
            ))}
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

        <div className="jm-table-wrap" ref={tableWrapRef}>
          <div className="jm-table-zoom" style={sheetZoomStyle(zoom)}>
          <table className="jm-table">
            <colgroup>
              <col className="jm-col-id-w" />
              <col className="jm-col-name-w" />
              <col />
              <col />
              <col />
              <col />
              <col />
              <col />
              <col />
              <col />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th className="jm-sticky jm-sticky--id">
                  <div className="jm-id-cell">
                    <span>Job ID</span>
                  </div>
                </th>
                <th className="jm-sticky jm-sticky--name">Job Name</th>
                <th>Crew Assigned</th>
                <th>GC</th>
                <th className="jm-center">GC Super</th>
                <th className="jm-center">IDS Super</th>
                <th className="jm-center">Contract</th>
                <th className="jm-center">Duration</th>
                <th className="jm-center">
                  {(pagination.totalCount || jobs.length > 0 || statusFilter !== null) ? (
                    <div style={{ display: 'inline-block', textAlign: 'left' }}>
                      <Dropdown
                        value={statusFilter ?? '__all'}
                        selectedLabel={statusFilter ? `${STATUS_OPTIONS.find((s) => s.id === statusFilter)?.label}` : 'Status'}
                        onChange={(v) => {
                          setStatusFilter(v === '__all' ? null : (v as JobStatus))
                          setPage(1)
                        }}
                        options={[{ id: '__all', label: 'All Statuses' }, ...STATUS_OPTIONS.map((s) => ({ id: s.id, label: s.label }))]}
                      />
                    </div>
                  ) : (
                    'Status'
                  )}
                </th>
                <th className="jm-center">Labor Budget</th>
                <th className="jm-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableRowSkeleton cols={11} rows={6} height="22px" />
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={11} className="crew-empty-cell" style={{ textAlign: 'center', padding: '32px 0' }}>
                    No jobs found
                  </td>
                </tr>
              ) : (
                jobs.map((job) => {
                  const overBudget = job.laborBudgetUsed > job.laborBudgetTotal
                  const pct = Math.min(100, Math.round((job.laborBudgetUsed / Math.max(1, job.laborBudgetTotal)) * 100))
                  const barColor = overBudget ? '#ef4444' : job.status === 'awarded' ? '#f97316' : '#22c55e'
                  const barPct = overBudget ? 100 : Math.max(8, pct)
                  const stripeColor = job.color
                  return (
                    <tr key={job.rawId || job.id} className="jm-row">
                      <td className="jm-sticky jm-sticky--id">
                        <div className="jm-id-cell">
                          <span className="jm-id">{job.id}</span>
                        </div>
                        <span
                          className="jm-color-bar-hit"
                          onMouseEnter={(e) => {
                            const isUnassigned = !job.crewName || job.crewName === 'Unassigned'
                            const rect = e.currentTarget.getBoundingClientRect()
                            setCrewHover({
                              x: rect.right + 8,
                              y: rect.top + rect.height / 2,
                              color: isUnassigned ? '#94a3b8' : stripeColor,
                              names: [isUnassigned ? 'Unassigned' : job.crewName],
                            })
                          }}
                          onMouseLeave={() => setCrewHover(null)}
                        >
                          <span className="jm-color-bar" style={{ background: !job.crewName || job.crewName === 'Unassigned' ? '#94a3b8' : stripeColor }} />
                        </span>
                      </td>
                      <td className="jm-name-cell jm-sticky jm-sticky--name">
                        <button
                          type="button"
                          className="jm-name-btn"
                          onClick={() => setFlow({ type: 'details', jobId: job.rawId || job.id })}
                        >
                          <span className="jm-name-inner">
                            <span>{job.name}</span>
                          </span>
                        </button>
                      </td>
                      <td className="jm-crew-cell">
                        <span className="jm-crew">
                          <Avatar
                            name={job.crewName}
                            background={!job.crewName || job.crewName === 'Unassigned' ? '#94a3b8' : stripeColor}
                            size={24}
                          />
                          {job.crewName}
                        </span>
                      </td>
                      <td>{job.gc}</td>
                      <td className="jm-center">{job.gcSuper}</td>
                      <td className="jm-center">{job.idsSuper}</td>
                      <td className="jm-center jm-contract">${job.contract.toLocaleString('en-US')}</td>
                      <td className="jm-center jm-duration">
                        <div>{job.startDate}</div>
                        <div>{job.endDate}</div>
                      </td>
                      <td className="jm-center">
                        <div className="jm-status-dropdown" style={{ display: 'inline-block', textAlign: 'left' }}>
                          <Dropdown
                            value={job.status}
                            selectedLabel={
                              <span
                                className="jm-status"
                                style={{
                                  color: STATUS_COLORS[job.status] || '#16a34a',
                                  backgroundColor: `${STATUS_COLORS[job.status] || '#16a34a'}18`,
                                }}
                              >
                                {STATUS_LABELS[job.status] || job.status}
                                <CaretDown size={12} weight="bold" style={{ opacity: 0.8 }} />
                              </span>
                            }
                            onChange={(v) => handleStatusChange(job.rawId || job.id, v as JobStatus)}
                            options={STATUS_OPTIONS.map((s) => ({ id: s.id, label: s.label }))}
                          />
                        </div>
                      </td>
                      <td className="jm-center">
                        <div className="jm-labor">
                          <div className="jm-labor__label">
                            {overBudget && <span className="jm-labor__badge">!</span>}
                            <span className={overBudget ? 'jm-labor__text jm-labor__text--danger' : 'jm-labor__text'}>
                              {formatMoney(job.laborBudgetUsed)}/{formatMoney(job.laborBudgetTotal)}
                            </span>
                          </div>
                          <span className="jm-labor__bar">
                            <span className="jm-labor__fill" style={{ width: `${barPct}%`, background: barColor }} />
                          </span>
                        </div>
                      </td>
                      <td className="jm-center">
                        <div className="jm-action-cell">
                          <button
                            type="button"
                            className="btn btn--primary"
                            onClick={() => setEditingId(job.id)}
                            aria-label={`Edit job ${job.name}`}
                          >
                            <PenIcon size={16} />
                            <p>Edit</p>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
          </div>
        </div>

        <div className="jm-pagination-bar">
          <div className="jm-pagination-limit">
            <span>Show:</span>
            <Dropdown
              direction="up"
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
          onDone={() => setFlow({ type: 'none' })}
          onChangeCrew={() => setFlow({ type: 'assignCrew', jobId: activeRow.rawId || activeRow.id })}
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
