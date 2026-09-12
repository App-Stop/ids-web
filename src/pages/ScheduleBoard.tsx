import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
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
  type DragOverEvent,
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
import NoteModal from '../components/dashboard/NoteModal'
import ScheduleAssignModal, { type StintDraft } from '../components/dashboard/ScheduleAssignModal'
import ScheduleMoveModal from '../components/dashboard/ScheduleMoveModal'
import ScheduleConflictModal from '../components/dashboard/ScheduleConflictModal'
import ScheduleExtendModal from '../components/dashboard/ScheduleExtendModal'
import { Icon } from '../components/dashboard/icons'
import ConfirmModal from '../components/dashboard/ConfirmModal'
import {
  createCrewAssignment,
  updateCrewAssignment,
  deleteCrewAssignment,
  updateJob,
  type CrewAssignment,
  type GetScheduleResponse,
  type ScheduleJobRow,
} from '../api/jobApi'
import { createDayNote, updateDayNote, deleteDayNote, type DayNote } from '../api/noteApi'
import { useQueryClient } from '@tanstack/react-query'
import { useCrewsSummary, useJobsList, useScheduleData, useDayNotesData } from '../hooks/useQueryHooks'
import { queryKeys } from '../lib/queryKeys'
import { getErrorMessage } from '../lib/errors'
import {
  toISO,
  fromISO,
  isoDay,
  todayISO,
  addDays,
  getMonday,
  rangeDays,
  weekdayShort,
  rangeLabel as formatRangeLabel,
  crewColorFor,
  formatTimeWindow,
  formatMdy,
  windowsCollide,
  rangesOverlap,
  type ViewMode,
} from '../lib/scheduleData'
import { useSidebarCollapsed } from '../hooks/useSidebarCollapsed'
import { SHEET_ZOOM_DEFAULT, sheetZoomStyle, stepSheetZoom } from '../lib/sheetZoom'
import './JobsManagement.css'
import './ScheduleBoard.css'

type DragKind = 'extend' | 'move'

/**
 * The floating crew tooltip, anchored in viewport coordinates.
 *
 * Two things raise it: the job row's colour bar, which names every crew booked
 * on that job, and a single assignment pill, which names just its own crew —
 * the monthly pill is a bare colour bar with no room for a label, so hovering
 * is the only way to read it.
 */
type CrewHover = { x: number; y: number; colors: string[]; names: string[] }

/** A validated drag-and-drop move, held until the user confirms it. */
type MovePlan = {
  source: CrewAssignment
  fromJobId: string
  targetJobId: string
  newStart: string
  newEnd: string | null
  /**
   * Other jobs already holding this crew over the destination range. Non-empty
   * means the move cannot be made at all — the crew would be in two places.
   */
  conflicts: CrewConflict[]
}

type ExtendPlan = {
  source: CrewAssignment
  edge: 'start' | 'end'
  patch: { startDate?: string; endDate?: string }
  oldStart: string
  oldEnd: string | null
  newStart: string
  newEnd: string | null
}

type Flow =
  | { type: 'none' }
  // `draft` is only set when reopening the modal on a rejected stint, so the
  // form comes back filled in rather than blank.
  | { type: 'assignCrew'; jobId: string; date: string; draft?: StintDraft }
  | { type: 'editAssignment'; jobId: string; assignmentId: string; draft?: StintDraft }
  | { type: 'dayNote'; jobId: string; date: string }
  | { type: 'confirmMove'; plan: MovePlan }
  | { type: 'confirmExtend'; plan: ExtendPlan }
  /** Clicked a day that sits before the job's own start date. */
  | { type: 'confirmPrepone'; jobId: string; date: string; jobStart: string }
  /**
   * A submitted stint would put its crew on two jobs at once. There is nothing
   * to confirm — the clash is shown so it can be resolved, and the draft is
   * kept so the modal can be reopened with the same values.
   */
  | {
      type: 'crewConflict'
      jobId: string
      draft: StintDraft
      /** Present when editing an existing stint rather than creating one. */
      assignmentId?: string
      conflicts: CrewConflict[]
    }

const scheduleCollision: CollisionDetection = (args) => {
  const { active, pointerCoordinates } = args
  const kind = active.data.current?.type as DragKind | undefined

  if (kind === 'move' && active.rect.current.translated && pointerCoordinates) {
    const leftX = active.rect.current.translated.left + 2
    const topY = pointerCoordinates.y
    const leftHits = pointerWithin({
      ...args,
      pointerCoordinates: { x: leftX, y: topY },
    })
    if (leftHits.length > 0) return leftHits
  }

  const hits = pointerWithin(args)
  return hits.length > 0 ? hits : closestCenter(args)
}

const JOBNO_W = 72
const JOB_W = 230
const JOB_W_WEEKLY = 180
/** Fallback day width when monthly + separator open if we couldn't measure. */

/** Day-string bounds of a stint, clipped to the visible range.
 *  A null endDate is open-ended, so it runs to the end of whatever we render. */
function stintBounds(assignment: CrewAssignment, rangeEnd: string) {
  const start = isoDay(assignment.startDate) ?? rangeEnd
  const end = isoDay(assignment.endDate) ?? rangeEnd
  return { start, end }
}

function coversDay(assignment: CrewAssignment, iso: string, rangeEnd: string) {
  const { start, end } = stintBounds(assignment, rangeEnd)
  return iso >= start && iso <= end
}

/** True day bounds, unclipped by the view. A null end is open-ended. */
function realBounds(assignment: CrewAssignment) {
  return { start: isoDay(assignment.startDate) ?? '', end: isoDay(assignment.endDate) }
}

function addIsoDays(iso: string, n: number) {
  return toISO(addDays(fromISO(iso), n))
}

function daysBetween(startIso: string, endIso: string) {
  return Math.round((fromISO(endIso).getTime() - fromISO(startIso).getTime()) / 86_400_000)
}

/**
 * A move that has to be delete + create rather than a PATCH: either the stint
 * changes job (no endpoint re-parents one), or it becomes open-ended, which
 * PATCH cannot express — `endDate` has no null form in the update payload.
 */
function needsRecreate(source: CrewAssignment, newEnd: string | null, targetJobId?: string) {
  if (targetJobId !== undefined && String(source.jobId) !== targetJobId) return true
  return newEnd === null && realBounds(source).end !== null
}

/** Does a stint intersect [start, end]? A null `end` means open-ended. */
function overlapsRange(assignment: CrewAssignment, start: string, end: string | null) {
  const { start: s, end: e } = realBounds(assignment)
  return rangesOverlap(s, e, start, end)
}

// --- Several crews per job, several jobs per crew ---------------------------
// A job day is not owned by one crew: any number of stints can share it, at
// identical hours if that's how the work runs. Nothing below filters them —
// it turns a row's stints into a stable stacking order so the same crew keeps
// the same slot as the eye scans across the week.

/** Round-the-clock stints first, then by time of day, then by crew name. */
function stintOrder(a: CrewAssignment, b: CrewAssignment) {
  const aTime = a.dailyStartTime ?? ''
  const bTime = b.dailyStartTime ?? ''
  if (aTime !== bTime) return aTime < bTime ? -1 : 1
  const aStart = isoDay(a.startDate) ?? ''
  const bStart = isoDay(b.startDate) ?? ''
  if (aStart !== bStart) return aStart < bStart ? -1 : 1
  return (a.crew?.name ?? '').localeCompare(b.crew?.name ?? '')
}

/**
 * A stint that already has the crew somewhere else at the same time.
 *
 * The only remaining exclusivity rule is on the crew's side: a job may run any
 * number of crews at once, including at identical hours, but a crew cannot be
 * on two jobs at the same time. So a clash is always cross-job, and it is never
 * resolved by carving up the existing stint — the new one simply cannot stand.
 */
export type CrewConflict = {
  assignment: CrewAssignment
  jobId: string
  jobName: string
  jobNo: string | number
}

