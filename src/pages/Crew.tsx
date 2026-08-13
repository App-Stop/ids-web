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
import { useQueryClient } from '@tanstack/react-query'
import {
  useCrewsSummary,
  useCrewsSummaryPaged,
  useJobsList,
  useCrewMutations,
  useUserMutations,
  useCrewAssignmentMutations,
  useJobMutations,
} from '../hooks/useQueryHooks'
import { queryKeys } from '../lib/queryKeys'
import { TableRowSkeleton } from '../components/common/Shimmer'
import { getCrewById, type CrewSummaryItem } from '../api/crewApi'
import { getCrewAssignments, type JobItem } from '../api/jobApi'
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

function toRosterRow(user: any): RosterRow {
  const crewObj = user.crew ?? user.assignCrew
  return {
    id: user._id,
    rosterId: user._id ? user._id.slice(-4) : '',
    name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || 'Member',
    crewName: crewObj?.name ?? null,
    crewColor: crewObj?.crewColor ?? '#94a3b8',
    role: user.role === 'crew-lead' ? 'Crew Lead' : 'Labor',
    rate: user.rate ?? user.hourlyRate ?? 0,
    status: user.isActive ? 'Active' : 'Inactive',
  }
}

function StatusPill({ status }: { status: Status }) {
  return <span className={`crew-status crew-status--${status.toLowerCase()}`}>{status}</span>
}

