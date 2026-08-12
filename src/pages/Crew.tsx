import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, PenIcon } from '@phosphor-icons/react'
import Sidebar from '../components/dashboard/Sidebar'
import Avatar from '../components/dashboard/Avatar'
import { Icon } from '../components/dashboard/icons'
import MenuDropdown from '../components/dashboard/MenuDropdown'
import AddNewModal from '../components/dashboard/AddNewModal'
import MultipleJobsModal from '../components/dashboard/MultipleJobsModal'
import MemberFormModal from '../components/dashboard/MemberFormModal'
import CreateCrewModal from '../components/dashboard/CreateCrewModal'
import AssignJobModal from '../components/dashboard/AssignJobModal'
import JobDetailsModal from '../components/dashboard/JobDetailsModal'
import AssignCrewModal from '../components/dashboard/AssignCrewModal'
import { useClickDragScroll } from '../hooks/useClickDragScroll'
import {
  deactivateUser,
  deleteCrew,
  getCrewById,
  getCrewsSummary,
  getUsers,
  type CrewSummaryItem,
  type Pagination,
  type UserItem,
} from '../api/crewApi'
import {
  createCrewAssignment,
  deleteCrewAssignment,
  getCrewAssignments,
  getJobs,
  updateJob,
  type JobItem,
} from '../api/jobApi'
import { getErrorMessage } from '../lib/errors'
import type { Job, UnassignedCrew } from '../lib/dashboardData'
import type { CrewJobAssignment, CrewMenuOption, CrewRow, RosterRow, Status } from '../lib/crewData'
import './Crew.css'
import './Dashboard.css'
import './JobsManagement.css'

type Tab = 'crew' | 'roster'
type SortKey = 'name-asc' | 'name-desc' | 'rate-desc' | 'rate-asc'

const CREW_STATUS_OPTIONS = [
  { id: 'assigned', label: 'Assigned' },
  { id: 'un-assigned', label: 'Unassigned' },
]

const ROSTER_STATUS_OPTIONS = [
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
]

const SORT_OPTIONS = [
  { id: 'name-asc', label: 'Name (A-Z)' },
  { id: 'name-desc', label: 'Name (Z-A)' },
  { id: 'rate-desc', label: 'Rate (High-Low)' },
  { id: 'rate-asc', label: 'Rate (Low-High)' },
]

const LIMIT_OPTIONS = [
  { id: '10', label: '10 per page' },
  { id: '20', label: '20 per page' },
  { id: '50', label: '50 per page' },
  { id: '100', label: '100 per page' },
]

const EMPTY_PAGINATION: Pagination = { page: 1, limit: 20, totalCount: 0, totalPages: 1 }

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

const isoDay = (value?: string | null) => (value ? new Date(value).toISOString().slice(0, 10) : '')

/**
 * The crew-assignment validator rejects a startDate in the past, so a job that
 * already started can only be assigned from today forward.
 */
function assignmentStartDate(job?: JobItem) {
  const today = new Date().toISOString().slice(0, 10)
  const start = isoDay(job?.startDate)
  return !start || start < today ? today : start
}

/** Maps a real JobItem onto the shared display shape the job modals expect. */
function toDisplayJob(job: JobItem | undefined, fallbackName: string, color: string): Job {
  return {
    id: job?._id ?? '',
    name: job?.name ?? fallbackName,
    color,
    // No bid number exists on the Job model — rendered as empty and hidden.
    bidNo: '',
    jobNo: job?.jobIdNumber != null ? String(job.jobIdNumber) : '',
    gc: job?.generalContractor ?? '—',
    estimator: typeof job?.idsSuper === 'string' ? job.idsSuper : '—',
    startDate: isoDay(job?.startDate),
    endDate: isoDay(job?.endDate),
    contractAmount: job?.contractAmount ?? 0,
    // Actual spend lives on time entries / crew assignments, not on the job.
    laborBudgetUsed: 0,
    laborBudgetTotal: job?.laborBudget ?? 0,
  }
}