/**
 * Other jobs that already hold this crew over the draft's days and hours.
 *
 * Stints on the target job itself are ignored — several crews sharing a job,
 * even round the clock, is exactly what the schedule is meant to express.
 *
 * Only the rows currently loaded are searched, so a clash with a job outside
 * the visible range (or filtered out) isn't caught here. This is an early
 * warning that saves a round trip; the server is still the authority and
 * rejects a double-booking regardless.
 */
function findCrewConflicts(
  rows: ScheduleJobRow[],
  jobId: string,
  crewId: string,
  draft: { startDate: string; endDate: string; dailyStartTime: string; dailyEndTime: string },
  excludeAssignmentId?: string,
): CrewConflict[] {
  const newStart = draft.startDate
  const newEnd = draft.endDate || null
  const conflicts: CrewConflict[] = []

  for (const row of rows) {
    if (row._id === jobId) continue
    for (const a of row.assignments) {
      if (a._id === excludeAssignmentId || a.status === 'cancelled') continue
      if (String(a.crewId) !== String(crewId)) continue
      if (!overlapsRange(a, newStart, newEnd) || !windowsCollide(a, draft)) continue
      conflicts.push({
        assignment: a,
        jobId: row._id,
        jobName: row.name ?? '',
        jobNo: row.jobIdNumber ?? '',
      })
    }
  }
  return conflicts
}

/** Per-row layout: stacking lanes for the monthly bars, plus crew summary. */
type RowMeta = {
  ordered: CrewAssignment[]
  /** Monthly only — which horizontal band each bar draws in. */
  laneOf: Map<string, number>
  laneCount: number
  /** Busiest visible day, i.e. how many chips the weekly stack must fit. */
  maxPerDay: number
  crews: Array<{ id: string; name: string; color: string }>
}

/**
 * Greedy lane packing: a bar reuses the topmost lane whose last bar has
 * already finished, so non-overlapping stints share a lane and only genuinely
 * concurrent crews push the row taller.
 */
function buildRowMeta(row: ScheduleJobRow, days: string[], rangeEnd: string): RowMeta {
  const ordered = [...row.assignments].sort(stintOrder)

  const laneEnds: string[] = []
  const laneOf = new Map<string, number>()
  for (const a of ordered) {
    const { start, end } = stintBounds(a, rangeEnd)
    let lane = laneEnds.findIndex((laneEnd) => laneEnd < start)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(end)
    } else {
      laneEnds[lane] = end
    }
    laneOf.set(a._id, lane)
  }

  let maxPerDay = 0
  for (const iso of days) {
    const count = ordered.reduce((n, a) => (coversDay(a, iso, rangeEnd) ? n + 1 : n), 0)
    if (count > maxPerDay) maxPerDay = count
  }

  const seen = new Set<string>()
  const crews: RowMeta['crews'] = []
  for (const a of ordered) {
    const id = String(a.crewId)
    if (seen.has(id)) continue
    seen.add(id)
    crews.push({
      id,
      name: a.crew?.name ?? 'Crew',
      color: crewColorFor(a.crewId, a.crew?.crewColor),
    })
  }

  return { ordered, laneOf, laneCount: Math.max(laneEnds.length, 1), maxPerDay, crews }
}

/**
 * Row height, kept identical in the frozen and scrolling tables so they line up.
 *
 * Weekly rows are sized to what the stack actually needs — one 32px chip plus a
 * 4px gap per crew, the cell's 8px insets, and a short slot for the Add button.
 * Anything beyond that is slack the stack has to absorb, which shows up as an
 * oversized Add button.
 */
const WEEKLY_CHIP_H = 36
const WEEKLY_ADD_H = 20
const WEEKLY_CELL_PAD = 16
/** Monthly: strip under the bars that holds a day's Add button. */
const MONTHLY_ADD_H = 20

function rowHeight(meta: RowMeta, view: ViewMode, zoom: number) {
  const px =
    view === 'monthly'
      ? Math.max(meta.laneCount, 1) * 22 + 10 + MONTHLY_ADD_H
      : meta.maxPerDay * WEEKLY_CHIP_H + WEEKLY_ADD_H + WEEKLY_CELL_PAD
  return Math.round(px * zoom)
}

/**
 * A date typed into "Jump to date": MM-DD-YYYY (the board's own format),
 * M/D/YY, or YYYY-MM-DD, with -, / or . between parts. Null if it isn't a
 * real calendar day.
 */
function parseTypedDate(input: string): Date | null {
  const s = input.trim()
  let y: number
  let m: number
  let d: number
  const isoMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (isoMatch) {
    y = Number(isoMatch[1])
    m = Number(isoMatch[2])
    d = Number(isoMatch[3])
  } else {
    const usMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/)
    if (!usMatch) return null
    m = Number(usMatch[1])
    d = Number(usMatch[2])
    y = Number(usMatch[3]) + (usMatch[3].length === 2 ? 2000 : 0)
  }
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null
}

// --- Resize handle (left = start edge, right = end edge) -------------------

