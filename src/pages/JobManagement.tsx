import { useRef, useState } from 'react'
import { MagnifyingGlass, Plus, CaretDown } from '@phosphor-icons/react'
import Sidebar from '../components/dashboard/Sidebar'
import Topbar from '../components/dashboard/Topbar'
import Dropdown from '../components/dashboard/Dropdown'
import Avatar from '../components/dashboard/Avatar'
import ZoomControl from '../components/dashboard/ZoomControl'
import CreateJobModal, { type JobFormData } from '../components/dashboard/CreateJobModal'
import JobDetailsModal from '../components/dashboard/JobDetailsModal'
import AssignCrewModal from '../components/dashboard/AssignCrewModal'
import { Icon } from '../components/dashboard/icons'
import { assignableCrews, formatMoney, type Job, type UnassignedCrew } from '../lib/dashboardData'
import { initialManagedJobs, STATUS_COLORS, STATUS_LABELS, type JobStatus, type ManagedJob } from '../lib/jobsManagementData'
import { useClickDragScroll } from '../hooks/useClickDragScroll'
import { SHEET_ZOOM_DEFAULT, sheetZoomStyle, stepSheetZoom } from '../lib/sheetZoom'
import { useAppStore } from '../lib/store'
import './JobsManagement.css'

type SortKey = 'newest' | 'oldest' | 'rateLowHigh' | 'rateHighLow' | 'workers' | 'ascending' | 'descending'
type Row = ManagedJob & { seq: number; note?: string }

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

let nextSeq = initialManagedJobs.length + 1

