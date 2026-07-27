import { useState } from 'react'
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
import Sidebar from '../components/dashboard/Sidebar'
import Topbar from '../components/dashboard/Topbar'
import Dropdown from '../components/dashboard/Dropdown'
import ZoomControl from '../components/dashboard/ZoomControl'
import AssignCrewModal from '../components/dashboard/AssignCrewModal'
import CrewDetailsModal from '../components/dashboard/CrewDetailsModal'
import NoteModal from '../components/dashboard/NoteModal'
import CreateJobModal from '../components/dashboard/CreateJobModal'
import { Icon } from '../components/dashboard/icons'
import { crewLeads, jobs as masterJobs, type Job } from '../lib/dashboardData'
import {
  scheduleJobs as initialScheduleJobs,
  initialScheduleAssignments,
  TODAY,
  toISO,
  fromISO,
  addDays,
  getMonday,
  weekdayShort,
  monthLabel,
  daysInMonth,
  formatMdy,
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

const JOBNO_W = 72
const JOB_W = 230
const DIVIDER_W = 24
const META_WIDTHS = [90, 130, 130, 100]

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
    <>
      <button
        type="button"
        className="sb-pill"
        title={assignment.crewName}
        style={
          compact
            ? { background: color, opacity: isDragging ? 0.35 : 1 }
            : { background: `${color}1A`, borderColor: color, opacity: isDragging ? 0.35 : 1 }
        }
        onClick={onOpenDetails}
      >
        {!compact && <span className="sb-pill__name">{assignment.crewName}</span>}
        {!compact && (
          <span
            ref={setNodeRef}
            className="sb-pill__drag-handle"
            title="Drag to extend across days"
            onClick={(e) => e.stopPropagation()}
            {...listeners}
            {...attributes}
          >
            <span className="sb-pill__drag-dot" />
            <span className="sb-pill__drag-dot" />
            <span className="sb-pill__drag-dot" />
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
    </>
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
  const [assignments, setAssignments] = useState(initialScheduleAssignments)

  const [viewMode, setViewMode] = useState<ViewMode>('weekly')
  const [anchor, setAnchor] = useState(() => fromISO(TODAY))
  const [search, setSearch] = useState('')
  const [jobFilter, setJobFilter] = useState<string | null>(null)
  const [jumpOpen, setJumpOpen] = useState(false)
  const [metaVisible, setMetaVisible] = useState(false)
  const [zoom, setZoom] = useState(1)

  const [flow, setFlow] = useState<Flow>({ type: 'none' })
  const [crewHover, setCrewHover] = useState<{ x: number; y: number; color: string; names: string[] } | null>(null)
  const [draggingAssignment, setDraggingAssignment] = useState<ScheduleAssignment | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const weekStart = getMonday(anchor)
  const weekDays = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(weekStart, i))
  const monthDays = Array.from({ length: daysInMonth(anchor) }, (_, i) => new Date(anchor.getFullYear(), anchor.getMonth(), i + 1))
  const visibleDays = viewMode === 'weekly' ? weekDays : monthDays
  const compact = viewMode === 'monthly'
  const dayW = viewMode === 'weekly' ? 150 : 46

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

  const crewLegend = Array.from(
    assignments.reduce((map, a) => {
      const row = jobs.find((j) => j.id === a.jobId)
      if (row && !map.has(a.crewName)) map.set(a.crewName, row.color)
      return map
    }, new Map<string, string>()),
  )

  const draggingRow = draggingAssignment ? jobs.find((j) => j.id === draggingAssignment.jobId) : undefined

  return (
    <div className="dash">
      <Sidebar active="Schedule Board" />

      <main className="dash__main">
        <Topbar
          onAddJob={() => {}}
          onCreateCrew={() => {}}
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
          {crewLegend.length > 0 && (
            <div className="sb-legend">
              {crewLegend.map(([name, color]) => (
                <span key={name} className="sb-legend__item">
                  <i style={{ background: color }} />
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="sb-toolbar">
          <button type="button" className="icon-btn icon-btn--bordered sb-nav-btn" onClick={goPrev}>
            <Icon.ArrowLeft width={16} height={16} />
          </button>
          <span className="sb-range">{rangeLabel}</span>
          <button type="button" className="icon-btn icon-btn--bordered sb-nav-btn" onClick={goNext}>
            <Icon.ArrowRight width={16} height={16} />
          </button>

          <div className="sb-jump">
            <button type="button" className="btn btn--outline" onClick={() => setJumpOpen((o) => !o)}>
              Jump to date
              <Icon.Calendar width={16} height={16} />
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
            <Icon.Search width={16} height={16} />
            <input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>

          <div className="sb-toggle">
            <button
              type="button"
              className={viewMode === 'monthly' ? 'is-active' : ''}
              onClick={() => setViewMode('monthly')}
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

          <Dropdown
            value={jobFilter}
            placeholder="All Jobs"
            onChange={setJobFilter}
            selectedLabel={jobFilter}
            options={masterJobs.map((j) => ({ id: j.name, label: j.name }))}
          />
        </div>

        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="sb-table-wrap" style={{ zoom }}>
            <table className="sb-table">
              <colgroup>
                <col style={{ width: JOBNO_W }} />
                <col style={{ width: JOB_W }} />
                {metaVisible && META_WIDTHS.map((w, i) => <col key={i} style={{ width: w }} />)}
                <col style={{ width: DIVIDER_W }} />
                {visibleDays.map((d) => (
                  <col key={toISO(d)} style={{ width: dayW }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th className="sb-col-jobno">Job #</th>
                  <th className="sb-col-job">Job</th>
                  {metaVisible && (
                    <>
                      <th className="sb-col-meta">IDS Super</th>
                      <th className="sb-col-meta">GC Super</th>
                      <th className="sb-col-meta">General Contractor</th>
                      <th className="sb-col-meta">Contract</th>
                    </>
                  )}
                  <th className="sb-col-divider" />
                  {visibleDays.map((d) => {
                    const iso = toISO(d)
                    const isToday = iso === TODAY
                    return (
                      <th key={iso} className={`sb-day-head ${isToday ? 'is-today' : ''} ${compact ? 'sb-day-head--compact' : ''}`}>
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
                {filteredJobs.map((row, rowIndex) => {
                  const rowAssignments = assignments.filter((a) => a.jobId === row.id)

                  // Walk the visible days left to right, collapsing any run of
                  // consecutive days covered by the same assignment into a
                  // single colSpan'd cell so a multi-day assignment renders as
                  // one continuous bar instead of one pill per day.
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
                        <DayCell key={assignment.id} jobId={row.id} iso={iso} compact={compact} colSpan={span}>
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
                      <td className="sb-col-jobno">
                        {rowAssignments.length > 0 && (
                          <span
                            className="sb-row-bar-hit"
                            onMouseEnter={(e) => {
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
                        )}
                        {row.jobNo}
                      </td>
                      <td className="sb-col-job">
                        <div className="sb-job-inner">
                          <span className="sb-job-name" title={row.name}>{row.name}</span>
                          <Icon.ChevronRight width={14} height={14} />
                        </div>
                      </td>
                      {metaVisible && (
                        <>
                          <td className="sb-col-meta">{row.idsSuper}</td>
                          <td className="sb-col-meta">{row.gcSuper}</td>
                          <td className="sb-col-meta">{row.gc}</td>
                          <td className="sb-col-meta">${row.contract.toLocaleString('en-US')}</td>
                        </>
                      )}
                      {rowIndex === 0 && (
                        <td className="sb-col-divider" rowSpan={filteredJobs.length}>
                          <div className="sb-divider-inner">
                            <button
                              type="button"
                              className="sb-divider-btn"
                              onClick={() => setMetaVisible((v) => !v)}
                              aria-label={metaVisible ? 'Hide job details' : 'Show job details'}
                            >
                              <Icon.MoreVertical width={14} height={14} />
                            </button>
                          </div>
                        </td>
                      )}
                      {dayCells}
                    </tr>
                  )
                })}
              </tbody>
            </table>
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
          onAssign={(crewLeadId, note) => {
            const lead = crewLeads.find((c) => c.id === crewLeadId)
            if (!lead) return
            setAssignments((list) => [
              ...list,
              {
                id: `sa-${Date.now()}`,
                jobId: flow.jobId,
                startDate: flow.date,
                endDate: flow.date,
                crewName: lead.name,
                rate: lead.rate,
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
    </div>
  )
}
