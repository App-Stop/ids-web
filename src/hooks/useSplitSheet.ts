import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useClickDragScroll } from './useClickDragScroll'

/** Day-pane width in px: default (~5 columns visible), and its drag bounds. */
const DAY_PANE_DEFAULT_W = 520
const DAY_PANE_MIN_W = 180
const DAY_PANE_MAX_W = 1100

/**
 * Every row height of `source`, header row first, kept live.
 *
 * The two panes are separate `<table>`s so they can scroll apart, which means
 * nothing lines their rows up on its own — a job with four crews is taller on
 * the left than its (uniform) day cells are on the right. The left table owns
 * the heights and the right one is told what they are, index for index: both
 * render one header row followed by the same jobs in the same order.
 */
export function useSyncedRowHeights(
  source: React.RefObject<HTMLTableElement | null>,
  deps: unknown[],
): number[] {
  const [heights, setHeights] = useState<number[]>([])

  useLayoutEffect(() => {
    const table = source.current
    if (!table) return

    const measure = () => {
      const next = Array.from(table.rows).map((r) => r.getBoundingClientRect().height)
      setHeights((prev) =>
        prev.length === next.length && prev.every((h, i) => Math.abs(h - next[i]) < 0.5) ? prev : next,
      )
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(table)
    for (const row of Array.from(table.rows)) observer.observe(row)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return heights
}

/**
 * The two-pane sheet Jobs Management and Revenue share: job columns on the
 * left, a day strip on the right. The panes scroll independently and only
 * their vertical scroll is kept in step, so the day strip pans sideways
 * without dragging the table with it. The grip between them resizes the day
 * pane when dragged and collapses the left columns when clicked; the collapse
 * is remembered under `storageKey`.
 */
export function useSplitSheet(storageKey: string) {
  const mainPaneRef = useRef<HTMLDivElement>(null)
  const dayPaneRef = useRef<HTMLDivElement>(null)
  useClickDragScroll(mainPaneRef)
  useClickDragScroll(dayPaneRef)
  const [dayPaneWidth, setDayPaneWidth] = useState(DAY_PANE_DEFAULT_W)
  const [leftCollapsed, setLeftCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(storageKey) === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(leftCollapsed))
    } catch {
      // ignore
    }
  }, [storageKey, leftCollapsed])

  // Vertical only, and guarded so the echo from setting the other pane's
  // scrollTop doesn't bounce straight back.
  const syncingRef = useRef(false)
  const syncVertical = useCallback((from: 'main' | 'day') => {
    if (syncingRef.current) return
    const source = from === 'main' ? mainPaneRef.current : dayPaneRef.current
    const target = from === 'main' ? dayPaneRef.current : mainPaneRef.current
    if (!source || !target || target.scrollTop === source.scrollTop) return
    syncingRef.current = true
    target.scrollTop = source.scrollTop
    requestAnimationFrame(() => {
      syncingRef.current = false
    })
  }, [])

  function toggleLeftCollapse() {
    setLeftCollapsed((prev) => {
      const next = !prev
      if (next && mainPaneRef.current && mainPaneRef.current.scrollLeft > 0) {
        mainPaneRef.current.scrollTo({ left: 0, behavior: 'smooth' })
      }
      return next
    })
  }

  /** Drag the grip to resize, or click to toggle collapse of left columns. */
  function startPaneResize(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const startWidth =
      leftCollapsed && dayPaneRef.current
        ? dayPaneRef.current.getBoundingClientRect().width
        : dayPaneWidth
    let moved = false

    const onMove = (ev: PointerEvent) => {
      if (!moved) {
        if (Math.abs(ev.clientX - startX) > 4 || Math.abs(ev.clientY - startY) > 4) {
          moved = true
          document.body.classList.add('is-col-resizing')
        }
      }
      if (moved) {
        if (leftCollapsed) {
          setLeftCollapsed(false)
        }
        const next = startWidth + (startX - ev.clientX)
        setDayPaneWidth(Math.min(DAY_PANE_MAX_W, Math.max(DAY_PANE_MIN_W, next)))
      }
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.classList.remove('is-col-resizing')
      if (!moved) {
        toggleLeftCollapse()
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return {
    mainPaneRef,
    dayPaneRef,
    dayPaneWidth,
    leftCollapsed,
    syncVertical,
    toggleLeftCollapse,
    startPaneResize,
  }
}
