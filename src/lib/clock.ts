/* Local clock-in/out state for the crew home screen.
 *
 * The backend has no timesheet endpoints yet, so shifts are kept in
 * localStorage. Everything the UI needs goes through this module, so swapping
 * in a real API later means replacing these functions and nothing else. */

const OPEN_KEY = 'crew.clock.open'
const SHIFTS_KEY = 'crew.clock.shifts'

export const WEEKLY_TARGET_HOURS = 40

export interface OpenShift {
  startedAt: string
  /** Address recorded at clock-in, when geolocation and a job are available. */
  location?: string | null
}

export interface Shift {
  startedAt: string
  endedAt: string
  location?: string | null
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function getOpenShift(): OpenShift | null {
  return read<OpenShift | null>(OPEN_KEY, null)
}

export function getShifts(): Shift[] {
  return read<Shift[]>(SHIFTS_KEY, [])
}

export function startShift(location?: string | null): OpenShift {
  const shift: OpenShift = { startedAt: new Date().toISOString(), location }
  localStorage.setItem(OPEN_KEY, JSON.stringify(shift))
  return shift
}

export function endShift(): void {
  const open = getOpenShift()
  if (!open) return
  const shifts = getShifts()
  shifts.push({ ...open, endedAt: new Date().toISOString() })
  localStorage.setItem(SHIFTS_KEY, JSON.stringify(shifts))
  localStorage.removeItem(OPEN_KEY)
}

/** Monday 00:00 of the week containing `date`. */
function startOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  // getDay() is 0 for Sunday, which belongs to the week that started 6 days ago.
  const daysSinceMonday = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - daysSinceMonday)
  return d
}

/** Hours logged since Monday, including the shift in progress. */
export function hoursThisWeek(now = new Date()): number {
  const weekStart = startOfWeek(now).getTime()
  let ms = 0

  for (const shift of getShifts()) {
    const start = new Date(shift.startedAt).getTime()
    if (start >= weekStart) ms += new Date(shift.endedAt).getTime() - start
  }

  const open = getOpenShift()
  if (open) {
    const start = new Date(open.startedAt).getTime()
    if (start >= weekStart) ms += now.getTime() - start
  }

  return ms / 3_600_000
}

/**
 * Asks the browser for the current position, which is what triggers the OS
 * location prompt in the design. Resolves to null when the user denies it or
 * the device can't provide a fix — clocking in is never blocked on it.
 */
export function requestLocation(): Promise<GeolocationPosition | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null)
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  })
}
