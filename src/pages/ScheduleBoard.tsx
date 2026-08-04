import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  closestCenter,
  type CollisionDetection,
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
import { Icon } from '../components/dashboard/icons'
import { assignableCrews, type Job } from '../lib/dashboardData'
import {
  scheduleJobs as initialScheduleJobs,
  weeklyScheduleAssignments,
  monthlyScheduleAssignments,
  sheetPickerJobs,
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
import { useSidebarCollapsed } from '../hooks/useSidebarCollapsed'
import { SHEET_ZOOM_DEFAULT, sheetZoomStyle, stepSheetZoom } from '../lib/sheetZoom'
import './ScheduleBoard.css'

type ViewMode = 'weekly' | 'monthly'

type Flow =
  | { type: 'none' }
  | { type: 'assignCrew'; jobId: string; date: string }
  | { type: 'crewDetails'; jobId: string; date: string; assignmentId: string }
  | { type: 'assignmentNote'; jobId: string; date: string; assignmentId: string }
  | { type: 'editJob'; jobId: string }

const scheduleCollision: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  return hits.length > 0 ? hits : closestCenter(args)
}

const JOBNO_W = 72
const JOB_W = 230
const JOB_W_WEEKLY = 180
const DIVIDER_W = 10
const META_WIDTHS = [130, 130, 130, 100] as const
/** Fallback day width when monthly + separator open if we couldn't measure. */
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

// --- Resize handle (left = start edge, right = end edge) -------------------

function ResizeHandle({
  assignment,
  edge,
  color,
  compact,
}: {
  assignment: ScheduleAssignment
  edge: 'start' | 'end'
  color: string
  compact: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `extend-${edge}-${assignment.id}`,
    data: { type: 'extend' as const, edge, assignment },
  })

  return (
    <span
      ref={setNodeRef}
      className={`sb-pill__drag-handle sb-pill__drag-handle--${edge}${isDragging ? ' is-dragging' : ''}`}
      style={{ background: color }}
      title={edge === 'start' ? 'Drag left/right to change start day' : 'Drag left/right to change end day'}
      onClick={(e) => e.stopPropagation()}
      {...listeners}
      {...attributes}
    >
      {!compact && (
        <>
          <Icon.ChevronRight width={12} height={12} />
          <Icon.ChevronRight width={12} height={12} />
        </>
      )}
    </span>
  )
}

function NoteBadge({
  assignment,
  onOpenNote,
}: {
  assignment: ScheduleAssignment
  onOpenNote: () => void
}) {
  const hasNote = Boolean(assignment.note)
  const [tipPos, setTipPos] = useState<{ x: number; y: number } | null>(null)

  function showTip(el: HTMLElement) {
    if (!assignment.note) return
    const rect = el.getBoundingClientRect()
    setTipPos({ x: rect.left + rect.width / 2, y: rect.top - 6 })
  }

  return (
    <>
      <span
        className={`sb-pill__note-wrap${hasNote ? ' sb-pill__note-wrap--has-note' : ' sb-pill__note-wrap--add'}`}
        onMouseEnter={(e) => showTip(e.currentTarget)}
        onMouseLeave={() => setTipPos(null)}
      >
        <button
          type="button"
          className="sb-pill__note-badge"
          aria-label={hasNote ? 'View note' : 'Add note'}
          onClick={(e) => {
            e.stopPropagation()
            onOpenNote()
          }}
        >
          {hasNote ? <Icon.Note width={12} height={12} /> : <Icon.Edit width={12} height={12} />}
        </button>
      </span>
      {tipPos && assignment.note ? (
        <span
          className="sb-pill__tooltip sb-pill__tooltip--fixed"
          style={{ left: tipPos.x, top: tipPos.y }}
        >
          {assignment.note}
        </span>
      ) : null}
    </>
  )
}

// --- Draggable pill -------------------------------------------------------