function toJob(row: Row): Job {
  const num = row.id.replace('#', '')
  return {
    id: row.id,
    name: row.name,
    color: crewBarColor(row.crewName, row.color),
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

/** Color bar + legend must use the assigned crew's color, not a stale job color. */
function crewBarColor(crewName: string | undefined, fallback: string) {
  if (!crewName || crewName === 'Unassigned') return fallback
  return assignableCrews.find((c) => c.name === crewName)?.color ?? fallback
}

export default function JobsManagement() {
  const [jobs, setJobs] = useState<Row[]>(
    initialManagedJobs.map((j, i) => ({
      ...j,
      color: crewBarColor(j.crewName, j.color),
      seq: i + 1,
      note: i === 0 ? 'Coordinate with suppliers and schedule weekly progress meetings.' : undefined,
    })),
  )
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<JobStatus | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('newest')
  const [selected, setSelected] = useState<string[]>([])
  const [zoom, setZoom] = useState(SHEET_ZOOM_DEFAULT)
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [flow, setFlow] = useState<Flow>({ type: 'none' })
  const tableWrapRef = useRef<HTMLDivElement>(null)
  useClickDragScroll(tableWrapRef)
  const [crewHover, setCrewHover] = useState<{ x: number; y: number; color: string; names: string[] } | null>(null)
  const { assignCrew } = useAppStore()

  let list = jobs.filter((j) => {
    const matchesSearch = !search || j.name.toLowerCase().includes(search.toLowerCase()) || j.id.includes(search)
    const matchesStatus = !statusFilter || j.status === statusFilter
    return matchesSearch && matchesStatus
  })

  list = [...list].sort((a, b) => {
    switch (sortKey) {
      case 'newest':
        return b.seq - a.seq
      case 'oldest':
        return a.seq - b.seq
      case 'rateLowHigh':
        return a.crewRate - b.crewRate
      case 'rateHighLow':
        return b.crewRate - a.crewRate
      case 'workers':
        return b.workers - a.workers
      case 'ascending':
        return a.name.localeCompare(b.name)
      case 'descending':
        return b.name.localeCompare(a.name)
      default:
        return 0
    }
  })

  const allSelected = list.length > 0 && list.every((j) => selected.includes(j.id))
  const editingJob = editingId ? jobs.find((j) => j.id === editingId) : undefined
  const activeRow = flow.type !== 'none' ? jobs.find((j) => j.id === flow.jobId) : undefined

  function toggleAll() {
    setSelected(allSelected ? [] : list.map((j) => j.id))
  }

  function toggleOne(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function handleCreate(data: JobFormData) {
    const lead = assignableCrews.find((c) => c.id === data.crewLeadId) ?? null
    const seq = nextSeq++
    const newJob: ManagedJob = {
      id: `#${String(seq).padStart(3, '0')}`,
      name: data.name,
      color: data.color,
      crewName: lead?.name ?? 'Unassigned',
      gc: data.gc,
      gcSuper: '-',
      idsSuper: '-',
      contract: data.contractAmount,
      startDate: data.startDate,
      endDate: data.endDate,
      status: 'awarded',
      laborBudgetUsed: 0,
      laborBudgetTotal: data.laborBudgetTotal,
      crewRate: lead?.rate ?? 0,
      workers: 1,
    }
    setJobs((prev) => [{ ...newJob, seq }, ...prev])
    setShowCreate(false)
    setSortKey('newest')
  }

  function handleUpdate(data: JobFormData) {
    if (!editingId) return
    setJobs((prev) =>
      prev.map((j) =>
        j.id === editingId
          ? { ...j, name: data.name, gc: data.gc, color: data.color, contract: data.contractAmount, laborBudgetTotal: data.laborBudgetTotal, startDate: data.startDate, endDate: data.endDate }
          : j,
      ),
    )
    setEditingId(null)
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
            {assignableCrews.map((crew) => (
              <span key={crew.id} className="sb-legend__item">
                <i style={{ background: crew.color }} />
                {crew.name}
              </span>
            ))}
          </div>
        </div>

        <div className="jm-toolbar">
          <label className="jm-search">
            <MagnifyingGlass size={16} weight="regular" />
            <input placeholder="Search a job..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>

          <span className="jm-count">{jobs.length} Total Jobs</span>

          <div className="jm-toolbar__right">
            <div className="jm-dd jm-dd--status">
              <Dropdown
                value={statusFilter ?? '__all'}
                staticLabel="Status"
                onChange={(v) => setStatusFilter(v === '__all' ? null : (v as JobStatus))}
                options={[{ id: '__all', label: 'All' }, ...STATUS_OPTIONS.map((s) => ({ id: s.id, label: s.label }))]}
              />
            </div>
            <div className="jm-dd jm-dd--sort">
              <Dropdown
                value={sortKey}
                staticLabel="Sort by"
                onChange={(v) => setSortKey(v as SortKey)}
                options={SORT_OPTIONS.map((s) => ({ id: s.id, label: s.label }))}
              />
            </div>
            <button type="button" className="btn btn--primary jm-create-btn" onClick={() => setShowCreate(true)}>
              <Plus size={16} weight="bold" />
              Create Job
            </button>
          </div>
        </div>

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
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} />
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
                  <span className="jm-th-sort">
                    Status
                    <CaretDown size={12} weight="bold" />
                  </span>
                </th>
                <th className="jm-center">Labor Budget</th>
                <th className="jm-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {list.map((job) => {
                const overBudget = job.laborBudgetUsed > job.laborBudgetTotal
                const pct = Math.min(100, Math.round((job.laborBudgetUsed / Math.max(1, job.laborBudgetTotal)) * 100))
                const barColor = overBudget ? '#ef4444' : job.status === 'awarded' ? '#f97316' : '#22c55e'
                const barPct = overBudget ? 100 : Math.max(8, pct)
                const stripeColor = crewBarColor(job.crewName, job.color)
                return (
                  <tr key={job.id} className="jm-row">
                    <td className="jm-sticky jm-sticky--id">
                      <div className="jm-id-cell">
                        <input
                          type="checkbox"
                          checked={selected.includes(job.id)}
                          onChange={() => toggleOne(job.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="jm-id">{job.id}</span>
                      </div>
                      <span
                        className="jm-color-bar-hit"
                        onMouseEnter={(e) => {
                          if (!job.crewName || job.crewName === 'Unassigned') return
                          const rect = e.currentTarget.getBoundingClientRect()
                          setCrewHover({
                            x: rect.right + 8,
                            y: rect.top + rect.height / 2,
                            color: stripeColor,
                            names: [job.crewName],
                          })
                        }}
                        onMouseLeave={() => setCrewHover(null)}
                      >
                        <span className="jm-color-bar" style={{ background: stripeColor }} />
                      </span>
                    </td>
                    <td className="jm-name-cell jm-sticky jm-sticky--name">
                      <button
                        type="button"
                        className="jm-name-btn"
                        onClick={() => setFlow({ type: 'details', jobId: job.id })}
                      >
                        <span className="jm-name-inner">
                          <span>{job.name}</span>
                          <Icon.ChevronRight width={14} height={14} />
                        </span>
                      </button>
                    </td>
                    <td className="jm-crew-cell">
                      <span className="jm-crew">
                        <Avatar
                          name={job.crewName}
                          src={assignableCrews.find((c) => c.name === job.crewName)?.avatar}
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
                      <span
                        className="jm-status"
                        style={{
                          color: STATUS_COLORS[job.status],
                          borderColor: STATUS_COLORS[job.status],
                        }}
                      >
                        {STATUS_LABELS[job.status]}
                      </span>
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
                      <button
                        type="button"
                        className="jm-action-btn"
                        onClick={() => setEditingId(job.id)}
                        aria-label="Edit job"
                      >
                        <Icon.Edit width={16} height={16} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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
          onDone={() => setFlow({ type: 'none' })}
          onChangeCrew={() => setFlow({ type: 'assignCrew', jobId: activeRow.id })}
          onSaveNote={(text) =>
            setJobs((prev) => prev.map((j) => (j.id === activeRow.id ? { ...j, note: text || undefined } : j)))
          }
          onRemoveCrew={() => {
            setJobs((prev) =>
              prev.map((j) =>
                j.id === activeRow.id ? { ...j, crewName: 'Unassigned', crewRate: 0, note: undefined } : j,
              ),
            )
            setFlow({ type: 'none' })
          }}
        />
      )}

      {flow.type === 'assignCrew' && activeRow && (
        <AssignCrewModal
          job={toJob(activeRow)}
          onCancel={() => setFlow({ type: 'details', jobId: activeRow.id })}
          onAssign={(crewId, startDate, endDate, note) => {
            const crew = assignableCrews.find((c) => c.id === crewId)
            if (!crew) return
            
            // This will throw if there's an overlap
            assignCrew(activeRow.id, crewId, startDate, endDate, note)
            
            setJobs((prev) =>
              prev.map((j) =>
                j.id === activeRow.id
                  ? { ...j, crewName: crew.name, crewRate: crew.rate, color: crew.color, note: note || j.note }
                  : j,
              ),
            )
            setFlow({ type: 'details', jobId: activeRow.id })
          }}
        />
      )}
    </div>
  )
}
