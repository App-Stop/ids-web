import { useCallback, useState } from 'react'

const STORAGE_KEY = 'ids-sidebar-collapsed'

export function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeSidebarCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
  } catch {
    /* ignore quota / private mode */
  }
}

/** Persists across routes and resizes; only changes when set explicitly. */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsedState] = useState(readSidebarCollapsed)

  const setCollapsed = useCallback((next: boolean) => {
    writeSidebarCollapsed(next)
    setCollapsedState(next)
  }, [])

  return [collapsed, setCollapsed] as const
}