function ResizeHandle({
  assignment,
  edge,
  color,
  compact,
}: {
  assignment: CrewAssignment
  edge: 'start' | 'end'
  color: string
  compact: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `extend-${edge}-${assignment._id}`,
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
      // The pill itself is draggable too. Keep the pointer from reaching it so
      // grabbing an edge resizes the stint instead of moving it.
      onPointerDown={(e) => {
        e.stopPropagation()
        listeners?.onPointerDown?.(e)
      }}
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

function DayNoteBadge({
  note,
  onOpen,
}: {
  note: DayNote | undefined
  onOpen: () => void
}) {
  const [tipPos, setTipPos] = useState<{ x: number; y: number } | null>(null)

  return (
    <>
      <span
        className={`sb-pill__note-wrap${note ? ' sb-pill__note-wrap--has-note' : ' sb-pill__note-wrap--add'}`}
        onMouseEnter={(e) => {
          if (!note) return
          const rect = e.currentTarget.getBoundingClientRect()
          setTipPos({ x: rect.left + rect.width / 2, y: rect.top - 6 })
        }}
        onMouseLeave={() => setTipPos(null)}
      >
        <button
          type="button"
          className="sb-pill__note-badge"
          aria-label={note ? 'View note' : 'Add note'}
          onClick={(e) => {
            e.stopPropagation()
            onOpen()
          }}
        >
          {note ? <Icon.Note width={12} height={12} /> : <Icon.Edit width={12} height={12} />}
        </button>
      </span>
      {tipPos && note ? (
        <span className="sb-pill__tooltip sb-pill__tooltip--fixed" style={{ left: tipPos.x, top: tipPos.y }}>
          {note.note}
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
  lane = 0,
  startIso,
  noteByJobDay,
  onOpenDetails,
  onOpenNote,
  onHover,
}: {
  assignment: CrewAssignment
  color: string
  compact: boolean
  span?: number
  /** Stacking band within the row — several crews can share these days. */
  lane?: number
  startIso: string
  noteByJobDay: Map<string, DayNote>
  onOpenDetails: () => void
  onOpenNote: (date: string) => void
  /** Raises the floating crew label; null while the pointer is off the pill. */
  onHover?: (hover: CrewHover | null) => void
}) {
  const crewName = assignment.crew?.name ?? 'Crew'
  const hours = formatTimeWindow(assignment.dailyStartTime, assignment.dailyEndTime)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `move-${assignment._id}`,
    data: { type: 'move' as const, assignment },
  })

  // Releasing a drag still fires a click on the pill, which would pop the edit
  // modal open on top of the move. Swallow exactly that one click; the timer
  // clears the flag when a drag ends without a click (dropped on nothing).
  const draggedRef = useRef(false)
  useEffect(() => {
    if (isDragging) {
      draggedRef.current = true
      return
    }
    if (!draggedRef.current) return
    const timer = setTimeout(() => {
      draggedRef.current = false
    }, 300)
    return () => clearTimeout(timer)
  }, [isDragging])

  // Calculate the dates spanned by this pill rendering
  const spannedDays = useMemo(() => {
    const days: string[] = []
    let curr = fromISO(startIso)
    for (let i = 0; i < span; i++) {
      days.push(toISO(curr))
      curr = addDays(curr, 1)
    }
    return days
  }, [startIso, span])

  return (
    <div
      className={`sb-pill-wrap${compact ? ' sb-pill-wrap--compact' : ''}${isDragging ? ' is-moving' : ''}`}
      style={{ ['--sb-span' as string]: span, ['--sb-lane' as string]: lane } as CSSProperties}
    >
      <button
        ref={setNodeRef}
        type="button"
        className="sb-pill sb-pill--movable"
        // Everything the pill has to say comes from the floating crew label.
        // No native title: two tooltips on one target read as a bug, and the
        // note text is not fit to surface raw.
        onMouseMove={(e) =>
          onHover?.({
            x: e.clientX + 14,
            y: e.clientY,
            colors: [color],
            names: [compact ? `${crewName} — ${hours}` : crewName],
          })
        }
        onMouseLeave={() => onHover?.(null)}
        style={
          compact
            ? { background: color }
            : {
                background: `color-mix(in srgb, ${color} 14%, #fff)`,
                borderColor: color,
              }
        }
        onClick={() => {
          if (draggedRef.current) {
            draggedRef.current = false
            return
          }
          onOpenDetails()
        }}
        {...listeners}
        {...attributes}
      >
        {!compact && (
          <>
            <span className="sb-pill__name">{crewName}</span>
            <span className="sb-pill__hours">{hours}</span>
          </>
        )}
        <ResizeHandle assignment={assignment} edge="start" color={color} compact={compact} />
        <ResizeHandle assignment={assignment} edge="end" color={color} compact={compact} />
      </button>
      {!compact && (
        <div className="sb-pill__notes-container">
          {spannedDays.map((dIso) => (
            <div key={dIso} className="sb-pill__day-note-slot">
              <DayNoteBadge
                note={noteByJobDay.get(`${assignment.jobId}__${dIso}`)}
                onOpen={() => onOpenNote(dIso)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Weekly chip ------------------------------------------------------------
// Weekly shows one chip per crew per day rather than a bar spanning the run,
// because a day can now hold several crews at different hours and each needs
// its own time label. The chips stack in the cell, ordered by time of day.

function WeeklyChip({
  assignment,
  color,
  onOpenDetails,
  onHover,
}: {
  assignment: CrewAssignment
  color: string
  onOpenDetails: () => void
  /** Raises the floating crew label; null while the pointer is off the chip. */
  onHover?: (hover: CrewHover | null) => void
}) {
  const crewName = assignment.crew?.name ?? 'Crew'
  const hours = formatTimeWindow(assignment.dailyStartTime, assignment.dailyEndTime)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `move-${assignment._id}`,
    data: { type: 'move' as const, assignment },
  })

  // Same guard as the monthly pill: the click that ends a drag must not also
  // open the edit modal on top of the move it just made.
  const draggedRef = useRef(false)
  useEffect(() => {
    if (isDragging) {
      draggedRef.current = true
      return
    }
    if (!draggedRef.current) return
    const timer = setTimeout(() => {
      draggedRef.current = false
    }, 300)
    return () => clearTimeout(timer)
  }, [isDragging])

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`sb-chip${isDragging ? ' is-moving' : ''}`}
      // The chip shows only its hours, so the crew comes from the floating
      // label rather than a native tooltip that would double up with it.
      onMouseMove={(e) =>
        onHover?.({ x: e.clientX + 14, y: e.clientY, colors: [color], names: [crewName] })
      }
      onMouseLeave={() => onHover?.(null)}
      style={{
        background: `color-mix(in srgb, ${color} 12%, #fff)`,
        borderColor: color,
        color: '#0f172a',
        position: 'relative',
      }}
      onClick={() => {
        if (draggedRef.current) {
          draggedRef.current = false
          return
        }
        onOpenDetails()
      }}
      {...listeners}
      {...attributes}
    >
      <span className="sb-chip__hours">{hours}</span>
      <ResizeHandle assignment={assignment} edge="start" color={color} compact={true} />
      <ResizeHandle assignment={assignment} edge="end" color={color} compact={true} />
    </button>
  )
}

// --- Droppable day cell -----------------------------------------------------

function DayCell({
  jobId,
  iso,
  compact,
  occupied = false,
  /** This day is inside the run the hovered drop would land on. */
  previewing = false,
  disabled = false,
  /** Before the job's own start date — allowed, but confirmed before writing. */
  preStart = false,
  children,
}: {
  jobId: string
  iso: string
  compact: boolean
  occupied?: boolean
  previewing?: boolean
  disabled?: boolean
  preStart?: boolean
  children?: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${jobId}__${iso}`,
    data: { jobId, date: iso },
    disabled,
  })

  // No drop displaces anyone now, so the whole run the stint would occupy is
  // previewed in the same colour as the cell under the cursor.
  const highlight = previewing || isOver ? ' sb-cell--drop-target' : ''

  return (
    <td
      ref={setNodeRef}
      className={`${compact ? 'sb-cell sb-cell--compact' : 'sb-cell'}${occupied ? ' sb-cell--occupied' : ''}${
        preStart ? ' sb-cell--prestart' : ''
      }${highlight}`}
    >
      {children}
    </td>
  )
}

export default function ScheduleBoard() {
  const [isPhone, setIsPhone] = useState(() => window.innerWidth <= 780)

  const [viewMode, setViewMode] = useState<ViewMode>('weekly')
  const [anchor, setAnchor] = useState(() => getMonday(new Date()))
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [jobFilter, setJobFilter] = useState<string | null>(null)
  const [jumpOpen, setJumpOpen] = useState(false)
  const [jumpText, setJumpText] = useState('')
  const [jumpError, setJumpError] = useState<string | null>(null)
  const jumpRef = useRef<HTMLDivElement>(null)
  const jumpPickerRef = useRef<HTMLInputElement>(null)
  const [zoom, setZoom] = useState(SHEET_ZOOM_DEFAULT)
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed()
  const daysTableRef = useRef<HTMLTableElement>(null)
  const boardScrollRef = useRef<HTMLDivElement>(null)

  const [actionBanner, setBanner] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  const [flow, setFlow] = useState<Flow>({ type: 'none' })
  const [crewHover, setCrewHover] = useState<CrewHover | null>(null)
  const [draggingAssignment, setDraggingAssignment] = useState<CrewAssignment | null>(null)
  const [dragKind, setDragKind] = useState<DragKind | null>(null)
  const [hoverCell, setHoverCell] = useState<{ jobId: string; date: string } | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const visibleDays = useMemo(() => rangeDays(anchor, viewMode), [anchor, viewMode])
  const rangeStart = toISO(visibleDays[0])
  const rangeEnd = toISO(visibleDays[visibleDays.length - 1])
  const today = todayISO()

  const compact = viewMode === 'monthly'
  const jobColW = viewMode === 'weekly' ? JOB_W_WEEKLY : JOB_W
  const dayW = viewMode === 'weekly' && isPhone ? 72 : undefined
  const equalDayColPct = !isPhone ? `${100 / Math.max(visibleDays.length, 1)}%` : undefined

  useEffect(() => {
    function handleResize() {
      setIsPhone(window.innerWidth <= 780)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => clearTimeout(id)
  }, [searchInput])

  const queryClient = useQueryClient()

  // Crew roster drives the legend, the pill colors and the assign picker. It is
  // the same cache entry every other screen reads, so paging around the board
  // never re-requests it.
  const { data: crews = [], error: crewsError } = useCrewsSummary()

  // The backend orders rows by "has a crew in this window", so any change to
  // the window or filters invalidates the page — it snaps back to 1 by keying
  // the stored page to the filters instead of resetting it in an effect.
  const [limit, setLimit] = useState(20)
  const filterKey = `${rangeStart}|${viewMode}|${search}|${jobFilter ?? ''}|${limit}`
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 })
  const page = pageState.key === filterKey ? pageState.page : 1
  const setPage = (next: number) => setPageState({ key: filterKey, page: next })

  const scheduleParams = useMemo(
    () => ({
      startDate: rangeStart,
      view: viewMode,
      page,
      limit,
      ...(search ? { search } : {}),
      ...(jobFilter ? { jobId: jobFilter } : {}),
    }),
    [rangeStart, viewMode, page, limit, search, jobFilter],
  )

  const scheduleQuery = useScheduleData(scheduleParams)
  const rows: ScheduleJobRow[] = useMemo(() => scheduleQuery.data?.jobs ?? [], [scheduleQuery.data])
  const pagination = scheduleQuery.data?.pagination
  const loading = scheduleQuery.isPending

  /**
   * Day notes currently come from /notes. Once the schedule endpoint embeds a
   * `notes` array per job row this query switches itself off — the embedded
   * copy is read preferentially.
   */
  const notesEmbedded = rows.some((row) => row.notes !== undefined)
  const notesParams = useMemo(
    () => ({ dateFrom: rangeStart, dateTo: rangeEnd }),
    [rangeStart, rangeEnd],
  )
  const notesQuery = useDayNotesData(notesParams, scheduleQuery.isSuccess && !notesEmbedded)

  const dayNotes: DayNote[] = useMemo(() => {
    if (notesEmbedded) {
      return rows.flatMap((row) =>
        (row.notes ?? []).map((n) => ({ ...n, createdAt: '', updatedAt: '' }) as DayNote),
      )
    }
    return notesQuery.data ?? []
  }, [notesEmbedded, rows, notesQuery.data])

  /**
   * Optimistic write straight into the cached schedule so a dragged stint lands
   * instantly. Rolled back by re-applying the previous rows if the write fails.
   */
  const patchRows = useCallback(
    (updater: (list: ScheduleJobRow[]) => ScheduleJobRow[]) => {
      queryClient.setQueryData<GetScheduleResponse['data']>(
        queryKeys.schedule.list(scheduleParams),
        (current) => (current ? { ...current, jobs: updater(current.jobs) } : current),
      )
    },
    [queryClient, scheduleParams],
  )

  /** Re-reads the board from the server and resolves once it has landed. */
  const load = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.schedule.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dayNotes.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary }),
    ])
  }, [queryClient])

  // A failed load speaks through the same banner as a failed write, but it is
  // derived rather than stored — the query owns that state.
  const loadError = scheduleQuery.error ?? crewsError
  const banner =
    actionBanner ?? (loadError ? getErrorMessage(loadError, 'Could not load the schedule.') : null)

  /**
   * The job filter reads the shared jobs cache the other screens fill, so it
   * lists every job rather than only the ones whose range happens to have been
   * visited — and normally costs no request.
   */
  const { data: allJobs = [] } = useJobsList({ limit: 100 })
  const pickerJobs = useMemo(
    () => allJobs.map((j) => ({ id: j._id, label: j.name ?? `Job ${j.jobIdNumber}` })),
    [allJobs],
  )

  useEffect(() => {
    if (viewMode !== 'weekly') return
    const scroller = boardScrollRef.current
    if (scroller) scroller.scrollLeft = 0
  }, [viewMode, sidebarCollapsed, zoom])

  function openMonthly() {
    setViewMode('monthly')
    setSidebarCollapsed(true)
  }

  function openWeekly() {
    setViewMode('weekly')
    setAnchor((a) => getMonday(a))
    setSidebarCollapsed(true)
  }

  const rangeLabel = formatRangeLabel(visibleDays)

  // The jump popover closes on any click outside it.
  useEffect(() => {
    if (!jumpOpen) return
    function handleDown(e: MouseEvent) {
      if (!jumpRef.current?.contains(e.target as Node)) setJumpOpen(false)
    }
    document.addEventListener('mousedown', handleDown)
    return () => document.removeEventListener('mousedown', handleDown)
  }, [jumpOpen])

  function toggleJump() {
    setJumpText('')
    setJumpError(null)
    setJumpOpen((o) => !o)
  }

  function jumpTo(picked: Date) {
    setAnchor(viewMode === 'weekly' ? getMonday(picked) : picked)
    setJumpOpen(false)
  }

  function submitJump() {
    const picked = parseTypedDate(jumpText)
    if (!picked) {
      setJumpError('Enter a date as MM-DD-YYYY.')
      return
    }
    jumpTo(picked)
  }

  function goPrev() {
    setAnchor(addDays(anchor, viewMode === 'weekly' ? -7 : -30))
  }
  function goNext() {
    setAnchor(addDays(anchor, viewMode === 'weekly' ? 7 : 30))
  }

  const noteByJobDay = useMemo(() => {
    const map = new Map<string, DayNote>()
    for (const note of dayNotes) {
      const day = isoDay(note.date)
      if (day) map.set(`${note.jobId}__${day}`, note)
    }
    return map
  }, [dayNotes])

  const findAssignment = useCallback(
    (jobId: string, assignmentId: string) =>
      rows.find((r) => r._id === jobId)?.assignments.find((a) => a._id === assignmentId) ?? null,
    [rows],
  )

  /**
   * Stacking layout per job row. Both tables read the heights from here so the
   * frozen job columns stay aligned with rows that have grown taller to hold
   * several crews at once.
   */
  const rowMeta = useMemo(() => {
    const isoDays = visibleDays.map(toISO)
    const map = new Map<string, RowMeta>()
    for (const row of rows) map.set(row._id, buildRowMeta(row, isoDays, rangeEnd))
    return map
  }, [rows, visibleDays, rangeEnd])

  const heightOf = useCallback(
    (jobId: string) => {
      const meta = rowMeta.get(jobId)
      return meta ? rowHeight(meta, viewMode, zoom) : undefined
    },
    [rowMeta, viewMode, zoom],
  )

  /** ISO start day of a job, or null when it somehow has none. */
  const jobStartOf = useCallback(
    (row: ScheduleJobRow) => (row.startDate ? isoDay(row.startDate) : null),
    [],
  )

  /**
   * A day cell was clicked. Days before today stay closed — the server rejects
   * a stint starting in the past either way. A day between today and the job's
   * own start is allowed, but only after confirming that the job is being
   * pulled forward.
   */
  function openAssign(row: ScheduleJobRow, iso: string) {
    setModalError(null)
    if (iso < today) {
      setBanner('An assignment cannot start in the past.')
      return
    }
    const jobStart = jobStartOf(row)
    if (jobStart && iso < jobStart) {
      setFlow({ type: 'confirmPrepone', jobId: row._id, date: iso, jobStart })
      return
    }
    setFlow({ type: 'assignCrew', jobId: row._id, date: iso })
  }

  /** Pull a job's start date back to `date`, then carry on into the assign modal. */
  async function preponeJob(jobId: string, date: string) {
    setSaving(true)
    setModalError(null)
    try {
      await updateJob(jobId, { startDate: date })
      await load()
      setFlow({ type: 'assignCrew', jobId, date })
    } catch (err) {
      setModalError(getErrorMessage(err, 'Could not move that job’s start date.'))
    } finally {
      setSaving(false)
    }
  }

  // --- Mutations ------------------------------------------------------------

  async function runMutation(action: () => Promise<unknown>, fallback: string) {
    setSaving(true)
    setModalError(null)
    try {
      await action()
      await load()
      setFlow({ type: 'none' })
      return true
    } catch (err) {
      setModalError(getErrorMessage(err, fallback))
      return false
    } finally {
      setSaving(false)
    }
  }

  /** The draft's shared window; callers add which crew(s) it is for. */
  function draftWindow(draft: StintDraft) {
    return {
      startDate: draft.startDate,
      // Omitting endDate leaves the stint open-ended.
      ...(draft.endDate ? { endDate: draft.endDate } : {}),
      // Both times or neither — the server rejects a half-specified window,
      // and neither means the crew has the job round the clock.
      ...(draft.dailyStartTime && draft.dailyEndTime
        ? { dailyStartTime: draft.dailyStartTime, dailyEndTime: draft.dailyEndTime }
        : {}),
      ...(draft.excludeWeekends !== undefined ? { excludeWeekends: draft.excludeWeekends } : {}),
      ...(draft.note ? { note: draft.note } : {}),
    }
  }

  /**
   * Create or update the stint(s) the draft describes.
   *
   * A new draft goes out as one request — the server books every crew in it,
   * or none. An existing assignment belongs to one crew, so an edit keeps that
   * crew on it (or swaps in the first picked one if it was removed) and adds
   * any other picked crews as new assignments sharing the same window.
   */
  function writeStint(jobId: string, draft: StintDraft, assignmentId?: string) {
    const several = draft.crewIds.length > 1
    return runMutation(
      async () => {
        if (!assignmentId) {
          await createCrewAssignment(jobId, { ...draftWindow(draft), crewIds: draft.crewIds })
          return
        }
        const savedCrewId = findAssignment(jobId, assignmentId)?.crewId
        const kept =
          savedCrewId && draft.crewIds.includes(String(savedCrewId)) ? String(savedCrewId) : draft.crewIds[0]
        await updateCrewAssignment(jobId, assignmentId, { ...draftWindow(draft), crewId: kept })
        const extras = draft.crewIds.filter((id) => id !== kept)
        if (extras.length) {
          await createCrewAssignment(jobId, { ...draftWindow(draft), crewIds: extras })
        }
      },
      assignmentId
        ? several
          ? 'Could not save those assignments.'
          : 'Could not update that assignment.'
        : several
          ? 'Could not assign those crews.'
          : 'Could not assign that crew.',
    )
  }

  /**
   * Save a stint from the assign modal.
   *
   * Nothing on this job stands in the way any more — a job runs as many crews
   * as it needs, whatever hours they keep. The one thing that still blocks is
   * the crew already being on another job over the same days and hours, which
   * the server rejects; catching it here says which job, rather than surfacing
   * a bare 409.
   */
  function submitStint(jobId: string, draft: StintDraft, assignmentId?: string) {
    // Every picked crew is checked; any one of them clashing stops the save.
    const conflicts = draft.crewIds.flatMap((crewId) =>
      findCrewConflicts(rows, jobId, crewId, draft, assignmentId),
    )
    if (conflicts.length > 0) {
      setModalError(null)
      setFlow({ type: 'crewConflict', jobId, draft, assignmentId, conflicts })
      return
    }
    void writeStint(jobId, draft, assignmentId)
  }

  function handleDragStart(event: DragStartEvent) {
    const a = event.active.data.current?.assignment as CrewAssignment | undefined
    setDraggingAssignment(a ?? null)
    setDragKind((event.active.data.current?.type as DragKind | undefined) ?? null)
    // The pill is about to leave under the cursor without firing mouseleave,
    // which would strand its label mid-board.
    setCrewHover(null)
  }

  function handleDragOver(event: DragOverEvent) {
    const target = event.over?.data.current as { jobId: string; date: string } | undefined
    setHoverCell(target ? { jobId: target.jobId, date: target.date } : null)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setDraggingAssignment(null)
    setDragKind(null)
    setHoverCell(null)

    const { active, over } = event
    if (!over) return

    // Read the kind off the drag payload rather than state — it's the same
    // value and can't be stale.
    const kind = active.data.current?.type as DragKind | undefined
    const source = active.data.current?.assignment as CrewAssignment | undefined
    const target = over.data.current as { jobId: string; date: string } | undefined
    if (!source || !target) return

    if (kind === 'move') {
      // Nothing is written until the confirm modal is accepted.
      const plan = planMove(source, target.jobId, target.date)
      if (plan) {
        setModalError(null)
        setFlow({ type: 'confirmMove', plan })
      }
      return
    }

    const edge = (active.data.current?.edge as 'start' | 'end' | undefined) ?? 'end'

    // Resizing only makes sense along the stint's own job row.
    if (String(source.jobId) !== String(target.jobId)) return

    const { start, end } = stintBounds(source, rangeEnd)
    const { start: realStart, end: realEnd } = realBounds(source)
    const patch =
      edge === 'start'
        ? { startDate: target.date > end ? end : target.date }
        : { endDate: target.date < start ? start : target.date }

    if (edge === 'start' && patch.startDate === start) return
    if (edge === 'end' && patch.endDate === end) return

    const newStart = patch.startDate ?? realStart
    const newEnd = patch.endDate ?? realEnd

    setModalError(null)
    setFlow({
      type: 'confirmExtend',
      plan: {
        source,
        edge,
        patch,
        oldStart: realStart,
        oldEnd: realEnd,
        newStart,
        newEnd,
      },
    })
  }

  /** Best-effort re-create of a stint a failed cross-job move already deleted. */
  async function restoreAssignments(jobId: string, list: CrewAssignment[]) {
    for (const a of list) {
      const { start, end } = realBounds(a)
      await createCrewAssignment(jobId, {
        crewId: a.crewId,
        startDate: start,
        ...(end ? { endDate: end } : {}),
        ...(a.dailyStartTime && a.dailyEndTime
          ? { dailyStartTime: a.dailyStartTime, dailyEndTime: a.dailyEndTime }
          : {}),
        ...(a.note ? { note: a.note } : {}),
      }).catch(() => {
        /* nothing left to try — the reload below shows the real state */
      })
    }
  }

  /**
   * Work out what dropping `source` on `targetJobId`/`targetDate` would do,
   * rejecting the cases the backend cannot honour. Returns null when the move
   * is a no-op or impossible — the reason goes to the banner.
   *
   * Nothing is written here; the plan goes to a confirm modal first.
   */
  function planMove(
    source: CrewAssignment,
    targetJobId: string,
    targetDate: string,
  ): MovePlan | null {
    const fromJobId = String(source.jobId)
    const { start, end } = realBounds(source)
    const crossJob = fromJobId !== targetJobId

    // A day can hold several crews, so dropping on an occupied one never means
    // taking that crew's run over — the stint simply relocates, keeping its own
    // length and daily hours, and sits alongside whoever is already there.
    const newStart = targetDate
    const newEnd = end === null ? null : addIsoDays(targetDate, daysBetween(start, end))

    if (!crossJob && newStart === start && newEnd === end) return null

    if (newStart < today) {
      setBanner('An assignment cannot start in the past.')
      return null
    }
    // PATCH cannot clear an end date back to null, so making a stint
    // open-ended means re-creating it even when the job hasn't changed.
    if (needsRecreate(source, newEnd, targetJobId) && start < today) {
      setBanner(
        'This assignment has already started, so it cannot be moved this way — trim its end date instead.',
      )
      return null
    }

    // The only thing that can stop the move: this crew being wanted on another
    // job over the same days and hours. Whoever else is on the destination job
    // is irrelevant — they keep their own stints and work alongside this one.
    const conflicts = findCrewConflicts(
      rows,
      targetJobId,
      source.crewId,
      {
        startDate: newStart,
        endDate: newEnd ?? '',
        dailyStartTime: source.dailyStartTime ?? '',
        dailyEndTime: source.dailyEndTime ?? '',
      },
      source._id,
    )

    return { source, fromJobId, targetJobId, newStart, newEnd, conflicts }
  }

  /**
   * Carry out a confirmed move.
   *
   * Nothing at the destination is touched: the crews already on that job keep
   * their stints and the moved one joins them, whatever hours they share.
   *
   * There is no endpoint that re-parents an assignment, so a move to a
   * different job is delete + create rather than a PATCH.
   */
  async function commitMove(plan: MovePlan) {
    const { source, fromJobId, targetJobId, newStart, newEnd } = plan
    const recreate = needsRecreate(source, newEnd, targetJobId)

    const previous = rows
    patchRows((list) =>
      list.map((row) => {
        if (row._id === targetJobId) {
          const kept = row.assignments.filter((a) => a._id !== source._id)
          return {
            ...row,
            assignments: [
              ...kept,
              { ...source, jobId: targetJobId, startDate: newStart, endDate: newEnd },
            ],
          }
        }
        if (row._id === fromJobId) {
          return { ...row, assignments: row.assignments.filter((a) => a._id !== source._id) }
        }
        return row
      }),
    )

    try {
      if (recreate) {
        await deleteCrewAssignment(fromJobId, source._id)
        try {
          await createCrewAssignment(targetJobId, {
            crewId: source.crewId,
            startDate: newStart,
            ...(newEnd ? { endDate: newEnd } : {}),
            // The stint keeps its daily hours through the move — that's what
            // lets the destination day hold it alongside other crews.
            ...(source.dailyStartTime && source.dailyEndTime
              ? { dailyStartTime: source.dailyStartTime, dailyEndTime: source.dailyEndTime }
              : {}),
            ...(source.note ? { note: source.note } : {}),
          })
        } catch (err) {
          // The stint is already gone — put it back where it came from so a
          // rejected move can't destroy it.
          await restoreAssignments(fromJobId, [source])
          throw err
        }
      } else {
        await updateCrewAssignment(fromJobId, source._id, {
          startDate: newStart,
          ...(newEnd ? { endDate: newEnd } : {}),
        })
      }

      await load()
      return true
    } catch (err) {
      patchRows(() => previous)
      // Reported in the confirm modal, which stays open so the move can be
      // retried or abandoned.
      setModalError(getErrorMessage(err, 'Could not move that assignment.'))
      await load()
      return false
    }
  }

  async function saveDayNote(jobId: string, date: string, text: string) {
    const existing = noteByJobDay.get(`${jobId}__${date}`)
    try {
      if (existing) {
        await updateDayNote(existing._id, { note: text })
      } else {
        await createDayNote({ jobId, date, note: text })
      }
      setFlow({ type: 'none' })
      await load()
    } catch (err) {
      setBanner(getErrorMessage(err, 'Could not save that note.'))
    }
  }

  async function removeDayNote(jobId: string, date: string) {
    const existing = noteByJobDay.get(`${jobId}__${date}`)
    if (!existing) {
      setFlow({ type: 'none' })
      return
    }
    try {
      await deleteDayNote(existing._id)
      setFlow({ type: 'none' })
      await load()
    } catch (err) {
      setBanner(getErrorMessage(err, 'Could not delete that note.'))
    }
  }

  /** The days the dragged stint would occupy if dropped where the cursor is. */
  const dropPreview = useMemo(() => {
    if (dragKind !== 'move' || !draggingAssignment || !hoverCell) return null
    const { start, end } = realBounds(draggingAssignment)
    if (!end) return { jobId: hoverCell.jobId, start: hoverCell.date, end: rangeEnd }
    const length = daysBetween(start, end)
    return {
      jobId: hoverCell.jobId,
      start: hoverCell.date,
      end: addIsoDays(hoverCell.date, length),
    }
  }, [dragKind, draggingAssignment, hoverCell, rangeEnd])

  const activeRow = flow.type !== 'none' && 'jobId' in flow ? rows.find((r) => r._id === flow.jobId) : undefined
  const draggingRow = draggingAssignment
    ? rows.find((r) => r._id === String(draggingAssignment.jobId))
    : undefined
  const editing = flow.type === 'editAssignment' ? findAssignment(flow.jobId, flow.assignmentId) : null

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
              <span key={crew._id} className="sb-legend__item">
                <i style={{ background: crewColorFor(crew._id, crew.crewColor) }} />
                {crew.name}
              </span>
            ))}
          </div>
        </div>

        {banner && (
          <div className="sb-banner" role="alert">
            {banner}
            <button type="button" onClick={() => setBanner(null)} aria-label="Dismiss">×</button>
          </div>
        )}

        <div className="sb-toolbar">
          <button type="button" className="icon-btn icon-btn--bordered sb-nav-btn" onClick={goPrev} aria-label="Previous">
            <CaretLeft size={16} weight="bold" />
          </button>
          <span className="sb-range">{rangeLabel}</span>
          <button type="button" className="icon-btn icon-btn--bordered sb-nav-btn" onClick={goNext} aria-label="Next">
            <CaretRight size={16} weight='bold'/>
          </button>

          <div className="sb-jump" ref={jumpRef}>
            <button type="button" className="btn btn--outline sb-jump__btn" onClick={toggleJump}>
              <CalendarBlank size={16} weight="regular" />
              Jump to date
            </button>
            {jumpOpen && (
              <form
                className="sb-jump__pop"
                onSubmit={(e) => {
                  e.preventDefault()
                  submitJump()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setJumpOpen(false)
                }}
              >
                <div className="sb-jump__row">
                  <input
                    type="text"
                    className="sb-jump__text"
                    placeholder="MM-DD-YYYY"
                    autoFocus
                    value={jumpText}
                    onChange={(e) => {
                      setJumpText(e.target.value)
                      setJumpError(null)
                    }}
                  />
                  <button
                    type="button"
                    className="icon-btn icon-btn--bordered sb-jump__cal"
                    aria-label="Pick from calendar"
                    onClick={() => {
                      const input = jumpPickerRef.current
                      if (!input) return
                      if ('showPicker' in input && typeof input.showPicker === 'function') input.showPicker()
                      else input.click()
                    }}
                  >
                    <CalendarBlank size={16} weight="regular" />
                  </button>
                  <input
                    ref={jumpPickerRef}
                    type="date"
                    className="sb-jump__native"
                    tabIndex={-1}
                    aria-hidden
                    onChange={(e) => {
                      if (e.target.value) jumpTo(fromISO(e.target.value))
                    }}
                  />
                  <button type="submit" className="btn btn--primary sb-jump__go">
                    Go
                  </button>
                </div>
                {jumpError && <p className="sb-jump__error">{jumpError}</p>}
              </form>
            )}
          </div>

          <label className="sb-search">
            <MagnifyingGlass size={16} weight="regular" />
            <input placeholder="Search..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </label>

          <div className="sb-toggle">
            <button type="button" className={viewMode === 'monthly' ? 'is-active' : ''} onClick={openMonthly}>
              Monthly
            </button>
            <button type="button" className={viewMode === 'weekly' ? 'is-active' : ''} onClick={openWeekly}>
              Weekly
            </button>
          </div>

          <div className="sb-jobs-dd">
            <Dropdown
              value={jobFilter ?? '__all__'}
              placeholder="All Jobs"
              selectedLabel={
                jobFilter ? (pickerJobs.find((j) => j.id === jobFilter)?.label ?? 'All Jobs') : 'All Jobs'
              }
              onChange={(id) => setJobFilter(id === '__all__' ? null : id)}
              options={[{ id: '__all__', label: 'All Jobs' }, ...pickerJobs]}
            />
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={scheduleCollision}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragCancel={() => {
            setDraggingAssignment(null)
            setDragKind(null)
            setHoverCell(null)
          }}
          onDragEnd={handleDragEnd}
        >
          <div
            className={`sb-board${compact ? ' sb-board--monthly' : ''}${
              draggingAssignment ? ' is-dragging' : ''
            }`}
          >
            {loading && <div className="sb-board__loading">Loading schedule…</div>}
            {!loading && rows.length === 0 && (
              <div className="sb-board__empty">No jobs match this range.</div>
            )}

            <div className="sb-board__frame">
              <div className="sb-board__zoom" style={sheetZoomStyle(zoom)}>
              <div className="sb-board__frozen">
                <table className="sb-table sb-table--frozen">
                  <colgroup>
                    <col style={{ width: JOBNO_W * zoom }} />
                    <col style={{ width: jobColW * zoom }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="sb-col-jobno">Job ID</th>
                      <th className="sb-col-job">Job</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const meta = rowMeta.get(row._id)
                      // The row's colour key is every crew booked on it in this
                      // range, not just whoever happens to be there today.
                      const rowCrews = meta?.crews ?? []
                      const jobStart = jobStartOf(row)
                      const startsLater = Boolean(jobStart && jobStart > today)

                      return (
                        <tr key={row._id} className="sb-row" style={{ height: heightOf(row._id) }}>
                          <td className="sb-col-jobno">{row.jobIdNumber}</td>
                          <td className="sb-col-job">
                            <span
                              className="sb-row-bar-hit"
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect()
                                setCrewHover({
                                  x: rect.right + 8,
                                  y: rect.top + rect.height / 2,
                                  colors: rowCrews.length ? rowCrews.map((c) => c.color) : ['#94a3b8'],
                                  names: rowCrews.length ? rowCrews.map((c) => c.name) : ['Unassigned'],
                                })
                              }}
                              onMouseLeave={() => setCrewHover(null)}
                            >
                              <span className="sb-row-bar-stack">
                                {(rowCrews.length
                                  ? rowCrews
                                  : [{ id: 'none', color: '#94a3b8', name: '' }]
                                ).map((c) => (
                                  <i key={c.id} className="sb-row-bar" style={{ background: c.color }} />
                                ))}
                              </span>
                            </span>
                            <div className="sb-job-inner">
                              <span className="sb-job-text">
                                <span className="sb-job-name" title={row.name ?? ''}>{row.name}</span>
                                {rowCrews.length > 1 && (
                                  <span className="sb-job-sub">{rowCrews.length} crews</span>
                                )}
                                {startsLater && jobStart && (
                                  <span className="sb-job-sub sb-job-sub--start">
                                    Starts {formatMdy(jobStart)}
                                  </span>
                                )}
                              </span>
                              
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
                        const isToday = iso === today
                        return (
                          <th
                            key={iso}
                            className={`sb-day-head ${isToday ? 'is-today' : ''} ${compact ? 'sb-day-head--compact' : ''}`}
                          >
                            {viewMode === 'weekly' ? (
                              <>
                                <div className="sb-day-head__weekday">{weekdayShort(d)}</div>
                                <div className="sb-day-head__date">
                                  {d.getMonth() + 1}-{String(d.getDate()).padStart(2, '0')}-{String(d.getFullYear()).slice(2)}
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="sb-day-head__weekday">{weekdayShort(d)}</div>
                                <span className="sb-day-head__monthday">{d.getDate()}</span>
                              </>
                            )}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const meta = rowMeta.get(row._id)
                      const ordered = meta?.ordered ?? []
                      const jobStartIso = jobStartOf(row)

                      return (
                        <tr key={row._id} className="sb-row" style={{ height: heightOf(row._id) }}>
                          {visibleDays.map((d, dayIndex) => {
                            const iso = toISO(d)
                            // Days before the job starts are open for business —
                            // taking a job early is allowed, it just gets
                            // confirmed first. Only the past stays shut.
                            const isBeforeJobStart = Boolean(jobStartIso && iso < jobStartIso)
                            const isPast = iso < today
                            // Every crew on this day, not just the first: a job
                            // can run several crews at different hours.
                            const covering = ordered.filter((a) => coversDay(a, iso, rangeEnd))
                            const previewing =
                              !!dropPreview &&
                              dropPreview.jobId === row._id &&
                              iso >= dropPreview.start &&
                              iso <= dropPreview.end

                            // Past days look like any other day but can't take new work.
                            // Monthly: an empty day is one big add target; a
                            // day with bars keeps a strip under them so another
                            // crew can still be added alongside.
                            const addButton = isPast ? null : compact ? (
                              <button
                                type="button"
                                className={covering.length > 0 ? 'sb-add sb-add--month' : 'sb-empty'}
                                title="Add"
                                aria-label="Add crew"
                                onClick={() => openAssign(row, iso)}
                              >
                                <Icon.Plus width={12} height={12} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="sb-add"
                                onClick={() => openAssign(row, iso)}
                              >
                                <Icon.Plus width={14} height={14} />
                                Add
                              </button>
                            )

                            // Weekly: a stack of per-day time chips, one per
                            // crew, plus a slot to add another.
                            if (!compact) {
                              return (
                                <DayCell
                                  key={iso}
                                  jobId={row._id}
                                  iso={iso}
                                  compact={false}
                                  occupied={covering.length > 0}
                                  previewing={previewing}
                                  disabled={isPast && covering.length === 0}
                                  preStart={isBeforeJobStart}
                                >
                                  <div className="sb-stack">
                                    {covering.map((assignment) => (
                                      <WeeklyChip
                                        key={assignment._id}
                                        assignment={assignment}
                                        color={crewColorFor(assignment.crewId, assignment.crew?.crewColor)}
                                        onOpenDetails={() => {
                                          setModalError(null)
                                          setFlow({
                                            type: 'editAssignment',
                                            jobId: row._id,
                                            assignmentId: assignment._id,
                                          })
                                        }}
                                        onHover={setCrewHover}
                                      />
                                    ))}
                                    {addButton}
                                  </div>
                                  {covering.length > 0 && (
                                    <span className="sb-cell__note">
                                      <DayNoteBadge
                                        note={noteByJobDay.get(`${row._id}__${iso}`)}
                                        onOpen={() => setFlow({ type: 'dayNote', jobId: row._id, date: iso })}
                                      />
                                    </span>
                                  )}
                                </DayCell>
                              )
                            }

                            // Monthly: spanning bars, one lane per concurrent
                            // crew. A bar is drawn by the cell its run starts in.
                            const prevIso = dayIndex > 0 ? toISO(visibleDays[dayIndex - 1]) : null
                            const starting = covering.filter(
                              (a) => !prevIso || !coversDay(a, prevIso, rangeEnd),
                            )

                            return (
                              <DayCell
                                key={iso}
                                jobId={row._id}
                                iso={iso}
                                compact
                                occupied={covering.length > 0}
                                previewing={previewing}
                                // A past day that already has bars still has to
                                // render them; only empty past days close.
                                disabled={isPast && covering.length === 0}
                                preStart={isBeforeJobStart}
                              >
                                {starting.map((assignment) => {
                                  let span = 1
                                  while (
                                    dayIndex + span < visibleDays.length &&
                                    coversDay(assignment, toISO(visibleDays[dayIndex + span]), rangeEnd)
                                  ) {
                                    span++
                                  }
                                  return (
                                    <AssignmentPill
                                      key={assignment._id}
                                      assignment={assignment}
                                      color={crewColorFor(assignment.crewId, assignment.crew?.crewColor)}
                                      compact
                                      span={span}
                                      lane={meta?.laneOf.get(assignment._id) ?? 0}
                                      startIso={iso}
                                      noteByJobDay={noteByJobDay}
                                      onOpenDetails={() => {
                                        setModalError(null)
                                        setFlow({
                                          type: 'editAssignment',
                                          jobId: row._id,
                                          assignmentId: assignment._id,
                                        })
                                      }}
                                      onOpenNote={(dateIso) =>
                                        setFlow({ type: 'dayNote', jobId: row._id, date: dateIso })
                                      }
                                      onHover={setCrewHover}
                                    />
                                  )
                                })}
                                {addButton}
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
            {/* A move needs a ghost in every view — it's the only thing that
                follows the cursor across job rows. */}
            {draggingAssignment && draggingRow && (dragKind === 'move' || viewMode !== 'weekly') && (
              <div
                className="sb-pill sb-pill--overlay"
                style={{
                  background: `${crewColorFor(draggingAssignment.crewId, draggingAssignment.crew?.crewColor)}1A`,
                  borderColor: crewColorFor(draggingAssignment.crewId, draggingAssignment.crew?.crewColor),
                }}
              >
                <span className="sb-pill__name">{draggingAssignment.crew?.name ?? 'Crew'}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>

        <div className="jm-pagination-bar">
          <div className="jm-pagination-limit">
            <span>Show:</span>
            <Dropdown
              placement="top"
              value={String(limit)}
              onChange={(v) => setLimit(Number(v))}
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
              Page {pagination?.page ?? page} of {pagination?.totalPages ?? 1}
              {pagination ? ` · ${pagination.total} Jobs` : ''}
            </span>
            <div className="jm-pagination-btns">
              <button
                type="button"
                className="btn btn--outline jm-page-btn"
                disabled={loading || !pagination?.hasPrevPage}
                onClick={() => setPage(Math.max(1, (pagination?.page ?? page) - 1))}
              >
                <CaretLeft size={16} /> Previous
              </button>
              <button
                type="button"
                className="btn btn--outline jm-page-btn"
                disabled={loading || !pagination?.hasNextPage}
                onClick={() => setPage((pagination?.page ?? page) + 1)}
              >
                Next <CaretRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </main>

      {crewHover && (
        <div className="sb-jobno-tooltip sb-jobno-tooltip--fixed" style={{ left: crewHover.x, top: crewHover.y }}>
          {crewHover.names.map((name, i) => (
            <span
              key={name}
              className="sb-jobno-tooltip__pill"
              style={{ background: crewHover.colors[i] ?? crewHover.colors[0] }}
            >
              {name}
            </span>
          ))}
        </div>
      )}

      {flow.type === 'assignCrew' && activeRow && (
        <ScheduleAssignModal
          jobName={activeRow.name ?? ''}
          jobNo={activeRow.jobIdNumber ?? ''}
          crews={crews}
          initialDraft={flow.draft}
          error={modalError}
          saving={saving}
          onCancel={() => setFlow({ type: 'none' })}
          onSubmit={(draft) => submitStint(flow.jobId, draft)}
        />
      )}

      {flow.type === 'editAssignment' && activeRow && editing && (
        <ScheduleAssignModal
          jobName={activeRow.name ?? ''}
          jobNo={activeRow.jobIdNumber ?? ''}
          crews={crews}
          assignment={editing}
          initialDraft={flow.draft}
          error={modalError}
          saving={saving}
          // The backend refuses to delete a stint that has already started —
          // trimming its end date is the supported way to close one out.
          canDelete={(isoDay(editing.startDate) ?? '') > today}
          onCancel={() => setFlow({ type: 'none' })}
          onSubmit={(draft) => submitStint(flow.jobId, draft, editing._id)}
          onDelete={() =>
            void runMutation(
              () => deleteCrewAssignment(flow.jobId, editing._id),
              'Could not remove that assignment.',
            )
          }
        />
      )}

      {flow.type === 'confirmMove' && (() => {
        const { plan } = flow
        const fromRow = rows.find((r) => r._id === plan.fromJobId)
        const toRow = rows.find((r) => r._id === plan.targetJobId)
        const { start, end } = realBounds(plan.source)

        return (
          <ScheduleMoveModal
            crewName={plan.source.crew?.name ?? 'Crew'}
            crewColor={crewColorFor(plan.source.crewId, plan.source.crew?.crewColor)}
            sameJob={plan.fromJobId === plan.targetJobId}
            from={{
              jobName: fromRow?.name ?? '',
              jobNo: fromRow?.jobIdNumber ?? '',
              start,
              end,
            }}
            to={{
              jobName: toRow?.name ?? '',
              jobNo: toRow?.jobIdNumber ?? '',
              start: plan.newStart,
              end: plan.newEnd,
            }}
            conflicts={plan.conflicts.map(({ assignment, jobName, jobNo }) => {
              const bounds = realBounds(assignment)
              return {
                id: assignment._id,
                jobName,
                jobNo,
                start: bounds.start,
                end: bounds.end,
              }
            })}
            saving={saving}
            error={modalError}
            onCancel={() => setFlow({ type: 'none' })}
            onConfirm={() => {
              void (async () => {
                setSaving(true)
                setModalError(null)
                const ok = await commitMove(plan)
                setSaving(false)
                if (ok) setFlow({ type: 'none' })
              })()
            }}
          />
        )
      })()}

      {flow.type === 'confirmExtend' && (() => {
        const { plan } = flow
        const jobRow = rows.find((r) => r._id === plan.source.jobId)

        return (
          <ScheduleExtendModal
            crewName={plan.source.crew?.name ?? 'Crew'}
            crewColor={crewColorFor(plan.source.crewId, plan.source.crew?.crewColor)}
            jobName={jobRow?.name ?? ''}
            jobNo={jobRow?.jobIdNumber ?? ''}
            edge={plan.edge}
            from={{ start: plan.oldStart, end: plan.oldEnd }}
            to={{ start: plan.newStart, end: plan.newEnd }}
            defaultExcludeWeekends={plan.source.excludeWeekends ?? false}
            saving={saving}
            error={modalError}
            onCancel={() => setFlow({ type: 'none' })}
            onConfirm={(excludeWeekends) => {
              void (async () => {
                // The backend rejects excludeWeekends without an endDate in the
                // same body, and a start-edge drag's patch carries only startDate.
                if (excludeWeekends && !plan.newEnd) {
                  setModalError('Excluding weekends needs an end date — set one on this assignment first.')
                  return
                }
                const patch = {
                  ...plan.patch,
                  ...(excludeWeekends && plan.newEnd ? { endDate: plan.newEnd } : {}),
                  excludeWeekends,
                }
                const ok = await runMutation(
                  () => updateCrewAssignment(String(plan.source.jobId), plan.source._id, patch),
                  'Could not update that assignment.',
                )
                if (ok) setFlow({ type: 'none' })
              })()
            }}
          />
        )
      })()}

      {flow.type === 'crewConflict' && (() => {
        const { jobId, draft, assignmentId, conflicts } = flow
        const row = rows.find((r) => r._id === jobId)
        const crewInfo = (crewId: string) => {
          const crew = crews.find((c) => c._id === crewId)
          return { id: crewId, name: crew?.name ?? 'Crew', color: crewColorFor(crewId, crew?.crewColor) }
        }
        // Only the crews that actually clash are named; the rest of the draft is fine.
        const clashingCrews = [...new Set(conflicts.map((c) => String(c.assignment.crewId)))].map(crewInfo)

        return (
          <ScheduleConflictModal
            crews={clashingCrews}
            jobName={row?.name ?? ''}
            jobNo={row?.jobIdNumber ?? ''}
            start={draft.startDate}
            end={draft.endDate || null}
            dailyStartTime={draft.dailyStartTime || null}
            dailyEndTime={draft.dailyEndTime || null}
            conflicts={conflicts.map(({ assignment, jobName, jobNo }) => {
              const bounds = realBounds(assignment)
              const crew = crewInfo(String(assignment.crewId))
              return {
                id: assignment._id,
                crewName: crew.name,
                crewColor: crew.color,
                jobName,
                jobNo,
                start: bounds.start,
                end: bounds.end,
                dailyStartTime: assignment.dailyStartTime,
                dailyEndTime: assignment.dailyEndTime,
              }
            })}
            onClose={() => setFlow({ type: 'none' })}
            onBack={() =>
              setFlow(
                assignmentId
                  ? { type: 'editAssignment', jobId, assignmentId, draft }
                  : { type: 'assignCrew', jobId, date: draft.startDate, draft },
              )
            }
          />
        )
      })()}

      {flow.type === 'confirmPrepone' && (() => {
        const { jobId, date, jobStart } = flow
        const row = rows.find((r) => r._id === jobId)
        return (
          <ConfirmModal
            iconType="question"
            confirmBtnClass="btn--primary"
            title="Start this job earlier?"
            message={`${row?.name ?? 'This job'} is scheduled to start on ${formatMdy(jobStart)}. Assigning a crew on ${formatMdy(date)} moves the job's start date forward to that day.`}
            confirmLabel={saving ? 'Moving…' : 'Yes, move start date'}
            onCancel={() => setFlow({ type: 'none' })}
            onConfirm={() => void preponeJob(jobId, date)}
          />
        )
      })()}

      {flow.type === 'dayNote' && (() => {
        const targetRow = rows.find((r) => r._id === flow.jobId)
        return (
          <NoteModal
            note={noteByJobDay.get(`${flow.jobId}__${flow.date}`)?.note ?? null}
            jobName={targetRow?.name}
            jobNo={targetRow?.jobIdNumber}
            date={flow.date}
            onCancel={() => setFlow({ type: 'none' })}
            onSave={(text) => void saveDayNote(flow.jobId, flow.date, text)}
            onDelete={() => void removeDayNote(flow.jobId, flow.date)}
          />
        )
      })()}
    </div>
  )
}