export default function Crew() {
  const [tab, setTab] = useState<Tab>('crew')
  const [actionError, setActionError] = useState('')

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey | null>(null)
  const [jobFilter, setJobFilter] = useState<string | null>(null)
  const [crewFilter, setCrewFilter] = useState<string | null>(null)

  const [rosterPage, setRosterPage] = useState(1)
  const [rosterLimit, setRosterLimit] = useState(20)

  const [memberNames, setMemberNames] = useState<Record<string, string[]>>({})
  const [jobHover, setJobHover] = useState<{ x: number; y: number; crewId: string } | null>(null)
  const [crewHover, setCrewHover] = useState<{ x: number; y: number; color: string; names: string[] } | null>(null)
  const tableWrapRef = useRef<HTMLDivElement>(null)
  useClickDragScroll(tableWrapRef)

  const [flow, setFlow] = useState<Flow>({ type: 'none' })

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

  const queryClient = useQueryClient()

  // Jobs back the job filter, the assign-job dropdown and the row enrichment.
  // `{ limit: 100 }` is the shared shape every screen uses, so this is usually
  // served straight from cache.
  const { data: jobList = [] } = useJobsList({ limit: 100 })
  const jobsById = useMemo(() => new Map(jobList.map((j) => [j._id, j])), [jobList])

  const { data: allCrews = [] } = useCrewsSummary()

  const crewSortBy =
    sort === 'name-asc' ? 'nameAsc' : sort === 'name-desc' ? 'nameDesc' : undefined

  const crewQuery = useCrewsSummary(
    {
      statusEmployee: 'crew',
      jobId: jobFilter ?? undefined,
      status: status ?? undefined,
      search: debouncedSearch || undefined,
      sortBy: crewSortBy,
      sortByName: sort === 'name-asc' ? 'asc' : sort === 'name-desc' ? 'desc' : undefined,
    },
    tab === 'crew',
  )

  const rosterSortBy =
    sort === 'name-asc'
      ? 'nameAsc'
      : sort === 'name-desc'
        ? 'nameDesc'
        : sort === 'rate-asc'
          ? 'rateAsc'
          : sort === 'rate-desc'
            ? 'rateDesc'
            : undefined

  const rosterQuery = useCrewsSummaryPaged(
    {
      statusEmployee: 'roster',
      crewId: crewFilter ?? undefined,
      status: status ?? undefined,
      search: debouncedSearch || undefined,
      sortBy: rosterSortBy,
      page: rosterPage,
      limit: rosterLimit,
    },
    tab === 'roster',
  )

  const crewRows: CrewRow[] = useMemo(
    () => (crewQuery.data ?? []).map((item: CrewSummaryItem) => toCrewRow(item, jobsById)),
    [crewQuery.data, jobsById],
  )
  const rosterRows: RosterRow[] = useMemo(
    () => (rosterQuery.data?.items ?? []).map(toRosterRow),
    [rosterQuery.data],
  )
  const rosterPagination = rosterQuery.data?.pagination ?? {
    page: 1,
    limit: rosterLimit,
    totalCount: 0,
    totalPages: 1,
  }

  const loading = tab === 'crew' ? crewQuery.isPending : rosterQuery.isPending
  const queryError = tab === 'crew' ? crewQuery.error : rosterQuery.error
  const error =
    actionError ||
    (queryError
      ? getErrorMessage(queryError, tab === 'crew' ? 'Failed to load crews.' : 'Failed to load roster.')
      : '')

  const { deleteCrewMutation } = useCrewMutations()
  const { softDeleteUserMutation } = useUserMutations()
  const { createAssignmentMutation, deleteAssignmentMutation } = useCrewAssignmentMutations()
  const { updateJobMutation, invalidateAll } = useJobMutations()

  // Refreshing after a write is one cache invalidation now, instead of a
  // hand-rolled re-fetch of each affected list.
  const refreshServerState = invalidateAll

  /**
   * GET /crews/summary only returns a member count, so names load on demand.
   * fetchQuery keeps the per-crew detail in the same cache as everything else,
   * so re-opening a tooltip after a page revisit costs nothing.
   */
  const loadMemberNames = useCallback(
    async (crewId: string) => {
      if (memberNames[crewId]) return
      try {
        const res = await queryClient.fetchQuery({
          queryKey: queryKeys.crews.detail(crewId),
          queryFn: () => getCrewById(crewId),
        })
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
    [memberNames, queryClient],
  )

  const jobMenuOptions = useMemo(
    () => jobList.map((j) => ({ id: j._id, label: j.name || `Job ID${j.jobIdNumber}` })),
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

  // GET /crews/summary accepts search & sortBy params for server-side filtering.
  const visibleCrewRows = useMemo(() => {
    if (sort !== 'rate-asc' && sort !== 'rate-desc') return crewRows
    return [...crewRows].sort((a, b) =>
      sort === 'rate-desc' ? (b.rate ?? 0) - (a.rate ?? 0) : (a.rate ?? 0) - (b.rate ?? 0),
    )
  }, [crewRows, sort])

  // GET /crews/summary with statusEmployee=roster supports server-side sorting (sortBy=nameAsc|nameDesc|rateAsc|rateDesc).
  const visibleRosterRows = rosterRows

  async function handleRemoveCrew() {
    if (flow.type !== 'editCrew') return
    setActionError('')
    try {
      await deleteCrewMutation.mutateAsync(flow.crew.id)
      setFlow({ type: 'none' })
    } catch (err) {
      setActionError(getErrorMessage(err, 'Failed to delete crew.'))
    }
  }

  async function handleRemoveMember() {
    if (flow.type !== 'editMember') return
    setActionError('')
    try {
      // Soft delete also pulls the user off their crew, so the crew lists are
      // stale too, not just the roster — the mutation invalidates both.
      await softDeleteUserMutation.mutateAsync(flow.member.id)
      setFlow({ type: 'none' })
    } catch (err) {
      setActionError(getErrorMessage(err, 'Failed to remove member.'))
    }
  }

  /**
   * Two writes are needed: the assignment record is the scheduling source of
   * truth, but GET /crews/summary reads the denormalised Job.assignToCrew, so
   * the crew's row only shows the job once that pointer is updated too.
   */
  async function assignCrewToJob(jobId: string, crewId: string, startDate: string, endDate: string, note: string) {
    await createAssignmentMutation.mutateAsync({
      jobId,
      payload: {
        crewId,
        startDate,
        endDate: endDate || undefined,
        note: note || undefined,
      },
    })
    await updateJobMutation.mutateAsync({ id: jobId, payload: { assignToCrew: crewId } })
    setFlow({ type: 'none' })
  }

  async function handleAssignJob(crewId: string, jobId: string, note: string) {
    setActionError('')
    try {
      const job = jobsById.get(jobId)
      await assignCrewToJob(jobId, crewId, assignmentStartDate(job), isoDay(job?.endDate), note)
    } catch (err) {
      setActionError(getErrorMessage(err, 'Failed to assign job.'))
    }
  }

  /** Moves a job to a different crew by opening a new assignment for it. */
  async function handleChangeCrew(jobId: string, nextCrewId: string, startDate: string, endDate: string, note: string) {
    setActionError('')
    try {
      const today = new Date().toISOString().slice(0, 10)
      await assignCrewToJob(jobId, nextCrewId, startDate < today ? today : startDate, endDate, note)
    } catch (err) {
      setActionError(getErrorMessage(err, 'Failed to reassign crew.'))
    }
  }

  /** Cancels the crew's current stint on the job. Backend refuses once started. */
  async function handleRemoveCrewFromJob(jobId: string, crewId: string) {
    setActionError('')
    try {
      const res = await queryClient.fetchQuery({
        queryKey: queryKeys.jobs.assignments(jobId),
        queryFn: () => getCrewAssignments(jobId),
      })
      const current = res.data?.find((a) => a.crewId === crewId && a.status === 'scheduled')
      if (!current) {
        setActionError('No scheduled assignment found for this crew on this job.')
        return
      }
      await deleteAssignmentMutation.mutateAsync({ jobId, assignmentId: current._id })
      setFlow({ type: 'none' })
    } catch (err) {
      setActionError(getErrorMessage(err, 'Failed to remove crew from job.'))
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
                <col style={{ width: '18%' }} />
                <col style={{ width: '44%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '12%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Crew Name</th>
                  <th>Job Name</th>
                  <th className="crew-center">Workers</th>
                  <th className="crew-center">
                    <span className="crew-th-sort">
                      Status
                      <ArrowDown size={14} weight="regular" />
                    </span>
                  </th>
                  <th className="crew-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableRowSkeleton cols={5} rows={6} height="22px" />
                ) : visibleCrewRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="crew-empty-cell">
                      No crews found
                    </td>
                  </tr>
                ) : (
                  visibleCrewRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="crew-name-cell" style={{ position: 'relative', paddingLeft: '14px' }}>
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
                          <Avatar name={row.name} size={28} />
                          {row.name}
                        </div>
                      </td>
                      <td>
                        {row.jobs.length === 0 ? (
                          <span className="crew-job-cell">
                            <span className="crew-job-cell__unassigned">Unassigned</span>
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
                      <td className="crew-center">
                        <button
                          type="button"
                          className="btn btn--primary crew-edit-action-btn"
                          onClick={() => setFlow({ type: 'editCrew', crew: row })}
                        >
                          <PenIcon size={16} />
                          <span>Edit</span>
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
                <col style={{ width: '18%' }} />
                <col style={{ width: '24%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '12%' }} />
              </colgroup>
              <thead>
                <tr>
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
                  <TableRowSkeleton cols={6} rows={6} height="22px" />
                ) : visibleRosterRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="crew-empty-cell">
                      No members found
                    </td>
                  </tr>
                ) : (
                  visibleRosterRows.map((row) => (
                    <tr key={row.id}>
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
                          className="btn btn--primary crew-edit-action-btn"
                          onClick={() => setFlow({ type: 'editMember', member: row })}
                        >
                          <PenIcon size={16} />
                          <span>Edit</span>
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
                direction="up"
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
                Page {rosterPagination.page} of {rosterPagination.totalPages || 1}
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
            refreshServerState()
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
            refreshServerState()
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
            refreshServerState()
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
            refreshServerState()
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
