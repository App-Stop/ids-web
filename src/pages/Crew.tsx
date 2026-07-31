import { useMemo, useRef, useState } from 'react'
import { ArrowDown } from '@phosphor-icons/react'
import Sidebar from '../components/dashboard/Sidebar'
import Topbar from '../components/dashboard/Topbar'
import { Icon } from '../components/dashboard/icons'
import MenuDropdown from '../components/dashboard/MenuDropdown'
import AddNewModal from '../components/dashboard/AddNewModal'
import MultipleJobsModal from '../components/dashboard/MultipleJobsModal'
import MemberFormModal, { type MemberFormData } from '../components/dashboard/MemberFormModal'
// Reused as-is from the Dashboard page, per existing pattern.
import CreateCrewModal from '../components/dashboard/CreateCrewModal'
import AssignJobModal from '../components/dashboard/AssignJobModal'
import JobDetailsModal from '../components/dashboard/JobDetailsModal'
import AssignCrewModal from '../components/dashboard/AssignCrewModal'
import ZoomControl from '../components/dashboard/ZoomControl'
import { useClickDragScroll } from '../hooks/useClickDragScroll'
import { SHEET_ZOOM_DEFAULT, sheetZoomStyle, stepSheetZoom } from '../lib/sheetZoom'
import {
  assignableCrews,
  crewLeads,
  jobs as masterJobs,
  type Job,
  type UnassignedCrew,
} from '../lib/dashboardData'
import {
  crewRows as initialCrewRows,
  rosterRows as initialRosterRows,
  crewMenuOptions,
  jobMenuOptions,
  type CrewJobAssignment,
  type CrewRow,
  type RosterRow,
  type Status,
} from '../lib/crewData'
import './Crew.css'
import './Dashboard.css'

type Tab = 'crew' | 'roster'
type SortKey = 'name-asc' | 'name-desc' | 'rate-desc' | 'rate-asc'

const STATUS_OPTIONS = [
  { id: 'Active', label: 'Active' },
  { id: 'Inactive', label: 'Inactive' },
  { id: 'Unassigned', label: 'Unassigned' },
]

const SORT_OPTIONS = [
  { id: 'name-asc', label: 'Name (A-Z)' },
  { id: 'name-desc', label: 'Name (Z-A)' },
  { id: 'rate-desc', label: 'Rate (High-Low)' },
  { id: 'rate-asc', label: 'Rate (Low-High)' },
]

type Flow =
  | { type: 'none' }
  | { type: 'addNewChooser' }
  | { type: 'createCrew' }
  | { type: 'editCrew'; crew: CrewRow }
  | { type: 'addMember' }
  | { type: 'editMember'; member: RosterRow }
  | { type: 'multipleJobs'; crew: CrewRow }
  | { type: 'assignJob'; crew: CrewRow }
  | { type: 'viewJob'; crewId: string; jobIndex: number }
  | { type: 'assignCrew'; crewId: string; jobIndex: number }

function resolveJob(assignment: CrewJobAssignment, crew: CrewRow): Job {
  const match = masterJobs.find(
    (j) => j.name === assignment.jobName || (j.bidNo === assignment.bidNo && j.jobNo === assignment.jobNo),
  )
  if (match) return { ...match, color: crew.color }
  return {
    id: `crew-job-${assignment.bidNo}-${assignment.jobNo}`,
    name: assignment.jobName,
    color: crew.color,
    bidNo: assignment.bidNo,
    jobNo: assignment.jobNo,
    gc: '—',
    estimator: '—',
    startDate: assignment.date,
    endDate: assignment.date,
    contractAmount: 0,
    laborBudgetUsed: 0,
    laborBudgetTotal: 0,
  }
}

