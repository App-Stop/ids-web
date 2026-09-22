import { useCallback, useState } from 'react'

/**
 * The sidebar no longer has an open/closed state: it rests as a 60px icon rail
 * and unfurls over the page on hover, so the layout is always laid out as if
 * it were collapsed. Pages still read this to recompute grid widths, so it
 * keeps its shape and simply always reports `true`.
 */
export function readSidebarCollapsed(): boolean {
  return true
}

export function useSidebarCollapsed() {
  const [collapsed] = useState(true)
  // Kept as a setter so existing callers still type-check; the sidebar is
  // hover-driven now, so there is nothing to store.
  const setCollapsed = useCallback((next: boolean) => void next, [])
  return [collapsed, setCollapsed] as const
}
