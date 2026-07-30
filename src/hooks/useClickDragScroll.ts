import { useEffect, type RefObject } from 'react'

const IGNORE_SELECTOR = [
  'a',
  'button',
  'input',
  'textarea',
  'select',
  'label',
  'option',
  '[role="button"]',
  '[role="menuitem"]',
  '[contenteditable="true"]',
  '[data-no-pan]',
  '.sb-pill',
  '.sb-pill__drag-handle',
  '.sb-pill__note-badge',
  '.sb-add',
  '.sb-empty',
  '.sb-note-pill',
  '.dd__trigger',
  '.dd__menu',
  '.cell-menu',
].join(',')

/**
 * Excel-style click-and-drag panning for a scroll container.
 * Optional `horizontalTarget` scrolls a nested element horizontally
 * while this element scrolls vertically (Schedule Board split layout).
 */
export function useClickDragScroll(
  containerRef: RefObject<HTMLElement | null>,
  options?: { horizontalTarget?: RefObject<HTMLElement | null> },
) {
  const horizontalTarget = options?.horizontalTarget

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let active = false
    let moved = false
    let pointerId = -1
    let startX = 0
    let startY = 0
    let originLeft = 0
    let originTop = 0
    let originHLeft = 0

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return
      const target = e.target as HTMLElement | null
      if (!target || target.closest(IGNORE_SELECTOR)) return

      active = true
      moved = false
      pointerId = e.pointerId
      startX = e.clientX
      startY = e.clientY
      originLeft = el!.scrollLeft
      originTop = el!.scrollTop
      originHLeft = horizontalTarget?.current?.scrollLeft ?? 0
      el!.classList.add('is-panning')
      try {
        el!.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }

    function onPointerMove(e: PointerEvent) {
      if (!active || e.pointerId !== pointerId) return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (!moved && dx * dx + dy * dy < 16) return
      moved = true
      e.preventDefault()

      el!.scrollTop = originTop - dy
      const hEl = horizontalTarget?.current
      if (hEl) {
        hEl.scrollLeft = originHLeft - dx
      } else {
        el!.scrollLeft = originLeft - dx
      }
    }

    function endPan(e: PointerEvent) {
      if (!active || (pointerId !== -1 && e.pointerId !== pointerId)) return
      active = false
      pointerId = -1
      el!.classList.remove('is-panning')
      try {
        el!.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', endPan)
    el.addEventListener('pointercancel', endPan)

    return () => {
      el.classList.remove('is-panning')
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', endPan)
      el.removeEventListener('pointercancel', endPan)
    }
  }, [containerRef, horizontalTarget])
}
