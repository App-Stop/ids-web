import type { CSSProperties } from 'react'

export const SHEET_ZOOM_MIN = 0.85
export const SHEET_ZOOM_MAX = 1
export const SHEET_ZOOM_DEFAULT = 1
export const SHEET_ZOOM_STEP = 0.05

export function clampSheetZoom(zoom: number) {
  return Math.min(SHEET_ZOOM_MAX, Math.max(SHEET_ZOOM_MIN, +zoom.toFixed(2)))
}

export function stepSheetZoom(zoom: number, direction: 1 | -1) {
  return clampSheetZoom(zoom + direction * SHEET_ZOOM_STEP)
}

/** Zoom the sheet content using standard CSS variable scaling. */
export function sheetZoomStyle(zoom: number): CSSProperties {
  return {
    '--table-zoom': zoom,
  } as CSSProperties
}