function toAssignment(job: JobItem | undefined, summaryJob: CrewSummaryItem['job']): CrewJobAssignment {
  return {
    jobId: job?._id ?? summaryJob?._id ?? '',
    bidNo: null,
    jobNo: job?.jobIdNumber != null ? String(job.jobIdNumber) : '',
    date: isoDay(job?.startDate),
    jobName: job?.name ?? summaryJob?.name ?? 'Assigned Job',
  }
}

function crewStatusLabel(item: CrewSummaryItem): Status {
  const raw = (item.status ?? '').toLowerCase()
  if (raw === 'assigned') return 'Assigned'
  if (raw === 'un-assigned' || raw === 'unassigned') return 'Unassigned'
  // Fall back to whether the API actually attached a job to this crew.
  return item.job ? 'Assigned' : 'Unassigned'
}

function toCrewRow(item: CrewSummaryItem, jobsById: Map<string, JobItem>): CrewRow {
  const lead = typeof item.crewLead === 'object' && item.crewLead !== null ? item.crewLead : null
  const leadName = lead ? `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() : ''
  const job = item.job ? jobsById.get(item.job._id) : undefined

  return {
    id: item._id,
    crewId: item._id.slice(-4),
    name: item.name,
    color: item.crewColor || '#94a3b8',
    jobs: item.job ? [toAssignment(job, item.job)] : [],
    workers: item.membersCount || 0,
    laborNames: [],
    rate: lead?.hourlyRate ?? null,
    leadName,
    status: crewStatusLabel(item),
  }
}

function toRosterRow(user: UserItem): RosterRow {
  return {
    id: user._id,
    rosterId: user._id.slice(-4),
    name: `${user.firstName} ${user.lastName}`.trim(),
    crewName: user.assignCrew?.name ?? null,
    crewColor: user.assignCrew?.crewColor ?? '#94a3b8',
    role: user.role === 'crew-lead' ? 'Crew Lead' : 'Labor',
    rate: user.hourlyRate ?? 0,
    status: user.isActive ? 'Active' : 'Inactive',
  }
}

function StatusPill({ status }: { status: Status }) {
  return <span className={`crew-status crew-status--${status.toLowerCase()}`}>{status}</span>
}

export default function Crew() {
  const [tab, setTab] = useState<Tab>('crew')
  const [crewRows, setCrewRows] = useState<CrewRow[]>([])
  const [rosterRows, setRosterRows] = useState<RosterRow[]>([])
  const [jobList, setJobList] = useState<JobItem[]>([])
  const [allCrews, setAllCrews] = useState<CrewSummaryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey | null>(null)
  const [jobFilter, setJobFilter] = useState<string | null>(null)
  const [crewFilter, setCrewFilter] = useState<string | null>(null)

  const [rosterPage, setRosterPage] = useState(1)
  const [rosterLimit, setRosterLimit] = useState(20)
  const [rosterPagination, setRosterPagination] = useState<Pagination>(EMPTY_PAGINATION)

  const [memberNames, setMemberNames] = useState<Record<string, string[]>>({})
  const [jobHover, setJobHover] = useState<{ x: number; y: number; crewId: string } | null>(null)
  const [crewHover, setCrewHover] = useState<{ x: number; y: number; color: string; names: string[] } | null>(null)
  const tableWrapRef = useRef<HTMLDivElement>(null)
  useClickDragScroll(tableWrapRef)

  const [flow, setFlow] = useState<Flow>({ type: 'none' })

  const jobsById = useMemo(() => new Map(jobList.map((j) => [j._id, j])), [jobList])

  // Debounce the search box so each keystroke doesn't fire a request.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(timer)
  }, [search])

  // Filters are per-tab; reset them so a Crew-tab status doesn't leak into Roster.
  function changeTab(next: Tab) {
    if (next === tab) return
    setTab(next)
    setStatus(null)
    setSearch('')
    setDebouncedSearch('')
    setRosterPage(1)
  }

  // Jobs back the job filter, the assign-job dropdown and the row enrichment.
  useEffect(() => {
    getJobs({ limit: 100 })
      .then((res) => {
        if (res.success && Array.isArray(res.data)) setJobList(res.data)
      })
      .catch((err) => console.error('Failed to load jobs:', err))
  }, [])

  // An unfiltered crew list for the Roster tab's crew filter and the member
  // modal — those must be populated even if the Crew tab was never opened.
  const loadAllCrews = useCallback(async () => {
    try {
      const res = await getCrewsSummary()
      if (res.success && Array.isArray(res.data)) setAllCrews(res.data)
    } catch (err) {
      console.error('Failed to load crews:', err)
    }
  }, [])

  useEffect(() => {
    loadAllCrews()
  }, [loadAllCrews])

  const loadCrews = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getCrewsSummary({
        jobId: jobFilter ?? undefined,
        status: status ?? undefined,
        sortByName: sort === 'name-asc' ? 'asc' : sort === 'name-desc' ? 'desc' : undefined,
      })
      setCrewRows(res.success && Array.isArray(res.data) ? res.data.map((item) => toCrewRow(item, jobsById)) : [])
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load crews.'))
      setCrewRows([])
    } finally {
      setLoading(false)
    }
  }, [jobFilter, status, sort, jobsById])

  const loadRoster = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getUsers({
        assignCrew: crewFilter ?? undefined,
        isActive: status === 'active' ? true : status === 'inactive' ? false : undefined,
        search: debouncedSearch || undefined,
        page: rosterPage,
        limit: rosterLimit,
      })
      setRosterRows(res.success && Array.isArray(res.data) ? res.data.map(toRosterRow) : [])
      setRosterPagination(res.pagination ?? EMPTY_PAGINATION)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load roster.'))
      setRosterRows([])
      setRosterPagination(EMPTY_PAGINATION)
    } finally {
      setLoading(false)
    }
  }, [crewFilter, status, debouncedSearch, rosterPage, rosterLimit])

  useEffect(() => {
    if (tab === 'crew') loadCrews()
  }, [tab, loadCrews])

  useEffect(() => {
    if (tab === 'roster') loadRoster()
  }, [tab, loadRoster])

  /** GET /crews/summary only returns a member count, so names load on demand. */
  const loadMemberNames = useCallback(
    async (crewId: string) => {
      if (memberNames[crewId]) return
      try {
        const res = await getCrewById(crewId)
        const members = res.data?.members as Array<{ firstName?: string; lastName?: string }> | undefined
        const names = Array.isArray(members)
          ? members
              .map((m) => (m && typeof m === 'object' ? `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() : ''))
              .filter(Boolean)
          : []
        setMemberNames((prev) => ({ ...prev, [crewId]: names }))
      } catch {
        setMemberNames((prev) => ({ ...prev, [crewId]: [] }))
      }
    },
    [memberNames],
  )

  const jobMenuOptions = useMemo(
    () => jobList.map((j) => ({ id: j._id, label: j.name || `Job #${j.jobIdNumber}` })),
    [jobList],
  )

  const crewMenuOptions: CrewMenuOption[] = useMemo(
    () =>
      allCrews.map((c) => {
        const lead = typeof c.crewLead === 'object' && c.crewLead !== null ? c.crewLead : null
        const leadName = lead ? `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() : ''
        return {
          id: c._id,
          label: c.name,
          color: c.crewColor || '#94a3b8',
          avatarName: leadName || c.name,
        }
      }),
    [allCrews],
  )

  const displayJobs: Job[] = useMemo(
    () => jobList.map((j) => toDisplayJob(j, j.name, '#94a3b8')),
    [jobList],
  )

  const activeCrew =
    flow.type === 'viewJob' || flow.type === 'assignCrew' ? crewRows.find((r) => r.id === flow.crewId) : undefined
  const activeAssignment =
    activeCrew && (flow.type === 'viewJob' || flow.type === 'assignCrew') ? activeCrew.jobs[flow.jobIndex] : undefined
  const activeJob =
    activeCrew && activeAssignment
      ? toDisplayJob(jobsById.get(activeAssignment.jobId), activeAssignment.jobName, activeCrew.color)
      : undefined

  const activeCrewLead: UnassignedCrew | null = activeCrew
    ? {
        id: activeCrew.id,
        name: activeCrew.name,
        leadName: activeCrew.leadName || activeCrew.name,
        rate: activeCrew.rate ?? 0,
        color: activeCrew.color,
      }
    : null

  // /crews/summary has no `search` param, so the Crew tab filters the fetched
  // page locally. Roster search is server-side (GET /users?search=).
  const visibleCrewRows = useMemo(() => {
    const q = debouncedSearch.toLowerCase()
    const rows = q
      ? crewRows.filter(
          (row) =>
            row.name.toLowerCase().includes(q) ||
            row.crewId.toLowerCase().includes(q) ||
            row.leadName.toLowerCase().includes(q) ||
            row.jobs.some((j) => j.jobName.toLowerCase().includes(q)),
        )
      : crewRows
    if (sort !== 'rate-asc' && sort !== 'rate-desc') return rows
    return [...rows].sort((a, b) =>
      sort === 'rate-desc' ? (b.rate ?? 0) - (a.rate ?? 0) : (a.rate ?? 0) - (b.rate ?? 0),
    )
  }, [crewRows, debouncedSearch, sort])

  // GET /users has no sort param — this orders the current page only.
  const visibleRosterRows = useMemo(() => {
    if (!sort) return rosterRows
    return [...rosterRows].sort((a, b) => {
      if (sort === 'name-asc') return a.name.localeCompare(b.name)
      if (sort === 'name-desc') return b.name.localeCompare(a.name)
      if (sort === 'rate-desc') return b.rate - a.rate
      return a.rate - b.rate
    })
  }, [rosterRows, sort])

  async function handleRemoveCrew() {
    if (flow.type !== 'editCrew') return
    try {
      await deleteCrew(flow.crew.id)
      setFlow({ type: 'none' })
      await Promise.all([loadCrews(), loadAllCrews()])
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete crew.'))
    }
  }

  async function handleRemoveMember() {
    if (flow.type !== 'editMember') return
    try {
      await deactivateUser(flow.member.id)
      setFlow({ type: 'none' })
      await loadRoster()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to remove member.'))
    }
  }

  /**
   * Two writes are needed: the assignment record is the scheduling source of
   * truth, but GET /crews/summary reads the denormalised Job.assignToCrew, so
   * the crew's row only shows the job once that pointer is updated too.
   */
  async function assignCrewToJob(jobId: string, crewId: string, startDate: string, endDate: string, note: string) {
    await createCrewAssignment(jobId, {
      crewId,
      startDate,
      endDate: endDate || undefined,
      note: note || undefined,
    })
    await updateJob(jobId, { assignToCrew: crewId })
    setFlow({ type: 'none' })
    await Promise.all([loadCrews(), loadAllCrews()])
  }

  async function handleAssignJob(crewId: string, jobId: string, note: string) {
    try {
      const job = jobsById.get(jobId)
      await assignCrewToJob(jobId, crewId, assignmentStartDate(job), isoDay(job?.endDate), note)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to assign job.'))
    }
  }

  /** Moves a job to a different crew by opening a new assignment for it. */
  async function handleChangeCrew(jobId: string, nextCrewId: string, startDate: string, endDate: string, note: string) {
    try {
      const today = new Date().toISOString().slice(0, 10)
      await assignCrewToJob(jobId, nextCrewId, startDate < today ? today : startDate, endDate, note)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to reassign crew.'))
    }
  }

  /** Cancels the crew's current stint on the job. Backend refuses once started. */
  async function handleRemoveCrewFromJob(jobId: string, crewId: string) {
    try {
      const res = await getCrewAssignments(jobId)
      const current = res.data?.find((a) => a.crewId === crewId && a.status === 'scheduled')
      if (!current) {
        setError('No scheduled assignment found for this crew on this job.')
        return
      }
      await deleteCrewAssignment(jobId, current._id)
      setFlow({ type: 'none' })
      await loadCrews()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to remove crew from job.'))
    }
  }

  const hoverNames = jobHover ? (memberNames[jobHover.crewId] ?? null) : null

  return (
    <div className="dash">
      <Sidebar active="Crew Management" />

      <main className="dash__main crew-main">
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

        {error && (
          <div className="form-error-alert" style={{ marginBottom: '1rem' }}>
            <Icon.AlertCircle width={18} height={18} />
            <span>{error}</span>
          </div>
        )}

        <div className="crew-toolbar">
          <label className="crew-search">
            <Icon.Search width={16} height={16} />
            <input
              placeholder={tab === 'crew' ? 'Search a crew...' : 'Search a member...'}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setRosterPage(1)
              }}
            />
          </label>

          <span className="crew-count">
            {tab === 'crew'
              ? `${visibleCrewRows.length} Total Crew`
              : `${rosterPagination.totalCount} Total Members`}
          </span>

          <div className="sb-toggle crew-tab-toggle">
            <button type="button" className={tab === 'crew' ? 'is-active' : ''} onClick={() => changeTab('crew')}>
              Crew
            </button>
            <button type="button" className={tab === 'roster' ? 'is-active' : ''} onClick={() => changeTab('roster')}>
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
              onChange={(id) => {
                setCrewFilter(id)
                setRosterPage(1)
              }}
              placeholder="All Crews"
              includeAll
              allLabel="All Crews"
              showDot={false}
            />
          )}

          <MenuDropdown
            className="crew-dd crew-dd--status"
            options={tab === 'crew' ? CREW_STATUS_OPTIONS : ROSTER_STATUS_OPTIONS}
            value={status}
            onChange={(id) => {
              setStatus(id)
              setRosterPage(1)
            }}
            placeholder="Status"
            includeAll
            allLabel="Status"
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

          <button
            type="button"
            className="btn btn--primary crew-add-btn"
            onClick={() => setFlow({ type: 'addNewChooser' })}
          >
            <Icon.Plus width={16} height={16} />
            Add New
          </button>
        </div>

        <div className="crew-table-wrap" ref={tableWrapRef}>
          {tab === 'crew' ? (
            <table className="crew-table crew-table--leads">
              <colgroup>
                <col style={{ width: '4%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '34%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '8%' }} />
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
                {loading ? (
                  <tr>
                    <td colSpan={7} className="crew-empty-cell">
                      Loading crew data...
                    </td>
                  </tr>
                ) : visibleCrewRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="crew-empty-cell">
                      No crews found
                    </td>
                  </tr>
                ) : (
                  visibleCrewRows.map((row) => (
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
                          <Avatar name={row.name} size={28} />
                          {row.name}
                        </div>
                      </td>
                      <td>
                        {row.jobs.length === 0 ? (
                          <span className="crew-job-cell">
                            <span className="crew-job-cell__unassigned">Unassigned</span>
                            <button
                              type="button"
                              className="crew-assign-link"
                              onClick={() => setFlow({ type: 'assignJob', crew: row })}
                            >
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
                              {row.jobs.length > 1 && (
                                <span className="crew-job-cell__more">+{row.jobs.length - 1}</span>
                              )}
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
                            setJobHover({ x: rect.left + rect.width / 2, y: rect.bottom + 8, crewId: row.id })
                            loadMemberNames(row.id)
                          }}
                          onMouseLeave={() => setJobHover(null)}
                        >
                          {row.workers}
                        </span>
                      </td>
                      <td className="crew-center">
                        <StatusPill status={row.status} />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn--primary"
                          onClick={() => setFlow({ type: 'editCrew', crew: row })}
                        >
                          <PenIcon size={20} />
                          <p>Edit</p>
                          {row.status === 'Unassigned' && <span className="crew-edit-btn__dot" />}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="crew-table crew-table--roster">
              <colgroup>
                <col style={{ width: '3.5%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '17%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '13.5%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="crew-col-check">
                    <input type="checkbox" />
                  </th>
                  <th>Roster ID</th>
                  <th>Name</th>
                  <th>Crew Assigned</th>
                  <th className="crew-center">Role</th>
                  <th className="crew-center">Hourly Rate ($)</th>
                  <th className="crew-center">Status</th>
                  <th className="crew-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="crew-empty-cell">
                      Loading roster data...
                    </td>
                  </tr>
                ) : visibleRosterRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="crew-empty-cell">
                      No members found
                    </td>
                  </tr>
                ) : (
                  visibleRosterRows.map((row) => (
                    <tr key={row.id}>
                      <td className="crew-col-check">
                        <input type="checkbox" />
                      </td>
                      <td className="crew-id-cell crew-id-cell--roster">#{row.rosterId}</td>
                      <td>
                        <div className="crew-name-cell">
                          <Avatar name={row.name} size={28} />
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
                        <button
                          type="button"
                          className="btn btn--primary"
                          onClick={() => setFlow({ type: 'editMember', member: row })}
                        >
                          <PenIcon size={20} />
                          <p>Edit</p>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {tab === 'roster' && (
          <div className="jm-pagination-bar">
            <div className="jm-pagination-limit">
              <MenuDropdown
                className="crew-dd"
                options={LIMIT_OPTIONS}
                value={String(rosterLimit)}
                onChange={(id) => {
                  setRosterLimit(Number(id) || 20)
                  setRosterPage(1)
                }}
                placeholder="20 per page"
                showDot={false}
              />
            </div>
            <div className="jm-pagination-controls">
              <span className="jm-pagination-info">
                Page {rosterPagination.page} of {rosterPagination.totalPages || 1} ({rosterPagination.totalCount} total)
              </span>
              <div className="jm-pagination-btns">
                <button
                  type="button"
                  className="btn btn--outline jm-page-btn"
                  disabled={rosterPage <= 1 || loading}
                  onClick={() => setRosterPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn btn--outline jm-page-btn"
                  disabled={rosterPage >= (rosterPagination.totalPages || 1) || loading}
                  onClick={() => setRosterPage((p) => Math.min(rosterPagination.totalPages || 1, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
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
          jobs={displayJobs}
          onCancel={() => setFlow({ type: 'none' })}
          onSubmit={async (_data, apiResponse, assignedJobId) => {
            setFlow({ type: 'none' })
            if (assignedJobId && apiResponse?._id) {
              await handleAssignJob(apiResponse._id, assignedJobId, '')
            }
            setTab('crew')
            await Promise.all([loadCrews(), loadAllCrews()])
          }}
        />
      )}

      {flow.type === 'editCrew' && (
        <CreateCrewModal
          jobs={displayJobs}
          crew={{
            id: flow.crew.id,
            name: flow.crew.name,
            color: flow.crew.color,
            rate: flow.crew.rate ?? undefined,
            status: flow.crew.status === 'Unassigned' ? 'unassigned' : 'active',
            jobId: flow.crew.jobs[0]?.jobId ?? null,
          }}
          onCancel={() => setFlow({ type: 'none' })}
          onSubmit={async () => {
            setFlow({ type: 'none' })
            await Promise.all([loadCrews(), loadAllCrews()])
          }}
          onRemove={handleRemoveCrew}
        />
      )}

      {jobHover && (
        <div className="crew-job-tooltip crew-job-tooltip--fixed" style={{ left: jobHover.x, top: jobHover.y }}>
          {hoverNames === null ? (
            <span className="crew-job-tooltip__item">Loading…</span>
          ) : hoverNames.length === 0 ? (
            <span className="crew-job-tooltip__item">No members</span>
          ) : (
            hoverNames.map((name) => (
              <span key={name} className="crew-job-tooltip__item">
                {name}
              </span>
            ))
          )}
        </div>
      )}

      {crewHover && (
        <div className="sb-jobno-tooltip sb-jobno-tooltip--fixed" style={{ left: crewHover.x, top: crewHover.y }}>
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
          onSubmit={async () => {
            setFlow({ type: 'none' })
            setTab('roster')
            await loadRoster()
          }}
        />
      )}

      {flow.type === 'editMember' && (
        <MemberFormModal
          mode="edit"
          crews={crewMenuOptions}
          initial={{
            memberId: flow.member.id,
            firstName: flow.member.name.split(' ')[0] ?? '',
            lastName: flow.member.name.split(' ').slice(1).join(' '),
            emailLocalPart: '',
            role: flow.member.role,
            crewId: null,
            rate: String(flow.member.rate),
            status: flow.member.status,
          }}
          onCancel={() => setFlow({ type: 'none' })}
          onSubmit={async () => {
            setFlow({ type: 'none' })
            await loadRoster()
          }}
          onRemove={handleRemoveMember}
        />
      )}

      {flow.type === 'multipleJobs' && (
        <MultipleJobsModal
          jobs={flow.crew.jobs}
          onDone={() => setFlow({ type: 'none' })}
          onOpenJob={(job) => {
            const jobIndex = flow.crew.jobs.findIndex((j) => j.jobId === job.jobId)
            if (jobIndex < 0) return
            setFlow({ type: 'viewJob', crewId: flow.crew.id, jobIndex })
          }}
        />
      )}

      {flow.type === 'viewJob' && activeCrew && activeJob && (
        <JobDetailsModal
          job={activeJob}
          crew={activeCrewLead}
          note=""
          onDone={() => setFlow({ type: 'none' })}
          onChangeCrew={() => setFlow({ type: 'assignCrew', crewId: activeCrew.id, jobIndex: flow.jobIndex })}
          onRemoveCrew={() => handleRemoveCrewFromJob(activeJob.id, activeCrew.id)}
        />
      )}

      {flow.type === 'assignCrew' && activeCrew && activeJob && (
        <AssignCrewModal
          job={activeJob}
          crews={allCrews.map((c) => {
            const lead = typeof c.crewLead === 'object' && c.crewLead !== null ? c.crewLead : null
            const leadName = lead ? `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() : ''
            return {
              id: c._id,
              name: c.name,
              leadName: leadName || c.name,
              rate: lead?.hourlyRate ?? 0,
              color: c.crewColor || '#94a3b8',
            }
          })}
          onCancel={() => setFlow({ type: 'viewJob', crewId: activeCrew.id, jobIndex: flow.jobIndex })}
          onAssign={(crewId, startDate, endDate, note) =>
            handleChangeCrew(activeJob.id, crewId, startDate, endDate, note)
          }
        />
      )}

      {flow.type === 'assignJob' && (
        <AssignJobModal
          crew={{
            id: flow.crew.id,
            name: flow.crew.name,
            leadName: flow.crew.leadName || flow.crew.name,
            rate: flow.crew.rate ?? 0,
          }}
          date={new Date().toISOString().slice(0, 10)}
          jobs={displayJobs}
          onCancel={() => setFlow({ type: 'none' })}
          onAssign={(jobId, note) => handleAssignJob(flow.crew.id, jobId, note)}
        />
      )}
    </div>
  )
}
