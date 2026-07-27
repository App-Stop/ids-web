import { useState } from 'react'
import Sidebar from '../components/dashboard/Sidebar'
import Topbar from '../components/dashboard/Topbar'
import Dropdown from '../components/dashboard/Dropdown'
import Avatar from '../components/dashboard/Avatar'
import ZoomControl from '../components/dashboard/ZoomControl'
import CreateJobModal, { type JobFormData } from '../components/dashboard/CreateJobModal'
import { Icon } from '../components/dashboard/icons'
import { crewLeads, formatMoney, type Job } from '../lib/dashboardData'
import { initialManagedJobs, STATUS_COLORS, STATUS_LABELS, type JobStatus, type ManagedJob } from '../lib/jobsManagementData'
import './JobsManagement.css'

type SortKey = 'newest' | 'oldest' | 'rateLowHigh' | 'rateHighLow' | 'workers' | 'ascending' | 'descending'
type Row = ManagedJob & { seq: number }

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
    color: row.color,
    bidNo: num,
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

export default function JobsManagement() {
  const [jobs, setJobs] = useState<Row[]>(initialManagedJobs.map((j, i) => ({ ...j, seq: i + 1 })))
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<JobStatus | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('newest')
  const [selected, setSelected] = useState<string[]>([])
  const [zoom, setZoom] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  let list = jobs.filter((j) => {
    const matchesSearch = !search || j.name.toLowerCase().includes(search.toLowerCase()) || j.id.includes(search)
    const matchesStatus = !statusFilter || j.status === statusFilter
    return matchesSearch && matchesStatus
  })

  list = [...list].sort((a, b) => {
    switch (sortKey) {
      case 'newest':
        return a.seq - b.seq
      case 'oldest':
        return b.seq - a.seq
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

  function toggleAll() {
    setSelected(allSelected ? [] : list.map((j) => j.id))
  }

  function toggleOne(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function handleCreate(data: JobFormData) {
    const lead = crewLeads.find((c) => c.id === data.crewLeadId)
    const seq = nextSeq++
    const newJob: ManagedJob = {
      id: `#${String(seq).padStart(3, '0')}`,
      name: data.name,
      color: data.color,
      crewName: lead ? `${lead.name}'s Crew` : 'Unassigned',
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
    setJobs((prev) => [...prev, { ...newJob, seq }])
    setShowCreate(false)
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

      <main className="dash__main">
        <Topbar
          onAddJob={() => setShowCreate(true)}
          onCreateCrew={() => {}}
          extra={
            <ZoomControl
              zoom={zoom}
              onZoomIn={() => setZoom((z) => Math.min(1.3, +(z + 0.1).toFixed(1)))}
              onZoomOut={() => setZoom((z) => Math.max(0.7, +(z - 0.1).toFixed(1)))}
            />
          }
        />

        <h1 className="dash__title">Jobs</h1>
        <p className="dash__subtitle">Master list of all projects</p>

        <div className="jm-toolbar">
          <label className="jm-search">
            <Icon.Search width={16} height={16} />
            <input placeholder="Search a job..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>

          <span className="jm-count">{jobs.length} Total Jobs</span>

          <div className="jm-toolbar__right">
            <Dropdown
              value={statusFilter ?? '__all'}
              staticLabel="Status"
              onChange={(v) => setStatusFilter(v === '__all' ? null : (v as JobStatus))}
              options={[{ id: '__all', label: 'All' }, ...STATUS_OPTIONS.map((s) => ({ id: s.id, label: s.label }))]}
            />
            <Dropdown
              value={sortKey}
              staticLabel="Sort by"
              onChange={(v) => setSortKey(v as SortKey)}
              options={SORT_OPTIONS.map((s) => ({ id: s.id, label: s.label }))}
            />
            <button type="button" className="btn btn--primary" onClick={() => setShowCreate(true)}>
              <Icon.Plus width={16} height={16} />
              Create Job
            </button>
          </div>
        </div>

        <div className="jm-table-wrap" style={{ zoom }}>
          <table className="jm-table">
            <thead>
              <tr>
                <th className="jm-col-check">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
                <th>Job ID</th>
                <th>Job Name</th>
                <th className="jm-col-bar" />
                <th>Crew Assigned</th>
                <th>GC</th>
                <th>GC Super</th>
                <th>IDS Super</th>
                <th>Contract</th>
                <th>Duration</th>
                <th>
                  <span className="jm-th-sort">
                    Status
                    <Icon.ChevronDown width={13} height={13} />
                  </span>
                </th>
                <th>Labor Budget</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {list.map((job) => {
                const overBudget = job.laborBudgetUsed > job.laborBudgetTotal
                const pct = Math.min(100, Math.round((job.laborBudgetUsed / job.laborBudgetTotal) * 100))
                const barColor = overBudget ? '#ef4444' : job.status === 'awarded' ? '#f97316' : '#22c55e'
                const barPct = overBudget || job.status === 'awarded' ? 100 : pct
                return (
                  <tr key={job.id}>
                    <td className="jm-col-check">
                      <input type="checkbox" checked={selected.includes(job.id)} onChange={() => toggleOne(job.id)} />
                    </td>
                    <td className="jm-id">{job.id}</td>
                    <td className="jm-name-cell">
                      <div className="jm-name-inner">
                        <span>{job.name}</span>
                        <Icon.ChevronRight width={14} height={14} />
                      </div>
                    </td>
                    <td className="jm-col-bar">
                      <span style={{ background: job.color }} />
                    </td>
                    <td>
                      <span className="jm-crew">
                        <Avatar name={job.crewName} size={24} />
                        {job.crewName}
                      </span>
                    </td>
                    <td>{job.gc}</td>
                    <td>{job.gcSuper}</td>
                    <td>{job.idsSuper}</td>
                    <td>${job.contract.toLocaleString('en-US')}</td>
                    <td className="jm-duration">
                      <div>{job.startDate}</div>
                      <div>{job.endDate}</div>
                    </td>
                    <td>
                      <span
                        className="jm-status"
                        style={{ color: STATUS_COLORS[job.status], borderColor: STATUS_COLORS[job.status], background: `${STATUS_COLORS[job.status]}1A` }}
                      >
                        {STATUS_LABELS[job.status]}
                      </span>
                    </td>
                    <td>
                      <div className="jm-labor">
                        <div className="jm-labor__label">
                          {overBudget && (
                            <span className="jm-labor__badge">
                              <Icon.AlertTriangle width={11} height={11} />
                            </span>
                          )}
                          <span className={overBudget ? 'jm-labor__text jm-labor__text--danger' : 'jm-labor__text'}>
                            {formatMoney(job.laborBudgetUsed)}/{formatMoney(job.laborBudgetTotal)}
                          </span>
                        </div>
                        <span className="jm-labor__bar">
                          <span className="jm-labor__fill" style={{ width: `${barPct}%`, background: barColor }} />
                        </span>
                      </div>
                    </td>
                    <td>
                      <button type="button" className="jm-action-btn" onClick={() => setEditingId(job.id)} aria-label="Edit job">
                        <Icon.Edit width={16} height={16} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </main>

      {showCreate && <CreateJobModal onCancel={() => setShowCreate(false)} onSubmit={handleCreate} />}
      {editingJob && <CreateJobModal job={toJob(editingJob)} onCancel={() => setEditingId(null)} onSubmit={handleUpdate} />}
    </div>
  )
}
