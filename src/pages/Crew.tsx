import { useMemo, useState } from 'react'
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
import { jobs as masterJobs } from '../lib/dashboardData'
import {
  crewRows as initialCrewRows,
  rosterRows as initialRosterRows,
  crewMenuOptions,
  jobMenuOptions,
  type CrewRow,
  type RosterRow,
  type Status,
} from '../lib/crewData'
import './Crew.css'

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

function StatusPill({ status }: { status: Status }) {
  return <span className={`crew-status crew-status--${status.toLowerCase()}`}>{status}</span>
}

export default function Crew() {
  const [tab, setTab] = useState<Tab>('crew')
  const [crewRows, setCrewRows] = useState(initialCrewRows)
  const [rosterRows, setRosterRows] = useState(initialRosterRows)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('name-asc')
  const [jobFilter, setJobFilter] = useState<string | null>(null) // Crew tab
  const [crewFilter, setCrewFilter] = useState<string | null>(null) // Roster tab

  const [flow, setFlow] = useState<Flow>({ type: 'none' })

  const filteredCrewRows = useMemo(() => {
    let rows = crewRows.filter((r) => {
      const matchesSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.crewId.includes(search)
      const matchesStatus = !status || r.status === status
      const jobLabel = jobMenuOptions.find((j) => j.id === jobFilter)?.label
      const matchesJob = !jobLabel || r.jobs.some((j) => j.jobName === jobLabel)
      return matchesSearch && matchesStatus && matchesJob
    })
    rows = [...rows].sort((a, b) => {
      if (sort === 'name-asc') return a.name.localeCompare(b.name)
      if (sort === 'name-desc') return b.name.localeCompare(a.name)
      if (sort === 'rate-desc') return b.rate - a.rate
      return a.rate - b.rate
    })
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
    rows = [...rows].sort((a, b) => {
      if (sort === 'name-asc') return a.name.localeCompare(b.name)
      if (sort === 'name-desc') return b.name.localeCompare(a.name)
      if (sort === 'rate-desc') return b.rate - a.rate
      return a.rate - b.rate
    })
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
          status: 'Active',
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

  return (
    <div className="dash">
      <Sidebar active="Crew Management" />

      <main className="dash__main">
        <Topbar onAddJob={() => {}} onCreateCrew={() => setFlow({ type: 'addNewChooser' })} />

        <h1 className="dash__title">Crew</h1>
        <p className="dash__subtitle">Manage your crew leads and rosters</p>

        <div className="crew-toolbar">
          <label className="sb-search crew-search">
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
              options={crewMenuOptions}
              value={crewFilter}
              onChange={setCrewFilter}
              placeholder="All Crews"
              includeAll
              allLabel="All"
            />
          )}

          <MenuDropdown
            options={STATUS_OPTIONS}
            value={status}
            onChange={setStatus}
            placeholder="Status"
            includeAll
            allLabel="All Status"
            showDot={false}
          />

          <MenuDropdown
            options={SORT_OPTIONS}
            value={sort}
            onChange={(id) => setSort((id as SortKey) ?? 'name-asc')}
            placeholder="Sort by"
            showDot={false}
            align="right"
          />

          <button type="button" className="btn btn--primary crew-add-btn" onClick={() => setFlow({ type: 'addNewChooser' })}>
            <Icon.Plus width={16} height={16} />
            Add New
          </button>
        </div>

        <div className="crew-table-wrap">
          {tab === 'crew' ? (
            <table className="crew-table">
              <thead>
                <tr>
                  <th className="crew-col-check">
                    <input type="checkbox" />
                  </th>
                  <th>Crew ID</th>
                  <th>Crew Name</th>
                  <th>Job Name</th>
                  <th>Workers</th>
                  <th>Hourly Rate ($)</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCrewRows.map((row) => (
                  <tr key={row.id}>
                    <td className="crew-col-check">
                      <input type="checkbox" />
                    </td>
                    <td className="crew-id-cell" style={{ borderLeftColor: row.color }}>
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
                        <button type="button" className="crew-job-cell" onClick={() => setFlow({ type: 'multipleJobs', crew: row })}>
                          <span className="crew-job-cell__name">{row.jobs[0].jobName}</span>
                          {row.jobs.length > 1 && <span className="crew-job-cell__more">+{row.jobs.length - 1}</span>}
                          <Icon.ChevronRight width={14} height={14} />
                        </button>
                      )}
                    </td>
                    <td>{row.workers}</td>
                    <td>{row.rate}</td>
                    <td>
                      <StatusPill status={row.status} />
                    </td>
                    <td>
                      <button type="button" className="crew-edit-btn" onClick={() => setFlow({ type: 'editCrew', crew: row })}>
                        <Icon.Edit width={15} height={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="crew-table">
              <thead>
                <tr>
                  <th className="crew-col-check">
                    <input type="checkbox" />
                  </th>
                  <th>Roster ID</th>
                  <th>Name</th>
                  <th>Crew Assigned</th>
                  <th>Role</th>
                  <th>Hourly Rate ($)</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRosterRows.map((row) => (
                  <tr key={row.id}>
                    <td className="crew-col-check">
                      <input type="checkbox" />
                    </td>
                    <td className="crew-id-cell">#{row.rosterId}</td>
                    <td>
                      <div className="crew-name-cell">
                        <img className="crew-avatar" src={row.avatar} alt="" />
                        {row.name}
                      </div>
                    </td>
                    <td>
                      {row.crewName ? (
                        <span className="crew-assigned-cell" style={{ borderLeftColor: row.crewColor }}>
                          {row.crewName}
                        </span>
                      ) : (
                        <span className="crew-job-cell__unassigned">Unassigned</span>
                      )}
                    </td>
                    <td>{row.role}</td>
                    <td>{row.rate}</td>
                    <td>
                      <StatusPill status={row.status} />
                    </td>
                    <td>
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
      </main>

      {flow.type === 'addNewChooser' && (
        <AddNewModal
          onCancel={() => setFlow({ type: 'none' })}
          onSelect={(kind) => setFlow(kind === 'crew' ? { type: 'createCrew' } : { type: 'addMember' })}
        />
      )}

      {flow.type === 'createCrew' && (
        <CreateCrewModal
          jobs={masterJobs}
          onCancel={() => setFlow({ type: 'none' })}
          onSubmit={(data) => {
            setCrewRows((list) => [
              ...list,
              {
                id: `c-${Date.now()}`,
                crewId: String(Math.floor(1000 + Math.random() * 9000)),
                name: data.crewName,
                avatar: `https://i.pravatar.cc/64?img=${Math.floor(Math.random() * 70)}`,
                color: '#94a3b8',
                jobs: [],
                workers: 1,
                rate: 25,
                status: 'Unassigned',
              },
            ])
            setFlow({ type: 'none' })
          }}
        />
      )}

      {flow.type === 'editCrew' && (
        // NOTE: assumes CreateCrewModal accepts an optional `crew` prop for
        // edit mode, mirroring how CreateJobModal takes an optional `job`.
        // If your existing CreateCrewModal doesn't support this yet, add a
        // `crew?: { name; color; rate }` prop and prefill the form from it.
        <CreateCrewModal
          jobs={masterJobs}
          crew={{ name: flow.crew.name, color: flow.crew.color, rate: flow.crew.rate }}
          onCancel={() => setFlow({ type: 'none' })}
          onSubmit={(data) => {
            const targetId = flow.crew.id
            setCrewRows((list) =>
              list.map((r) => (r.id === targetId ? { ...r, name: data.crewName, color: data.color ?? r.color } : r)),
            )
            setFlow({ type: 'none' })
          }}
        />
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
          }}
          onCancel={() => setFlow({ type: 'none' })}
          onSubmit={submitMember}
          onRemove={removeMember}
        />
      )}

      {flow.type === 'multipleJobs' && <MultipleJobsModal jobs={flow.crew.jobs} onDone={() => setFlow({ type: 'none' })} />}

      {flow.type === 'assignJob' && (
        // Reused as-is from the Dashboard page.
        <AssignJobModal
          crew={{ id: flow.crew.id, name: flow.crew.name, leadName: flow.crew.name, rate: flow.crew.rate }}
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
