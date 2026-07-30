import { useState, type CSSProperties } from 'react'
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  CaretLeft,
  CaretRight,
  CalendarBlank,
  MagnifyingGlass,
} from '@phosphor-icons/react'
import Sidebar from '../components/dashboard/Sidebar'
import Topbar from '../components/dashboard/Topbar'
import Dropdown from '../components/dashboard/Dropdown'
import ZoomControl from '../components/dashboard/ZoomControl'
import AssignCrewModal from '../components/dashboard/AssignCrewModal'
import CrewDetailsModal from '../components/dashboard/CrewDetailsModal'
import NoteModal from '../components/dashboard/NoteModal'
import CreateJobModal from '../components/dashboard/CreateJobModal'
import CreateCrewModal from '../components/dashboard/CreateCrewModal'
import { Icon } from '../components/dashboard/icons'
import { assignableCrews, jobs as masterJobs, crewLeads, type Job } from '../lib/dashboardData'
import {
  scheduleJobs as initialScheduleJobs,
  weeklyScheduleAssignments,
  monthlyScheduleAssignments,
  TODAY,
  toISO,
  fromISO,
  addDays,
  getMonday,
  weekdayShort,
  monthLabel,
  formatMdy,
  monthGridDays,
  type ScheduleJob,
  type ScheduleAssignment,
} from '../lib/scheduleData'
import './ScheduleBoard.css'

type ViewMode = 'weekly' | 'monthly'

type Flow =
  | { type: 'none' }
  | { type: 'assignCrew'; jobId: string; date: string }
  | { type: 'crewDetails'; jobId: string; date: string; assignmentId: string }
  | { type: 'assignmentNote'; jobId: string; date: string; assignmentId: string }
  | { type: 'editJob'; jobId: string }
  | { type: 'newJob' }
  | { type: 'newCrew' }

const JOBNO_W = 72
const JOB_W = 230
const DIVIDER_W = 10
const META_WIDTHS = [130, 130, 130, 100] as const
/** Day column width when monthly + separator open (~15 days visible). */
const MONTH_DAY_META_W = 56

function toJob(row: ScheduleJob, date: string): Job {
  const laborBudgetTotal = Math.round(row.contract * 0.3)
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    bidNo: row.jobNo,
    jobNo: row.jobNo,
    gc: row.gc,
    estimator: row.idsSuper,
    startDate: formatMdy(date),
    endDate: formatMdy(date),
    contractAmount: row.contract,
    laborBudgetUsed: Math.round(laborBudgetTotal * 0.35),
    laborBudgetTotal,
  }
}

// --- Draggable pill -------------------------------------------------------

function AssignmentPill({
  assignment,
  color,
  compact,
  onOpenDetails,
  onOpenNote,
}: {
  assignment: ScheduleAssignment
  color: string
  compact: boolean
  onOpenDetails: () => void
  onOpenNote: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: assignment.id,
    data: { assignment },
  })

  return (
    <div className={`sb-pill-wrap${compact ? ' sb-pill-wrap--compact' : ''}`}>
      <button
        type="button"
        className="sb-pill"
        title={assignment.crewName}
        style={
          compact
            ? { background: color, opacity: isDragging ? 0.35 : 1 }
            : {
                background: `${color}1A`,
                borderColor: color,
                opacity: isDragging ? 0.35 : 1,
              }
        }
        onClick={onOpenDetails}
      >
        {!compact && <span className="sb-pill__name">{assignment.crewName}</span>}
        {!compact && (
          <span
            ref={setNodeRef}
            className="sb-pill__drag-handle"
            style={{ background: color }}
            title="Drag to extend across days"
            onClick={(e) => e.stopPropagation()}
            {...listeners}
            {...attributes}
          >
            <Icon.ChevronRight width={12} height={12} />
            <Icon.ChevronRight width={12} height={12} />
          </span>
        )}
      </button>
      {!compact && (
        <span className="sb-pill__note-wrap">
          <button
            type="button"
            className="sb-pill__note-badge"
            aria-label={assignment.note ? 'View note' : 'Add note'}
            onClick={(e) => {
              e.stopPropagation()
              onOpenNote()
            }}
          >
            {assignment.note ? <Icon.Note width={12} height={12} /> : <Icon.Edit width={12} height={12} />}
          </button>
          {assignment.note && (
            <span className="sb-pill__tooltip">
              {assignment.note}
              <i />
            </span>
          )}
        </span>
      )}
    </div>
  )
}

