/**
 * Date helpers for the schedule board.
 *
 * Two date representations are in play:
 *  - "ISO day" strings ("2026-08-25") — what the grid keys and compares on.
 *  - `Date` objects built from those strings at LOCAL midnight, used only for
 *    calendar arithmetic and display. They never leave this module as dates.
 *
 * The API sends UTC instants ("2026-08-25T00:00:00.000Z" for a start,
 * "...T23:59:59.999Z" for an end). `isoDay` takes the UTC date part of those,
 * which is correct for both boundaries — never build a Date from them and read
 * local getters, or non-UTC timezones shift the day.
 */

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** Days covered by each view, matching the backend's schedule ranges. */
export const VIEW_SPAN_DAYS = { weekly: 7, monthly: 30 } as const

export type ViewMode = keyof typeof VIEW_SPAN_DAYS

/** Local-midnight Date → "YYYY-MM-DD". */
export function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "YYYY-MM-DD" → Date at local midnight. */
export function fromISO(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** API instant ("2026-08-25T00:00:00.000Z") → "2026-08-25". */
export function isoDay(value: string | Date | null | undefined): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return value.slice(0, 10)
}

export function todayISO() {
  return toISO(new Date())
}

export function addDays(d: Date, n: number) {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + n)
  return copy
}

export function getMonday(d: Date) {
  const copy = new Date(d)
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + diff)
  return copy
}

/**
 * The exact days a view renders: `span` consecutive days from the anchor.
 * Mirrors the backend (weekly = anchor + 6, monthly = anchor + 29), so the
 * grid shows precisely the range the API was asked for.
 */
export function rangeDays(anchor: Date, view: ViewMode) {
  const span = VIEW_SPAN_DAYS[view]
  return Array.from({ length: span }, (_, i) => addDays(anchor, i))
}

export function weekdayShort(d: Date) {
  return WEEKDAY_SHORT[d.getDay()]
}

export function shortDate(d: Date) {
  return `${d.getMonth() + 1}-${d.getDate()}-${String(d.getFullYear()).slice(2)}`
}

export function monthLabel(d: Date) {
  return `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`
}

/** Label for a rolling range, e.g. "Aug 12 - Sep 10, 2026". */
export function rangeLabel(days: Date[]) {
  if (days.length === 0) return ''
  const first = days[0]
  const last = days[days.length - 1]
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(first)} - ${fmt(last)}, ${last.getFullYear()}`
}

/** "2026-08-25" → "08-25-2026" (display only). */
export function formatMdy(iso: string) {
  const d = fromISO(iso)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`
}

/** Fallback palette for crews whose `crewColor` is unset. */
const FALLBACK_COLORS = ['#ea3da9', '#56bd6d', '#df3021', '#4193f7', '#e8752e', '#14b8a6', '#8b5cf6']

export function crewColorFor(crewId: string | null | undefined, explicit?: string | null) {
  if (explicit) return explicit
  if (!crewId) return FALLBACK_COLORS[0]
  let hash = 0
  for (let i = 0; i < crewId.length; i++) hash = (hash * 31 + crewId.charCodeAt(i)) >>> 0
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length]
}