function AssignmentPill({
  assignment,
  color,
  compact,
  span = 1,
  onOpenDetails,
  onOpenNote,
}: {
  assignment: ScheduleAssignment
  color: string
  compact: boolean
  span?: number
  onOpenDetails: () => void
  onOpenNote: () => void
}) {
  return (
    <div
      className={`sb-pill-wrap${compact ? ' sb-pill-wrap--compact' : ''}`}
      style={{ ['--sb-span' as string]: span } as CSSProperties}
    >
      <button
        type="button"
        className="sb-pill"
        style={
          compact
            ? { background: color }
            : {
                background: `color-mix(in srgb, ${color} 14%, #fff)`,
                borderColor: color,
              }
        }
        onClick={onOpenDetails}
      >
        {!compact && <span className="sb-pill__name">{assignment.crewName}</span>}
        <ResizeHandle assignment={assignment} edge="start" color={color} compact={compact} />
        <ResizeHandle assignment={assignment} edge="end" color={color} compact={compact} />
      </button>
      {!compact && <NoteBadge assignment={assignment} onOpenNote={onOpenNote} />}
    </div>
  )
}

// --- Droppable day cell -----------------------------------------------------

function DayCell({
  jobId,
  iso,
  compact,
  occupied = false,
  children,
}: {
  jobId: string
  iso: string
  compact: boolean
  occupied?: boolean
  children?: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${jobId}__${iso}`,
    data: { jobId, date: iso },
  })

  return (
    <td
      ref={setNodeRef}
      className={`${compact ? 'sb-cell sb-cell--compact' : 'sb-cell'}${occupied ? ' sb-cell--occupied' : ''}${isOver ? ' sb-cell--drop-target' : ''}`}
    >
      {children}
    </td>
  )
}

export default function ScheduleBoard() {
  const [isPhone, setIsPhone] = useState(() => window.innerWidth <= 780)
  const [jobs, setJobs] = useState(initialScheduleJobs)
  const [weeklyAssignments, setWeeklyAssignments] = useState(weeklyScheduleAssignments)
  const [monthlyAssignments, setMonthlyAssignments] = useState(monthlyScheduleAssignments)
  const [crews] = useState(assignableCrews)

  const [viewMode, setViewMode] = useState<ViewMode>('weekly')
  const [anchor, setAnchor] = useState(() => fromISO(TODAY))
  const [search, setSearch] = useState('')
  const [jobFilter, setJobFilter] = useState<string | null>(null)
  const [jumpOpen, setJumpOpen] = useState(false)
  const [metaVisible, setMetaVisible] = useState(false)
  const [zoom, setZoom] = useState(SHEET_ZOOM_DEFAULT)
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed()
  const [lockedMonthDayW, setLockedMonthDayW] = useState<number | null>(null)
  const daysTableRef = useRef<HTMLTableElement>(null)
  const boardScrollRef = useRef<HTMLDivElement>(null)

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
  const jobColW = viewMode === 'weekly' ? JOB_W_WEEKLY : JOB_W
  const dayW =
    viewMode === 'weekly'
      ? isPhone
        ? 72
        : undefined
      : metaVisible
        ? isPhone
          ? 42
          : lockedMonthDayW ?? MONTH_DAY_META_W
        : undefined
  const equalDayColPct =
    !isPhone && ((viewMode === 'weekly') || (viewMode === 'monthly' && !metaVisible))
      ? `${100 / Math.max(visibleDays.length, 1)}%`
      : undefined

  useEffect(() => {
    function handleResize() {
      setIsPhone(window.innerWidth <= 780)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (viewMode !== 'weekly') return
    const scroller = boardScrollRef.current
    if (scroller) scroller.scrollLeft = 0
  }, [viewMode, sidebarCollapsed, metaVisible, zoom])

  function openMonthly() {
    setViewMode('monthly')
    setSidebarCollapsed(true)
    setLockedMonthDayW(metaVisible ? MONTH_DAY_META_W : null)
  }

  function toggleMeta() {
    if (!metaVisible) {
      if (viewMode === 'monthly') {
        const th = daysTableRef.current?.querySelector<HTMLElement>('thead th')
        const measured = th ? Math.round(th.getBoundingClientRect().width) : 0
        setLockedMonthDayW(measured > 0 ? measured : MONTH_DAY_META_W)
      }
      setSidebarCollapsed(true)
      setMetaVisible(true)
      return
    }

    setMetaVisible(false)
    setLockedMonthDayW(null)
  }

  const rangeLabel =
    viewMode === 'weekly'
      ? `${weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${weekDays[6].getFullYear()}`
      : monthLabel(anchor)

  const filteredJobs = jobs.filter((j) => {
    const matchesSearch = !search || j.name.toLowerCase().includes(search.toLowerCase()) || j.jobNo.includes(search)
    const matchesFilter = !jobFilter || j.id === jobFilter
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
    const edge = (active.data.current?.edge as 'start' | 'end' | undefined) ?? 'end'
    const target = over.data.current as { jobId: string; date: string } | undefined
    if (!source || !target) return

    // Resize only on the same job row.
    if (source.jobId !== target.jobId) return

    // Keep assignment within Mon–Sun of its week.
    const weekMon = toISO(getMonday(fromISO(source.startDate)))
    const weekSun = toISO(addDays(fromISO(weekMon), 6))
    const clampedTarget = target.date < weekMon ? weekMon : target.date > weekSun ? weekSun : target.date

    if (edge === 'start') {
      // Left handle: drop day becomes the new start (extend left or shrink from left).
      const newStart = clampedTarget > source.endDate ? source.endDate : clampedTarget
      if (newStart === source.startDate) return
      setAssignments((list) =>
        list.map((a) => (a.id === source.id ? { ...a, startDate: newStart } : a)),
      )
      return
    }

    // Right handle: drop day becomes the new end (extend right or shrink from right).
    const newEnd = clampedTarget < source.startDate ? source.startDate : clampedTarget
    if (newEnd === source.endDate) return
    setAssignments((list) =>
      list.map((a) => (a.id === source.id ? { ...a, endDate: newEnd } : a)),
    )
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

      <main className="dash__main sb-main">
        <Topbar
          extra={
            <ZoomControl
              zoom={zoom}
              onZoomIn={() => setZoom((z) => stepSheetZoom(z, 1))}
              onZoomOut={() => setZoom((z) => stepSheetZoom(z, -1))}
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
              selectedLabel={
                jobFilter ? (sheetPickerJobs.find((j) => j.id === jobFilter)?.name ?? 'All Jobs') : 'All Jobs'
              }
              onChange={(id) => setJobFilter(id === '__all__' ? null : id)}
              options={[
                { id: '__all__', label: 'All Jobs' },
                ...sheetPickerJobs.map((j) => ({ id: j.id, label: j.name })),
              ]}
            />
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={scheduleCollision}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div
            className={`sb-board${compact ? ' sb-board--monthly' : ''}${metaVisible ? ' sb-board--meta' : ''}${
              draggingAssignment ? ' is-dragging' : ''
            }`}
          >
            <div className="sb-board__frame">
              <div
                className="sb-board__zoom"
                style={sheetZoomStyle(zoom)}
              >
              <div className="sb-board__frozen">
                <table className="sb-table sb-table--frozen">
                  <colgroup>
                    <col style={{ width: JOBNO_W * zoom }} />
                    <col style={{ width: jobColW * zoom }} />
                    {metaVisible && META_WIDTHS.map((w, i) => <col key={i} style={{ width: w * zoom }} />)}
                    <col style={{ width: DIVIDER_W * zoom }} />
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

              <div className="sb-board__scroll" ref={boardScrollRef}>
                <table
                  ref={daysTableRef}
                  className={`sb-table sb-table--days${compact ? ' sb-table--monthly' : ''}`}
                  style={
                    compact
                      ? ({
                          ['--sb-day-count' as string]: visibleDays.length,
                          ...(dayW ? { ['--sb-day-w' as string]: `${dayW * zoom}px` } : {}),
                        } as CSSProperties)
                      : undefined
                  }
                >
                  <colgroup>
                    {visibleDays.map((d) => (
                      <col
                        key={toISO(d)}
                        style={
                          equalDayColPct
                            ? { width: equalDayColPct }
                            : dayW
                              ? { width: dayW * zoom, minWidth: dayW * zoom }
                              : undefined
                        }
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
                                <div className="sb-day-head__weekday">
                                  {weekdayShort(d)}
                                </div>
                                <div className="sb-day-head__date">
                                  {d.getMonth() + 1}-{String(d.getDate()).padStart(2, '0')}-{String(d.getFullYear()).slice(2)}
                                </div>
                              </>
                            ) : (
                              <span className="sb-day-head__monthday">{d.getDate()}</span>
                            )}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJobs.map((row) => {
                      const rowAssignments = assignments.filter((a) => a.jobId === row.id)
                      return (
                        <tr key={row.id} className="sb-row">
                          {visibleDays.map((d, dayIndex) => {
                            const iso = toISO(d)
                            const assignment = rowAssignments.find(
                              (a) => iso >= a.startDate && iso <= a.endDate,
                            )

                            if (!assignment) {
                              // One crew per job — only offer Add when the job has no assignment yet.
                              if (rowAssignments.length > 0) {
                                return <DayCell key={iso} jobId={row.id} iso={iso} compact={compact} />
                              }
                              return (
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
                                </DayCell>
                              )
                            }

                            const prevIso = dayIndex > 0 ? toISO(visibleDays[dayIndex - 1]) : null
                            const isSpanStart =
                              !prevIso ||
                              !(prevIso >= assignment.startDate && prevIso <= assignment.endDate)

                            let span = 1
                            if (isSpanStart) {
                              while (
                                dayIndex + span < visibleDays.length &&
                                toISO(visibleDays[dayIndex + span]) >= assignment.startDate &&
                                toISO(visibleDays[dayIndex + span]) <= assignment.endDate
                              ) {
                                span++
                              }
                            }

                            return (
                              <DayCell key={iso} jobId={row.id} iso={iso} compact={compact} occupied>
                                {isSpanStart ? (
                                  <AssignmentPill
                                    assignment={assignment}
                                    color={row.color}
                                    compact={compact}
                                    span={span}
                                    onOpenDetails={() =>
                                      setFlow({
                                        type: 'crewDetails',
                                        jobId: row.id,
                                        date: iso,
                                        assignmentId: assignment.id,
                                      })
                                    }
                                    onOpenNote={() =>
                                      setFlow({
                                        type: 'assignmentNote',
                                        jobId: row.id,
                                        date: iso,
                                        assignmentId: assignment.id,
                                      })
                                    }
                                  />
                                ) : null}
                              </DayCell>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              </div>
            </div>
          </div>

          <DragOverlay>
            {draggingAssignment && draggingRow && viewMode !== 'weekly' && (
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
            const weekStart = getMonday(fromISO(flow.date))
            const startDate = toISO(weekStart)
            const endDate = toISO(addDays(weekStart, 6)) // Monday–Sunday
            setAssignments((list) => {
              const existingCrew = list.find((a) => a.jobId === flow.jobId)?.crewName
              // One crew per job: replacing with a different crew clears other weeks.
              const keep =
                existingCrew && existingCrew !== crew.name
                  ? list.filter((a) => a.jobId !== flow.jobId)
                  : list.filter(
                      (a) =>
                        a.jobId !== flow.jobId ||
                        a.endDate < startDate ||
                        a.startDate > endDate,
                    )
              return [
                ...keep,
                {
                  id: `sa-${Date.now()}`,
                  jobId: flow.jobId,
                  startDate,
                  endDate,
                  crewName: crew.name,
                  rate: crew.rate,
                  workers: 1,
                  note: note || undefined,
                },
              ]
            })
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
          const matchedCrew = crews.find((c) => c.name === assignment.crewName)
          return (
            <CrewDetailsModal
              job={toJob(activeRow, flow.date)}
              crewLead={{
                id: assignment.id,
                name: assignment.crewName,
                rate: assignment.rate,
                avatar: matchedCrew?.avatar,
              }}
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