// --- Droppable day cell -----------------------------------------------------

function DayCell({
  jobId,
  iso,
  compact,
  colSpan = 1,
  children,
}: {
  jobId: string
  iso: string
  compact: boolean
  colSpan?: number
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${jobId}__${iso}`,
    data: { jobId, date: iso },
  })

  return (
    <td
      ref={setNodeRef}
      colSpan={colSpan}
      className={`${compact ? 'sb-cell sb-cell--compact' : 'sb-cell'}${isOver ? ' sb-cell--drop-target' : ''}`}
    >
      {children}
    </td>
  )
}

export default function ScheduleBoard() {
  const [jobs, setJobs] = useState(initialScheduleJobs)
  const [weeklyAssignments, setWeeklyAssignments] = useState(weeklyScheduleAssignments)
  const [monthlyAssignments, setMonthlyAssignments] = useState(monthlyScheduleAssignments)
  const [crews, setCrews] = useState(assignableCrews)

  const [viewMode, setViewMode] = useState<ViewMode>('weekly')
  const [anchor, setAnchor] = useState(() => fromISO(TODAY))
  const [search, setSearch] = useState('')
  const [jobFilter, setJobFilter] = useState<string | null>(null)
  const [jumpOpen, setJumpOpen] = useState(false)
  const [metaVisible, setMetaVisible] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)

  const [flow, setFlow] = useState<Flow>({ type: 'none' })
  const [crewHover, setCrewHover] = useState<{ x: number; y: number; color: string; names: string[] } | null>(null)
  const [draggingAssignment, setDraggingAssignment] = useState<ScheduleAssignment | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const assignments = viewMode === 'weekly' ? weeklyAssignments : monthlyAssignments
  const setAssignments = viewMode === 'weekly' ? setWeeklyAssignments : setMonthlyAssignments

  const weekStart = getMonday(anchor)
  const weekDays = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(weekStart, i))
  const monthDays = monthGridDays(anchor)
  const visibleDays = viewMode === 'weekly' ? weekDays : monthDays
  const compact = viewMode === 'monthly'
  const dayW =
    viewMode === 'weekly' ? 150 : metaVisible ? MONTH_DAY_META_W : undefined

  function openMonthly() {
    setViewMode('monthly')
    setSidebarCollapsed(true)
  }

  function toggleMeta() {
    setMetaVisible((v) => {
      const next = !v
      if (next) setSidebarCollapsed(true)
      return next
    })
  }

  const rangeLabel =
    viewMode === 'weekly'
      ? `${weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${weekDays[6].getFullYear()}`
      : monthLabel(anchor)

  const filteredJobs = jobs.filter((j) => {
    const matchesSearch = !search || j.name.toLowerCase().includes(search.toLowerCase()) || j.jobNo.includes(search)
    const matchesFilter = !jobFilter || j.name === jobFilter
    return matchesSearch && matchesFilter
  })

  function goPrev() {
    setAnchor(viewMode === 'weekly' ? addDays(anchor, -7) : new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))
  }
  function goNext() {
    setAnchor(viewMode === 'weekly' ? addDays(anchor, 7) : new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))
  }

  function handleDragStart(event: DragStartEvent) {
    const a = event.active.data.current?.assignment as ScheduleAssignment | undefined
    setDraggingAssignment(a ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingAssignment(null)
    const { active, over } = event
    if (!over) return

    const source = active.data.current?.assignment as ScheduleAssignment | undefined
    const target = over.data.current as { jobId: string; date: string } | undefined
    if (!source || !target) return

    // Dropped back inside its own current range: no-op.
    if (
      source.jobId === target.jobId &&
      target.date >= source.startDate &&
      target.date <= source.endDate
    ) {
      return
    }

    if (source.jobId === target.jobId) {
      // Same job row: extend the existing bar to cover the new day instead
      // of creating a duplicate pill, and absorb anything it now overlaps.
      setAssignments((list) => {
        const newStart = target.date < source.startDate ? target.date : source.startDate
        const newEnd = target.date > source.endDate ? target.date : source.endDate

        const merged = list.filter((a) => {
          if (a.id === source.id) return false
          if (a.jobId === target.jobId && a.startDate >= newStart && a.endDate <= newEnd) return false
          return true
        })

        return [...merged, { ...source, startDate: newStart, endDate: newEnd }]
      })
      return
    }

    // Different job row: keep the old "copy to another job" behavior.
    setAssignments((list) => {
      const withoutTarget = list.filter(
        (a) => !(a.jobId === target.jobId && target.date >= a.startDate && target.date <= a.endDate),
      )
      return [
        ...withoutTarget,
        {
          ...source,
          id: `sa-${Date.now()}`,
          jobId: target.jobId,
          startDate: target.date,
          endDate: target.date,
        },
      ]
    })
  }

  const activeRow = flow.type !== 'none' && 'jobId' in flow ? jobs.find((j) => j.id === flow.jobId) : undefined

  const draggingRow = draggingAssignment ? jobs.find((j) => j.id === draggingAssignment.jobId) : undefined

  return (
    <div className="dash">
      <Sidebar
        active="Schedule Board"
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />

      <main className="dash__main">
        <Topbar
          onAddJob={() => setFlow({ type: 'newJob' })}
          onCreateCrew={() => setFlow({ type: 'newCrew' })}
          extra={
            <ZoomControl
              zoom={zoom}
              onZoomIn={() => setZoom((z) => Math.min(1.5, +(z + 0.05).toFixed(2)))}
              onZoomOut={() => setZoom((z) => Math.max(0.75, +(z - 0.05).toFixed(2)))}
            />
          }
        />

        <div className="sb-header-row">
          <div>
            <h1 className="dash__title">Job Schedules</h1>
            <p className="dash__subtitle">{viewMode === 'weekly' ? 'Weekly' : 'Monthly'} crew assignments</p>
          </div>
          <div className="sb-legend">
            {crews.map((crew) => (
              <span key={crew.id} className="sb-legend__item">
                <i style={{ background: crew.color }} />
                {crew.name}
              </span>
            ))}
          </div>
        </div>

        <div className="sb-toolbar">
          <button type="button" className="icon-btn icon-btn--bordered sb-nav-btn" onClick={goPrev} aria-label="Previous">
            <CaretLeft size={16} weight="bold" />
          </button>
          <span className="sb-range">{rangeLabel}</span>
          <button type="button" className="icon-btn icon-btn--bordered sb-nav-btn" onClick={goNext} aria-label="Next">
            <CaretRight size={16} weight="bold" />
          </button>

          <div className="sb-jump">
            <button type="button" className="btn btn--outline sb-jump__btn" onClick={() => setJumpOpen((o) => !o)}>
              <CalendarBlank size={16} weight="regular" />
              {viewMode === 'monthly' ? 'Jump to month' : 'Jump to date'}
            </button>
            {jumpOpen && (
              <input
                type="date"
                className="sb-jump__input"
                autoFocus
                onChange={(e) => {
                  if (e.target.value) {
                    setAnchor(fromISO(e.target.value))
                    setJumpOpen(false)
                  }
                }}
                onBlur={() => setJumpOpen(false)}
              />
            )}
          </div>

          <label className="sb-search">
            <MagnifyingGlass size={16} weight="regular" />
            <input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>

          <div className="sb-toggle">
            <button
              type="button"
              className={viewMode === 'monthly' ? 'is-active' : ''}
              onClick={openMonthly}
            >
              Monthly
            </button>
            <button
              type="button"
              className={viewMode === 'weekly' ? 'is-active' : ''}
              onClick={() => setViewMode('weekly')}
            >
              Weekly
            </button>
          </div>

          <div className="sb-jobs-dd">
            <Dropdown
              value={jobFilter ?? '__all__'}
              placeholder="All Jobs"
              selectedLabel={jobFilter ?? 'All Jobs'}
              onChange={(id) => setJobFilter(id === '__all__' ? null : id)}
              options={[
                { id: '__all__', label: 'All Jobs' },
                ...masterJobs.map((j) => ({ id: j.name, label: j.name })),
              ]}
            />
          </div>
        </div>

        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div
            className={`sb-board${compact ? ' sb-board--monthly' : ''}${metaVisible ? ' sb-board--meta' : ''}`}
            style={{ zoom }}
          >
            <div className="sb-board__frame">
              <div className="sb-board__frozen">
                <table className="sb-table sb-table--frozen">
                  <colgroup>
                    <col style={{ width: JOBNO_W }} />
                    <col style={{ width: JOB_W }} />
                    {metaVisible && META_WIDTHS.map((w, i) => <col key={i} style={{ width: w }} />)}
                    <col style={{ width: DIVIDER_W }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="sb-col-jobno">Job #</th>
                      <th className="sb-col-job">Job</th>
                      {metaVisible && (
                        <>
                          <th className="sb-col-meta">General Contractor</th>
                          <th className="sb-col-meta">GC Super</th>
                          <th className="sb-col-meta">IDS Super</th>
                          <th className="sb-col-meta sb-col-meta--contract">Contract</th>
                        </>
                      )}
                      <th className="sb-col-divider" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJobs.map((row, rowIndex) => {
                      const rowAssignments = assignments.filter((a) => a.jobId === row.id)
                      return (
                        <tr key={row.id} className="sb-row">
                          <td className="sb-col-jobno">{row.jobNo}</td>
                          <td className="sb-col-job">
                            <span
                              className="sb-row-bar-hit"
                              onMouseEnter={(e) => {
                                if (rowAssignments.length === 0) return
                                const rect = e.currentTarget.getBoundingClientRect()
                                setCrewHover({
                                  x: rect.right + 8,
                                  y: rect.top + rect.height / 2,
                                  color: row.color,
                                  names: rowAssignments.map((a) => a.crewName),
                                })
                              }}
                              onMouseLeave={() => setCrewHover(null)}
                            >
                              <i className="sb-row-bar" style={{ background: row.color }} />
                            </span>
                            <div className="sb-job-inner">
                              <span className="sb-job-name" title={row.name}>{row.name}</span>
                              <Icon.ChevronRight width={14} height={14} />
                            </div>
                          </td>
                          {metaVisible && (
                            <>
                              <td className="sb-col-meta">{row.gc}</td>
                              <td className="sb-col-meta">{row.gcSuper}</td>
                              <td className="sb-col-meta">{row.idsSuper}</td>
                              <td className="sb-col-meta sb-col-meta--contract">${row.contract.toLocaleString('en-US')}</td>
                            </>
                          )}
                          <td className="sb-col-divider">
                            <div className="sb-divider-inner">
                              <button
                                type="button"
                                className={`sb-divider-btn${metaVisible ? ' is-open' : ''}${
                                  rowIndex === Math.floor((filteredJobs.length - 1) / 2) ? ' is-visible' : ''
                                }`}
                                onClick={toggleMeta}
                                aria-label={metaVisible ? 'Hide job details' : 'Show job details'}
                              >
                                <span className="sb-divider-btn__dots" aria-hidden>
                                  <i /><i /><i />
                                </span>
                                <span className="sb-divider-btn__arrow" aria-hidden>
                                  {metaVisible ? (
                                    <Icon.ArrowLeft width={14} height={14} />
                                  ) : (
                                    <Icon.ArrowRight width={14} height={14} />
                                  )}
                                </span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="sb-board__scroll">
                <table
                  className={`sb-table sb-table--days${compact ? ' sb-table--monthly' : ''}`}
                  style={
                    compact
                      ? ({
                          ['--sb-day-count' as string]: visibleDays.length,
                          ...(dayW ? { ['--sb-day-w' as string]: `${dayW}px` } : {}),
                        } as CSSProperties)
                      : undefined
                  }
                >
                  <colgroup>
                    {visibleDays.map((d) => (
                      <col
                        key={toISO(d)}
                        style={dayW ? { width: dayW, minWidth: dayW } : undefined}
                      />
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
                      {visibleDays.map((d) => {
                        const iso = toISO(d)
                        const isToday = iso === TODAY
                        return (
                          <th
                            key={iso}
                            className={`sb-day-head ${isToday ? 'is-today' : ''} ${compact ? 'sb-day-head--compact' : ''}`}
                          >
                            {viewMode === 'weekly' ? (
                              <>
                                <div>{isToday ? 'Today, ' + weekdayShort(d) : weekdayShort(d)}</div>
                                <div className="sb-day-head__date">{d.getMonth() + 1}-{String(d.getDate()).padStart(2, '0')}-{String(d.getFullYear()).slice(2)}</div>
                              </>
                            ) : (
                              d.getDate()
                            )}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJobs.map((row) => {
                      const rowAssignments = assignments.filter((a) => a.jobId === row.id)
                      const dayCells: React.ReactNode[] = []
                      let i = 0
                      while (i < visibleDays.length) {
                        const iso = toISO(visibleDays[i])
                        const assignment = rowAssignments.find((a) => iso >= a.startDate && iso <= a.endDate)

                        if (assignment) {
                          let span = 1
                          while (
                            i + span < visibleDays.length &&
                            toISO(visibleDays[i + span]) >= assignment.startDate &&
                            toISO(visibleDays[i + span]) <= assignment.endDate
                          ) {
                            span++
                          }

                          dayCells.push(
                            <DayCell
                              key={assignment.id}
                              jobId={row.id}
                              iso={iso}
                              compact={compact}
                              colSpan={span}
                            >
                              <AssignmentPill
                                assignment={assignment}
                                color={row.color}
                                compact={compact}
                                onOpenDetails={() =>
                                  setFlow({ type: 'crewDetails', jobId: row.id, date: iso, assignmentId: assignment.id })
                                }
                                onOpenNote={() =>
                                  setFlow({ type: 'assignmentNote', jobId: row.id, date: iso, assignmentId: assignment.id })
                                }
                              />
                            </DayCell>,
                          )
                          i += span
                        } else {
                          dayCells.push(
                            <DayCell key={iso} jobId={row.id} iso={iso} compact={compact}>
                              {compact ? (
                                <button
                                  type="button"
                                  className="sb-empty"
                                  onClick={() => setFlow({ type: 'assignCrew', jobId: row.id, date: iso })}
                                />
                              ) : (
                                <button
                                  type="button"
                                  className="sb-add"
                                  onClick={() => setFlow({ type: 'assignCrew', jobId: row.id, date: iso })}
                                >
                                  <Icon.Plus width={14} height={14} />
                                  Add
                                </button>
                              )}
                            </DayCell>,
                          )
                          i += 1
                        }
                      }

                      return (
                        <tr key={row.id} className="sb-row">
                          {dayCells}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <DragOverlay>
            {draggingAssignment && draggingRow && (
              <div
                className="sb-pill sb-pill--overlay"
                style={{ background: `${draggingRow.color}1A`, borderColor: draggingRow.color }}
              >
                <span className="sb-pill__name">{draggingAssignment.crewName}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
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

      {flow.type === 'assignCrew' && activeRow && (
        <AssignCrewModal
          job={toJob(activeRow, flow.date)}
          onCancel={() => setFlow({ type: 'none' })}
          onAssign={(crewId, note) => {
            const crew = crews.find((c) => c.id === crewId)
            if (!crew) return
            setAssignments((list) => [
              ...list,
              {
                id: `sa-${Date.now()}`,
                jobId: flow.jobId,
                startDate: flow.date,
                endDate: flow.date,
                crewName: crew.name,
                rate: crew.rate,
                workers: 1,
                note: note || undefined,
              },
            ])
            setFlow({ type: 'none' })
          }}
        />
      )}

      {flow.type === 'assignmentNote' &&
        (() => {
          const target = assignments.find((a) => a.id === flow.assignmentId)
          if (!target) return null
          return (
            <NoteModal
              note={target.note ?? null}
              onCancel={() => setFlow({ type: 'none' })}
              onSave={(text) => {
                setAssignments((list) => list.map((a) => (a.id === target.id ? { ...a, note: text } : a)))
                setFlow({ type: 'none' })
              }}
              onDelete={() => {
                setAssignments((list) => list.map((a) => (a.id === target.id ? { ...a, note: undefined } : a)))
                setFlow({ type: 'none' })
              }}
            />
          )
        })()}

      {flow.type === 'crewDetails' &&
        activeRow &&
        (() => {
          const assignment = assignments.find((a) => a.id === flow.assignmentId)
          if (!assignment) return null
          return (
            <CrewDetailsModal
              job={toJob(activeRow, flow.date)}
              crewLead={{ id: assignment.id, name: assignment.crewName, rate: assignment.rate }}
              note={assignment.note ?? ''}
              workers={assignment.workers}
              onDone={() => setFlow({ type: 'none' })}
              onEditJob={() => setFlow({ type: 'editJob', jobId: flow.jobId })}
            />
          )
        })()}

      {flow.type === 'editJob' && activeRow && (
        <CreateJobModal
          job={toJob(activeRow, TODAY)}
          onCancel={() => setFlow({ type: 'none' })}
          onSubmit={(data) => {
            setJobs((list) =>
              list.map((r) =>
                r.id === flow.jobId ? { ...r, name: data.name, gc: data.gc, color: data.color, contract: data.contractAmount } : r,
              ),
            )
            setFlow({ type: 'none' })
          }}
        />
      )}

      {flow.type === 'newJob' && (
        <CreateJobModal
          onCancel={() => setFlow({ type: 'none' })}
          onSubmit={(data) => {
            const jobNo = String(4800 + jobs.length + 1)
            setJobs((list) => [
              ...list,
              {
                id: `s${jobNo}`,
                jobNo,
                name: data.name,
                color: data.color,
                idsSuper: 'TBD',
                gcSuper: 'TBD',
                gc: data.gc,
                contract: data.contractAmount,
              },
            ])
            setFlow({ type: 'none' })
          }}
        />
      )}

      {flow.type === 'newCrew' && (
        <CreateCrewModal
          jobs={masterJobs}
          onCancel={() => setFlow({ type: 'none' })}
          onSubmit={(data) => {
            const lead = crewLeads.find((c) => c.id === data.crewLeadId)
            setCrews((list) => [
              ...list,
              {
                id: `crew-${Date.now()}`,
                name: data.crewName,
                leadName: lead?.name ?? 'TBD',
                rate: lead?.rate ?? 25,
                color: data.color,
              },
            ])
            setFlow({ type: 'none' })
          }}
        />
      )}
    </div>
  )
}
