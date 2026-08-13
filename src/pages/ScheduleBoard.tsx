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
import ScheduleExtendModal from '../components/dashboard/ScheduleExtendModal'
import { Shimmer } from '../components/common/Shimmer'
import { Icon } from '../components/dashboard/icons'
import {
  createCrewAssignment,
  updateCrewAssignment,
  deleteCrewAssignment,
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
  type ViewMode,
} from '../lib/scheduleData'
import { useSidebarCollapsed } from '../hooks/useSidebarCollapsed'
import { SHEET_ZOOM_DEFAULT, sheetZoomStyle, stepSheetZoom } from '../lib/sheetZoom'
import './ScheduleBoard.css'

type DragKind = 'extend' | 'move'

/** A validated drag-and-drop move, held until the user confirms it. */
type MovePlan = {
  source: CrewAssignment
  fromJobId: string
  targetJobId: string
  newStart: string
  newEnd: string | null
  /** Stints in the destination range that confirming will delete. */
  occupants: CrewAssignment[]
  /**
   * True when the drop landed on an existing stint, so the moved crew took over
   * that stint's full date range instead of keeping its own length.
   */
  adopted: boolean
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
  | { type: 'assignCrew'; jobId: string; date: string }
  | { type: 'editAssignment'; jobId: string; assignmentId: string }
  | { type: 'dayNote'; jobId: string; date: string }
  | { type: 'confirmMove'; plan: MovePlan }
  | { type: 'confirmExtend'; plan: ExtendPlan }

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
const DIVIDER_W = 10
const META_WIDTHS = [130, 130, 130, 100] as const
/** Fallback day width when monthly + separator open if we couldn't measure. */
const MONTH_DAY_META_W = 56

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
  if (end && s > end) return false
  if (e && e < start) return false
  return true
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
  startIso,
  noteByJobDay,
  onOpenDetails,
  onOpenNote,
}: {
  assignment: CrewAssignment
  color: string
  compact: boolean
  span?: number
  startIso: string
  noteByJobDay: Map<string, DayNote>
  onOpenDetails: () => void
  onOpenNote: (date: string) => void
}) {
  const crewName = assignment.crew?.name ?? 'Crew'
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
      style={{ ['--sb-span' as string]: span } as CSSProperties}
    >
      <button
        ref={setNodeRef}
        type="button"
        className="sb-pill sb-pill--movable"
        title={assignment.note ? `${crewName} — ${assignment.note}` : crewName}
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
        {!compact && <span className="sb-pill__name">{crewName}</span>}
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

// --- Droppable day cell -----------------------------------------------------

function DayCell({
  jobId,
  iso,
  compact,
  occupied = false,
  /** This day is inside the run the hovered drop would take over. */
  replacing = false,
  disabled = false,
  children,
}: {
  jobId: string
  iso: string
  compact: boolean
  occupied?: boolean
  replacing?: boolean
  disabled?: boolean
  children?: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${jobId}__${iso}`,
    data: { jobId, date: iso },
    disabled,
  })

  // A takeover highlights the displaced crew's whole run in red; an ordinary
  // relocation just marks the hovered cell green.
  const highlight = replacing ? ' sb-cell--drop-replace' : isOver ? ' sb-cell--drop-target' : ''

  return (
    <td
      ref={setNodeRef}
      className={`${compact ? 'sb-cell sb-cell--compact' : 'sb-cell'}${occupied ? ' sb-cell--occupied' : ''}${
        disabled ? ' sb-cell--disabled' : ''
      }${highlight}`}
    >
      {disabled ? null : children}
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
  const [metaVisible, setMetaVisible] = useState(true)
  const [zoom, setZoom] = useState(SHEET_ZOOM_DEFAULT)
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed()
  const [lockedMonthDayW, setLockedMonthDayW] = useState<number | null>(null)
  const daysTableRef = useRef<HTMLTableElement>(null)
  const boardScrollRef = useRef<HTMLDivElement>(null)

  const [actionBanner, setBanner] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  const [flow, setFlow] = useState<Flow>({ type: 'none' })
  const [crewHover, setCrewHover] = useState<{ x: number; y: number; color: string; names: string[] } | null>(null)
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
    const id = setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => clearTimeout(id)
  }, [searchInput])

  const queryClient = useQueryClient()

  // Crew roster drives the legend, the pill colors and the assign picker. It is
  // the same cache entry every other screen reads, so paging around the board
  // never re-requests it.
  const { data: crews = [], error: crewsError } = useCrewsSummary()

  const scheduleParams = useMemo(
    () => ({
      startDate: rangeStart,
      view: viewMode,
      ...(search ? { search } : {}),
      ...(jobFilter ? { jobId: jobFilter } : {}),
    }),
    [rangeStart, viewMode, search, jobFilter],
  )

  const scheduleQuery = useScheduleData(scheduleParams)
  const rows: ScheduleJobRow[] = useMemo(() => scheduleQuery.data?.jobs ?? [], [scheduleQuery.data])
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
  }, [viewMode, sidebarCollapsed, metaVisible, zoom])

  function openMonthly() {
    setViewMode('monthly')
    setSidebarCollapsed(true)
    setLockedMonthDayW(metaVisible ? MONTH_DAY_META_W : null)
  }

  /** Weekly has room for the full left-hand table, so open it with the meta columns showing. */
  function openWeekly() {
    setViewMode('weekly')
    setAnchor((a) => getMonday(a))
    setMetaVisible(true)
    setSidebarCollapsed(true)
    setLockedMonthDayW(null)
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

  const rangeLabel = formatRangeLabel(visibleDays)

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

  function draftToPayload(draft: StintDraft) {
    return {
      crewId: draft.crewId,
      startDate: draft.startDate,
      // Omitting endDate leaves the stint open-ended.
      ...(draft.endDate ? { endDate: draft.endDate } : {}),
      ...(draft.excludeWeekends !== undefined ? { excludeWeekends: draft.excludeWeekends } : {}),
      ...(draft.note ? { note: draft.note } : {}),
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const a = event.active.data.current?.assignment as CrewAssignment | undefined
    setDraggingAssignment(a ?? null)
    setDragKind((event.active.data.current?.type as DragKind | undefined) ?? null)
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

  /** Best-effort re-create of stints a failed move already deleted. */
  async function restoreAssignments(jobId: string, list: CrewAssignment[]) {
    for (const a of list) {
      const { start, end } = realBounds(a)
      await createCrewAssignment(jobId, {
        crewId: a.crewId,
        startDate: start,
        ...(end ? { endDate: end } : {}),
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
    const destRow = rows.find((r) => r._id === targetJobId)

    // Dropping onto another crew's bar hands the whole of that bar's run to the
    // moved crew — a 2-day stint dropped on a 3-day one becomes those 3 days.
    // Dropping on a free day just relocates the stint at its own length.
    const displaced = destRow?.assignments.find(
      (a) => a._id !== source._id && coversDay(a, targetDate, rangeEnd),
    )
    const adopted = Boolean(displaced)
    const newStart = displaced ? realBounds(displaced).start : targetDate
    const newEnd = displaced
      ? realBounds(displaced).end
      : end === null
        ? null
        : addIsoDays(targetDate, daysBetween(start, end))

    if (!crossJob && newStart === start && newEnd === end) return null

    if (newStart < today) {
      setBanner('An assignment cannot start in the past.')
      return null
    }
    // PATCH cannot clear an end date back to null, so taking over an open-ended
    // run means re-creating the stint even when the job hasn't changed.
    if (needsRecreate(source, newEnd, targetJobId) && start < today) {
      setBanner(
        'This assignment has already started, so it cannot be moved this way — trim its end date instead.',
      )
      return null
    }

    // Only stints the board has loaded are visible here; one lying entirely
    // outside the current range is caught by the server's overlap check.
    const occupants = (destRow?.assignments ?? []).filter(
      (a) => a._id !== source._id && overlapsRange(a, newStart, newEnd),
    )

    const started = occupants.find((a) => (isoDay(a.startDate) ?? '') < today)
    if (started) {
      setBanner(
        `"${started.crew?.name ?? 'That crew'}" has already started on the destination — an assignment in progress cannot be replaced.`,
      )
      return null
    }

    return { source, fromJobId, targetJobId, newStart, newEnd, occupants, adopted }
  }

  /**
   * Carry out a confirmed move. Whatever occupies the destination range is
   * deleted first — the backend rejects any overlap, so "replace" has to be an
   * explicit delete-then-write.
   *
   * There is no endpoint that re-parents an assignment, so a move to a
   * different job is delete + create rather than a PATCH.
   */
  async function commitMove(plan: MovePlan) {
    const { source, fromJobId, targetJobId, newStart, newEnd, occupants } = plan
    const recreate = needsRecreate(source, newEnd, targetJobId)

    const previous = rows
    patchRows((list) =>
      list.map((row) => {
        if (row._id === targetJobId) {
          const kept = row.assignments.filter(
            (a) => a._id !== source._id && !occupants.some((o) => o._id === a._id),
          )
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

    const removed: CrewAssignment[] = []
    try {
      for (const occupant of occupants) {
        await deleteCrewAssignment(targetJobId, occupant._id)
        removed.push(occupant)
      }

      if (recreate) {
        await deleteCrewAssignment(fromJobId, source._id)
        try {
          await createCrewAssignment(targetJobId, {
            crewId: source.crewId,
            startDate: newStart,
            ...(newEnd ? { endDate: newEnd } : {}),
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
      await restoreAssignments(targetJobId, removed)
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

  /**
   * Days the hovered drop would hand over to the dragged crew. Non-null only
   * when the cursor is over another crew's bar, since that's the case where the
   * moved stint swallows the target's whole run.
   */
  const replacePreview = useMemo(() => {
    if (dragKind !== 'move' || !draggingAssignment || !hoverCell) return null
    const destRow = rows.find((r) => r._id === hoverCell.jobId)
    const displaced = destRow?.assignments.find(
      (a) => a._id !== draggingAssignment._id && coversDay(a, hoverCell.date, rangeEnd),
    )
    if (!displaced) return null
    const { start, end } = realBounds(displaced)
    return { jobId: hoverCell.jobId, start, end: end ?? rangeEnd }
  }, [dragKind, draggingAssignment, hoverCell, rows, rangeEnd])

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

          <div className="sb-jump">
            <button type="button" className="btn btn--outline sb-jump__btn" onClick={() => setJumpOpen((o) => !o)}>
              <CalendarBlank size={16} weight="regular" />
              Jump to date
            </button>
            {jumpOpen && (
              <input
                type="date"
                className="sb-jump__input"
                autoFocus
                onChange={(e) => {
                  if (e.target.value) {
                    const picked = fromISO(e.target.value)
                    setAnchor(viewMode === 'weekly' ? getMonday(picked) : picked)
                    setJumpOpen(false)
                  }
                }}
                onBlur={() => setJumpOpen(false)}
              />
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
            className={`sb-board${compact ? ' sb-board--monthly' : ''}${metaVisible ? ' sb-board--meta' : ''}${
              draggingAssignment ? ' is-dragging' : ''
            }`}
          >
            {loading && (
              <div className="sb-board__loading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                <Shimmer width="180px" height="18px" />
              </div>
            )}
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
                    {metaVisible && META_WIDTHS.map((w, i) => <col key={i} style={{ width: w * zoom }} />)}
                    <col style={{ width: DIVIDER_W * zoom }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="sb-col-jobno">Job ID</th>
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
                    {rows.map((row, rowIndex) => {
                      const crewObj = typeof row.currentCrew === 'object' && row.currentCrew !== null ? row.currentCrew : null
                      const crewId = crewObj?._id ?? (typeof row.currentCrew === 'string' ? row.currentCrew : null)
                      const crewName = crewObj?.name ?? (crewId ? 'Crew' : 'Unassigned')
                      const crewColor = crewId ? crewColorFor(crewId, crewObj?.crewColor) : '#94a3b8'

                      return (
                        <tr key={row._id} className="sb-row">
                          <td className="sb-col-jobno">{row.jobIdNumber}</td>
                          <td className="sb-col-job">
                            <span
                              className="sb-row-bar-hit"
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect()
                                setCrewHover({
                                  x: rect.right + 8,
                                  y: rect.top + rect.height / 2,
                                  color: crewColor,
                                  names: [crewName],
                                })
                              }}
                              onMouseLeave={() => setCrewHover(null)}
                            >
                              <i className="sb-row-bar" style={{ background: crewColor }} />
                            </span>
                            <div className="sb-job-inner">
                              <span className="sb-job-name" title={row.name ?? ''}>{row.name}</span>
                              <Icon.ChevronRight width={14} height={14} />
                            </div>
                          </td>
                          {metaVisible && (
                            <>
                              <td className="sb-col-meta">{row.generalContractor}</td>
                              <td className="sb-col-meta">{row.gcSuper}</td>
                              <td className="sb-col-meta">{row.idsSuper}</td>
                              <td className="sb-col-meta sb-col-meta--contract">
                                ${(row.contractAmount ?? 0).toLocaleString('en-US')}
                              </td>
                            </>
                          )}
                          <td className="sb-col-divider">
                            <div className="sb-divider-inner">
                              <button
                                type="button"
                                className={`sb-divider-btn${metaVisible ? ' is-open' : ''}${
                                  rowIndex === Math.floor((rows.length - 1) / 2) ? ' is-visible' : ''
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
                      const jobStartIso = row.startDate ? (isoDay(row.startDate) ?? row.startDate.slice(0, 10)) : null
                      return (
                        <tr key={row._id} className="sb-row">
                          {visibleDays.map((d, dayIndex) => {
                            const iso = toISO(d)
                            const isBeforeJobStart = Boolean(jobStartIso && iso < jobStartIso)
                            const assignment = row.assignments.find((a) => coversDay(a, iso, rangeEnd))
                            const replacing =
                              !!replacePreview &&
                              replacePreview.jobId === row._id &&
                              iso >= replacePreview.start &&
                              iso <= replacePreview.end

                            if (!assignment) {
                              // Any free day can start a new stint — a job's timeline
                              // is a sequence of crews, not a single one.
                              return (
                                <DayCell
                                  key={iso}
                                  jobId={row._id}
                                  iso={iso}
                                  compact={compact}
                                  replacing={replacing}
                                  disabled={isBeforeJobStart}
                                >
                                  {compact ? (
                                    <button
                                      type="button"
                                      className="sb-empty"
                                      onClick={() => {
                                        setModalError(null)
                                        setFlow({ type: 'assignCrew', jobId: row._id, date: iso })
                                      }}
                                    />
                                  ) : (
                                    <button
                                      type="button"
                                      className="sb-add"
                                      onClick={() => {
                                        setModalError(null)
                                        setFlow({ type: 'assignCrew', jobId: row._id, date: iso })
                                      }}
                                    >
                                      <Icon.Plus width={14} height={14} />
                                      Add
                                    </button>
                                  )}
                                </DayCell>
                              )
                            }

                            const prevIso = dayIndex > 0 ? toISO(visibleDays[dayIndex - 1]) : null
                            const isSpanStart = !prevIso || !coversDay(assignment, prevIso, rangeEnd)

                            let span = 1
                            if (isSpanStart) {
                              while (
                                dayIndex + span < visibleDays.length &&
                                coversDay(assignment, toISO(visibleDays[dayIndex + span]), rangeEnd)
                              ) {
                                span++
                              }
                            }

                            return (
                              <DayCell
                                key={iso}
                                jobId={row._id}
                                iso={iso}
                                compact={compact}
                                occupied
                                replacing={replacing}
                                disabled={isBeforeJobStart}
                              >
                              {isSpanStart ? (
                                <AssignmentPill
                                  assignment={assignment}
                                  color={crewColorFor(assignment.crewId, assignment.crew?.crewColor)}
                                  compact={compact}
                                  span={span}
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
                                  onOpenNote={(dateIso) => setFlow({ type: 'dayNote', jobId: row._id, date: dateIso })}
                                />
                              ) : null}
                            </DayCell>
                          )
                        })}
                      </tr>
                    )})}
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
      </main>

      {crewHover && (
        <div className="sb-jobno-tooltip sb-jobno-tooltip--fixed" style={{ left: crewHover.x, top: crewHover.y }}>
          {crewHover.names.map((name) => (
            <span key={name} className="sb-jobno-tooltip__pill" style={{ background: crewHover.color }}>
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
          defaultStartDate={flow.date}
          error={modalError}
          saving={saving}
          onCancel={() => setFlow({ type: 'none' })}
          onSubmit={(draft) =>
            void runMutation(
              () => createCrewAssignment(flow.jobId, draftToPayload(draft)),
              'Could not assign that crew.',
            )
          }
        />
      )}

      {flow.type === 'editAssignment' && activeRow && editing && (
        <ScheduleAssignModal
          jobName={activeRow.name ?? ''}
          jobNo={activeRow.jobIdNumber ?? ''}
          crews={crews}
          assignment={editing}
          defaultStartDate={isoDay(editing.startDate) ?? today}
          error={modalError}
          saving={saving}
          // The backend refuses to delete a stint that has already started —
          // trimming its end date is the supported way to close one out.
          canDelete={(isoDay(editing.startDate) ?? '') > today}
          onCancel={() => setFlow({ type: 'none' })}
          onSubmit={(draft) =>
            void runMutation(
              () => updateCrewAssignment(flow.jobId, editing._id, draftToPayload(draft)),
              'Could not update that assignment.',
            )
          }
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
            adopted={plan.adopted}
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
            replacing={plan.occupants.map((a) => {
              const bounds = realBounds(a)
              return {
                id: a._id,
                crewName: a.crew?.name ?? 'Crew',
                crewColor: crewColorFor(a.crewId, a.crew?.crewColor),
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
                const patch = {
                  ...plan.patch,
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