function toCrewLead(crew: CrewRow): UnassignedCrew {
  const match = assignableCrews.find((c) => c.name === crew.name)
  return {
    id: match?.id ?? crew.id,
    name: crew.name,
    leadName: match?.leadName ?? crew.name.replace(/'s Crew$/, ''),
    rate: crew.rate,
    avatar: crew.avatar || match?.avatar,
  }
}

function noteKey(crewId: string, assignment: CrewJobAssignment) {
  return `${crewId}:${assignment.bidNo}:${assignment.jobNo}`
}

function StatusPill({ status }: { status: Status }) {
  return <span className={`crew-status crew-status--${status.toLowerCase()}`}>{status}</span>
}

function JobNameTooltip({ names, x, y }: { names: string[]; x: number; y: number }) {
  return (
    <div className="crew-job-tooltip crew-job-tooltip--fixed" style={{ left: x, top: y }}>
      {names.map((name) => (
        <span key={name} className="crew-job-tooltip__item">
          {name}
        </span>
      ))}
    </div>
  )
}

export default function Crew() {
  const [tab, setTab] = useState<Tab>('crew')
  const [crewRows, setCrewRows] = useState(initialCrewRows)
  const [rosterRows, setRosterRows] = useState(initialRosterRows)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey | null>(null)
  const [jobFilter, setJobFilter] = useState<string | null>(null) // Crew tab
  const [crewFilter, setCrewFilter] = useState<string | null>(null) // Roster tab
  const [jobHover, setJobHover] = useState<{ x: number; y: number; names: string[] } | null>(null)
  const [crewHover, setCrewHover] = useState<{ x: number; y: number; color: string; names: string[] } | null>(null)
  const [jobNotes, setJobNotes] = useState<Record<string, string>>({
    'c8742:1042:001': 'Coordinate with suppliers and schedule weekly progress meetings.',
  })
  const [zoom, setZoom] = useState(SHEET_ZOOM_DEFAULT)
  const tableWrapRef = useRef<HTMLDivElement>(null)
  useClickDragScroll(tableWrapRef)

  const [flow, setFlow] = useState<Flow>({ type: 'none' })

  const activeCrew =
    flow.type === 'viewJob' || flow.type === 'assignCrew'
      ? crewRows.find((r) => r.id === flow.crewId)
      : undefined
  const activeAssignment =
    activeCrew && (flow.type === 'viewJob' || flow.type === 'assignCrew')
      ? activeCrew.jobs[flow.jobIndex]
      : undefined
  const activeJob = activeCrew && activeAssignment ? resolveJob(activeAssignment, activeCrew) : undefined
  const activeNote =
    activeCrew && activeAssignment ? (jobNotes[noteKey(activeCrew.id, activeAssignment)] ?? '') : ''

  const filteredCrewRows = useMemo(() => {
    let rows = crewRows.filter((r) => {
      const matchesSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.crewId.includes(search)
      const matchesStatus = !status || r.status === status
      const jobLabel = jobMenuOptions.find((j) => j.id === jobFilter)?.label
      const matchesJob = !jobLabel || r.jobs.some((j) => j.jobName === jobLabel)
      return matchesSearch && matchesStatus && matchesJob
    })
    if (sort) {
      rows = [...rows].sort((a, b) => {
        if (sort === 'name-asc') return a.name.localeCompare(b.name)
        if (sort === 'name-desc') return b.name.localeCompare(a.name)
        if (sort === 'rate-desc') return b.rate - a.rate
        return a.rate - b.rate
      })
    }
    return rows
  }, [crewRows, search, status, jobFilter, sort])

  const filteredRosterRows = useMemo(() => {
    let rows = rosterRows.filter((r) => {
      const matchesSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.rosterId.includes(search)
      const matchesStatus = !status || r.status === status
      const crewLabel = crewMenuOptions.find((c) => c.id === crewFilter)?.label
      const matchesCrew = !crewLabel || r.crewName === crewLabel
      return matchesSearch && matchesStatus && matchesCrew
    })
    if (sort) {
      rows = [...rows].sort((a, b) => {
        if (sort === 'name-asc') return a.name.localeCompare(b.name)
        if (sort === 'name-desc') return b.name.localeCompare(a.name)
        if (sort === 'rate-desc') return b.rate - a.rate
        return a.rate - b.rate
      })
    }
    return rows
  }, [rosterRows, search, status, crewFilter, sort])

  function submitMember(data: MemberFormData) {
    const crew = crewMenuOptions.find((c) => c.id === data.crewId)
    const rate = Number(data.rate) || 0

    if (flow.type === 'addMember') {
      setRosterRows((list) => [
        ...list,
        {
          id: `r-${Date.now()}`,
          rosterId: String(Math.floor(60 + Math.random() * 40)),
          name: `${data.firstName} ${data.lastName}`.trim(),
          avatar: `https://i.pravatar.cc/64?img=${Math.floor(Math.random() * 70)}`,
          crewName: crew?.label ?? null,
          crewColor: crew?.color ?? '#94a3b8',
          role: data.role,
          rate,
          status: data.status,
        },
      ])
    } else if (flow.type === 'editMember') {
      const targetId = flow.member.id
      setRosterRows((list) =>
        list.map((r) =>
          r.id === targetId
            ? {
                ...r,
                name: `${data.firstName} ${data.lastName}`.trim(),
                crewName: crew?.label ?? null,
                crewColor: crew?.color ?? r.crewColor,
                role: data.role,
                rate,
                status: data.status,
              }
            : r,
        ),
      )
    }
    setFlow({ type: 'none' })
  }

  function removeMember() {
    if (flow.type !== 'editMember') return
    const targetId = flow.member.id
    setRosterRows((list) => list.filter((r) => r.id !== targetId))
    setFlow({ type: 'none' })
  }

  function removeCrew() {
    if (flow.type !== 'editCrew') return
    const targetId = flow.crew.id
    setCrewRows((list) => list.filter((r) => r.id !== targetId))
    setFlow({ type: 'none' })
  }

  return (
    <div className="dash">
      <Sidebar active="Crew Management" />

      <main className="dash__main crew-main">
        <Topbar
          extra={
            <ZoomControl
              zoom={zoom}
              onZoomIn={() => setZoom((z) => stepSheetZoom(z, 1))}
              onZoomOut={() => setZoom((z) => stepSheetZoom(z, -1))}
            />
          }
        />

        <div className="crew-header-row">
          <div>
            <h1 className="dash__title">Crew</h1>
            <p className="dash__subtitle">Manage your crew leads and rosters</p>
          </div>
          <div className="sb-legend">
            {crewRows.map((crew) => (
              <span key={crew.id} className="sb-legend__item">
                <i style={{ background: crew.color }} />
                {crew.name}
              </span>
            ))}
          </div>
        </div>

        <div className="crew-toolbar">
          <label className="crew-search">
            <Icon.Search width={16} height={16} />
            <input
              placeholder={tab === 'crew' ? 'Search a crew...' : 'Search a member...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>

          <span className="crew-count">
            {tab === 'crew' ? `${crewRows.length} Total Crew` : `${rosterRows.length} Total Members`}
          </span>

          <div className="sb-toggle crew-tab-toggle">
            <button type="button" className={tab === 'crew' ? 'is-active' : ''} onClick={() => setTab('crew')}>
              Crew
            </button>
            <button type="button" className={tab === 'roster' ? 'is-active' : ''} onClick={() => setTab('roster')}>
              Roster
            </button>
          </div>

          {tab === 'crew' ? (
            <MenuDropdown
              className="crew-dd crew-dd--jobs"
              options={jobMenuOptions}
              value={jobFilter}
              onChange={setJobFilter}
              placeholder="All Jobs"
              includeAll
              allLabel="All Jobs"
              showDot={false}
            />
          ) : (
            <MenuDropdown
              className="crew-dd crew-dd--jobs"
              options={crewMenuOptions}
              value={crewFilter}
              onChange={setCrewFilter}
              placeholder="All Crews"
              includeAll
              allLabel="All"
              panelTitle="Crew Menu"
              showAvatar
              showDot
            />
          )}

          <MenuDropdown
            className="crew-dd crew-dd--status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={setStatus}
            placeholder="Status"
            includeAll
            allLabel="All Status"
            showDot={false}
          />

          <MenuDropdown
            className="crew-dd crew-dd--sort"
            options={SORT_OPTIONS}
            value={sort}
            onChange={(id) => setSort((id as SortKey) ?? null)}
            placeholder="Sort by"
            includeAll
            allLabel="Sort by"
            showDot={false}
            align="right"
          />

          <button type="button" className="btn btn--primary crew-add-btn" onClick={() => setFlow({ type: 'addNewChooser' })}>
            <Icon.Plus width={16} height={16} />
            Add New
          </button>
        </div>

        <div className="crew-table-wrap" ref={tableWrapRef}>
          <div className="crew-table-zoom" style={sheetZoomStyle(zoom)}>
          {tab === 'crew' ? (
            <table className="crew-table crew-table--leads">
              <colgroup>
                <col style={{ width: '3.5%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '28%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '8.5%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="crew-col-check">
                    <input type="checkbox" />
                  </th>
                  <th>Crew ID</th>
                  <th>Crew Name</th>
                  <th>Job Name</th>
                  <th className="crew-center">Workers</th>
                  <th className="crew-center">Hourly Rate ($)</th>
                  <th className="crew-center">
                    <span className="crew-th-sort">
                      Status
                      <ArrowDown size={14} weight="regular" />
                    </span>
                  </th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCrewRows.map((row) => (
                  <tr key={row.id}>
                    <td className="crew-col-check">
                      <input type="checkbox" />
                    </td>
                    <td className="crew-id-cell">
                      <span
                        className="crew-id-bar-hit"
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect()
                          setCrewHover({
                            x: rect.right + 8,
                            y: rect.top + rect.height / 2,
                            color: row.color,
                            names: [row.name],
                          })
                        }}
                        onMouseLeave={() => setCrewHover(null)}
                      >
                        <span className="crew-id-bar" style={{ background: row.color }} />
                      </span>
                      #{row.crewId}
                    </td>
                    <td>
                      <div className="crew-name-cell">
                        <img className="crew-avatar" src={row.avatar} alt="" />
                        {row.name}
                      </div>
                    </td>
                    <td>
                      {row.jobs.length === 0 ? (
                        <span className="crew-job-cell">
                          <span className="crew-job-cell__unassigned">Unassigned</span>
                          <button type="button" className="crew-assign-link" onClick={() => setFlow({ type: 'assignJob', crew: row })}>
                            Assign Job
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="crew-job-cell"
                          onClick={() =>
                            row.jobs.length > 1
                              ? setFlow({ type: 'multipleJobs', crew: row })
                              : setFlow({ type: 'viewJob', crewId: row.id, jobIndex: 0 })
                          }
                        >
                          <span className="crew-job-cell__name">{row.jobs[0].jobName}</span>
                          <span className="crew-job-cell__tail">
                            {row.jobs.length > 1 && <span className="crew-job-cell__more">+{row.jobs.length - 1}</span>}
                            <Icon.ChevronRight width={14} height={14} />
                          </span>
                        </button>
                      )}
                    </td>
                    <td className="crew-center">
                      <span
                        className="crew-workers-cell"
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect()
                          setJobHover({
                            x: rect.left + rect.width / 2,
                            y: rect.bottom + 8,
                            names: row.laborNames,
                          })
                        }}
                        onMouseLeave={() => setJobHover(null)}
                      >
                        {row.workers}
                      </span>
                    </td>
                    <td className="crew-center">{row.rate}</td>
                    <td className="crew-center">
                      <StatusPill status={row.status} />
                    </td>
                    <td>
                      <button type="button" className="crew-edit-btn" onClick={() => setFlow({ type: 'editCrew', crew: row })}>
                        <Icon.Edit width={15} height={15} />
                        {row.status === 'Unassigned' && <span className="crew-edit-btn__dot" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="crew-table crew-table--roster">
              <thead>
                <tr>
                  <th className="crew-col-check">
                    <input type="checkbox" />
                  </th>
                  <th>Roster ID</th>
                  <th className="crew-roster-name-th">Name</th>
                  <th className="crew-roster-crew-th">Crew Assigned</th>
                  <th className="crew-center">Role</th>
                  <th className="crew-center">Hourly Rate ($)</th>
                  <th className="crew-center">Status</th>
                  <th className="crew-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRosterRows.map((row) => (
                  <tr key={row.id}>
                    <td className="crew-col-check">
                      <input type="checkbox" />
                    </td>
                    <td className="crew-id-cell crew-id-cell--roster">#{row.rosterId}</td>
                    <td className="crew-roster-name-td">
                      <div className="crew-name-cell">
                        <img className="crew-avatar" src={row.avatar} alt="" />
                        {row.name}
                      </div>
                    </td>
                    <td className={row.crewName ? 'crew-assigned-td' : 'crew-assigned-td crew-assigned-td--empty'}>
                      {row.crewName ? (
                        <>
                          <span
                            className="crew-assigned-bar-hit"
                            onMouseEnter={(e) => {
                              if (!row.crewName) return
                              const rect = e.currentTarget.getBoundingClientRect()
                              setCrewHover({
                                x: rect.right + 8,
                                y: rect.top + rect.height / 2,
                                color: row.crewColor ?? '#94a3b8',
                                names: [row.crewName],
                              })
                            }}
                            onMouseLeave={() => setCrewHover(null)}
                          >
                            <span className="crew-assigned-bar" style={{ background: row.crewColor ?? '#94a3b8' }} />
                          </span>
                          <span className="crew-assigned-name">{row.crewName}</span>
                        </>
                      ) : (
                        <span className="crew-job-cell__unassigned">Unassigned</span>
                      )}
                    </td>
                    <td className="crew-center">{row.role}</td>
                    <td className="crew-center">{row.rate}</td>
                    <td className="crew-center">
                      <StatusPill status={row.status} />
                    </td>
                    <td className="crew-center">
                      <button type="button" className="crew-edit-btn" onClick={() => setFlow({ type: 'editMember', member: row })}>
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

      {flow.type === 'addNewChooser' && (
        <AddNewModal
          onCancel={() => setFlow({ type: 'none' })}
          onSelect={(kind) => {
            if (kind === 'crew') {
              setFlow({ type: 'createCrew' })
              return
            }
            setTab('roster')
            setFlow({ type: 'addMember' })
          }}
        />
      )}

      {flow.type === 'createCrew' && (
        <CreateCrewModal
          jobs={masterJobs}
          onCancel={() => setFlow({ type: 'none' })}
          onSubmit={(data) => {
            const selectedLead = crewLeads.find((item) => item.id === data.crewLeadId)
            setCrewRows((list) => [
              {
                id: `c-${Date.now()}`,
                crewId: String(Math.floor(1000 + Math.random() * 9000)),
                name: data.crewName,
                avatar: `https://i.pravatar.cc/64?img=${Math.floor(Math.random() * 70)}`,
                color: data.color ?? '#94a3b8',
                jobs: data.jobId
                  ? [
                      {
                        bidNo: '0000',
                        jobNo: '000',
                        date: new Date().toISOString().slice(0, 10),
                        jobName: masterJobs.find((job) => job.id === data.jobId)?.name ?? 'Assigned Job',
                      },
                    ]
                  : [],
                workers: data.laborNames.length,
                laborNames: data.laborNames,
                rate: selectedLead?.rate ?? 25,
                status: data.status === 'active' ? 'Active' : data.status === 'inactive' ? 'Inactive' : 'Unassigned',
              },
              ...list,
            ])
            setSort(null)
            setTab('crew')
            setFlow({ type: 'none' })
          }}
        />
      )}

      {flow.type === 'editCrew' && (
        <CreateCrewModal
          jobs={masterJobs}
          crew={{
            name: flow.crew.name,
            color: flow.crew.color,
            rate: flow.crew.rate,
            laborNames: flow.crew.laborNames,
            status: flow.crew.status.toLowerCase() as 'active' | 'inactive' | 'unassigned',
            jobId: flow.crew.jobs[0] ? masterJobs.find((job) => job.name === flow.crew.jobs[0].jobName)?.id ?? null : null,
          }}
          onCancel={() => setFlow({ type: 'none' })}
          onSubmit={(data) => {
            const targetId = flow.crew.id
            const selectedJob = data.jobId ? masterJobs.find((job) => job.id === data.jobId) : undefined
            const selectedLead = crewLeads.find((item) => item.id === data.crewLeadId)
            setCrewRows((list) =>
              list.map((r) =>
                r.id === targetId
                  ? {
                      ...r,
                      name: data.crewName,
                      color: data.color ?? r.color,
                      workers: data.laborNames.length,
                      laborNames: data.laborNames,
                      rate: selectedLead?.rate ?? r.rate,
                      status: data.status === 'active' ? 'Active' : data.status === 'inactive' ? 'Inactive' : 'Unassigned',
                      jobs: selectedJob
                        ? [
                            {
                              bidNo: '0000',
                              jobNo: '000',
                              date: new Date().toISOString().slice(0, 10),
                              jobName: selectedJob.name,
                            },
                          ]
                        : r.jobs,
                    }
                  : r,
              ),
            )
            setFlow({ type: 'none' })
          }}
          onRemove={removeCrew}
        />
      )}

      {jobHover && <JobNameTooltip names={jobHover.names} x={jobHover.x} y={jobHover.y} />}

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

      {flow.type === 'addMember' && (
        <MemberFormModal
          mode="add"
          crews={crewMenuOptions}
          onCancel={() => setFlow({ type: 'none' })}
          onSubmit={submitMember}
        />
      )}

      {flow.type === 'editMember' && (
        <MemberFormModal
          mode="edit"
          crews={crewMenuOptions}
          initial={{
            firstName: flow.member.name.split(' ')[0] ?? '',
            lastName: flow.member.name.split(' ').slice(1).join(' '),
            emailLocalPart: flow.member.name.split(' ')[0]?.toLowerCase() ?? '',
            role: flow.member.role,
            crewId: crewMenuOptions.find((c) => c.label === flow.member.crewName)?.id ?? null,
            rate: String(flow.member.rate),
            status: flow.member.status,
          }}
          onCancel={() => setFlow({ type: 'none' })}
          onSubmit={submitMember}
          onRemove={removeMember}
        />
      )}

      {flow.type === 'multipleJobs' && (
        <MultipleJobsModal
          jobs={flow.crew.jobs}
          onDone={() => setFlow({ type: 'none' })}
          onOpenJob={(job) => {
            const jobIndex = flow.crew.jobs.findIndex(
              (j) => j.bidNo === job.bidNo && j.jobNo === job.jobNo && j.jobName === job.jobName,
            )
            if (jobIndex < 0) return
            setFlow({ type: 'viewJob', crewId: flow.crew.id, jobIndex })
          }}
        />
      )}

      {flow.type === 'viewJob' && activeCrew && activeJob && (
        <JobDetailsModal
          job={activeJob}
          crew={toCrewLead(activeCrew)}
          note={activeNote}
          onDone={() => setFlow({ type: 'none' })}
          onChangeCrew={() => setFlow({ type: 'assignCrew', crewId: activeCrew.id, jobIndex: flow.jobIndex })}
          onRemoveCrew={() => {
            const targetId = activeCrew.id
            const removeIndex = flow.jobIndex
            setCrewRows((list) =>
              list.map((r) => {
                if (r.id !== targetId) return r
                const jobs = r.jobs.filter((_, i) => i !== removeIndex)
                return {
                  ...r,
                  jobs,
                  status: jobs.length === 0 ? 'Unassigned' : r.status,
                }
              }),
            )
            setFlow({ type: 'none' })
          }}
        />
      )}

      {flow.type === 'assignCrew' && activeCrew && activeJob && activeAssignment && (
        <AssignCrewModal
          job={activeJob}
          onCancel={() => setFlow({ type: 'viewJob', crewId: activeCrew.id, jobIndex: flow.jobIndex })}
          onAssign={(crewId, note) => {
            const nextCrewMeta = assignableCrews.find((c) => c.id === crewId)
            if (!nextCrewMeta) return
            const fromId = activeCrew.id
            const moveIndex = flow.jobIndex
            const assignment = activeAssignment
            const oldKey = noteKey(fromId, assignment)
            const destBefore = crewRows.find((r) => r.name === nextCrewMeta.name)
            const nextJobIndex =
              destBefore && destBefore.id === fromId
                ? Math.max(0, destBefore.jobs.length - 1)
                : destBefore
                  ? destBefore.jobs.length
                  : 0

            setJobNotes((prev) => {
              const next = { ...prev }
              const value = note || next[oldKey]
              if (destBefore && value) {
                if (destBefore.id !== fromId) delete next[oldKey]
                next[noteKey(destBefore.id, assignment)] = value
              } else if (note) {
                next[oldKey] = note
              }
              return next
            })

            setCrewRows((list) => {
              const target = list.find((r) => r.name === nextCrewMeta.name)
              return list.map((r) => {
                let jobs = r.jobs
                let status = r.status
                if (r.id === fromId) {
                  jobs = jobs.filter((_, i) => i !== moveIndex)
                  status = jobs.length === 0 ? 'Unassigned' : status
                }
                if (target && r.id === target.id) {
                  jobs = [...jobs, assignment]
                  status = 'Active'
                }
                return { ...r, jobs, status }
              })
            })

            if (destBefore) {
              setFlow({ type: 'viewJob', crewId: destBefore.id, jobIndex: nextJobIndex })
            } else {
              setFlow({ type: 'none' })
            }
          }}
        />
      )}

      {flow.type === 'assignJob' && (
        // Reused as-is from the Dashboard page.
        <AssignJobModal
          crew={{ id: flow.crew.id, name: flow.crew.name, leadName: flow.crew.name, rate: flow.crew.rate, avatar: flow.crew.avatar }}
          date={new Date().toISOString().slice(0, 10)}
          jobs={masterJobs}
          onCancel={() => setFlow({ type: 'none' })}
          onAssign={(jobId) => {
            const job = masterJobs.find((j) => j.id === jobId)
            if (!job) return
            const targetId = flow.crew.id
            setCrewRows((list) =>
              list.map((r) =>
                r.id === targetId
                  ? {
                      ...r,
                      status: 'Active',
                      jobs: [{ bidNo: job.bidNo, jobNo: job.jobNo, date: job.startDate, jobName: job.name }],
                    }
                  : r,
              ),
            )
            setFlow({ type: 'none' })
          }}
        />
      )}
    </div>
  )
}
