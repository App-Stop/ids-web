export interface ScheduleJob {
  id: string
  jobNo: string
  name: string
  color: string
  idsSuper: string
  gcSuper: string
  gc: string
  contract: number
}

export interface ScheduleAssignment {
  id: string
  jobId: string
  startDate: string   // was: date
  endDate: string      // new
  crewName: string
  rate: number
  workers: number
  note?: string
}

export interface ScheduleNote {
  id: string
  jobId: string
  date: string
  text: string
}

export const scheduleJobs: ScheduleJob[] = [
  { id: 's4827', jobNo: '4827', name: 'Johnson State Prison Kitchen', color: '#ea3da9', idsSuper: 'John D.', gcSuper: 'Hank Williams', gc: 'Turner Const.', contract: 50000 },
  { id: 's5914', jobNo: '5914', name: 'Smith County Courthouse Renovation', color: '#56bd6d', idsSuper: 'Alice S.', gcSuper: 'David Richards', gc: 'Skanska', contract: 90000 },
  { id: 's4706', jobNo: '4706', name: 'Riverside Community Center Demo', color: '#E2B900', idsSuper: 'Michael T.', gcSuper: 'John Smith', gc: 'Laura H.', contract: 80000 },
  { id: 's3460', jobNo: '3460', name: 'Cedar Valley Library Expansion', color: '#df3021', idsSuper: 'David L.', gcSuper: 'Michael Johnson', gc: 'Sarah D.', contract: 70000 },
  { id: 's2049', jobNo: '2049', name: 'Smith County Courthouse Renovation', color: '#e8752e', idsSuper: 'Sophia K.', gcSuper: 'Sarah Wilson', gc: 'Kevin M.', contract: 60000 },
  { id: 's8602', jobNo: '8602', name: 'Johnson State Prison Kitchen', color: '#4193f7', idsSuper: 'Olivia B.', gcSuper: 'Linda Martinez', gc: 'James L.', contract: 65000 },
  { id: 's7214', jobNo: '7214', name: 'Cedar Valley Library Expansion', color: '#8640f6', idsSuper: 'Isabella N.', gcSuper: 'Patricia Taylor', gc: 'Daniel W.', contract: 95000 },
]

/** Weekly view assignments (week of TODAY 2026-07-20 … 2026-07-26). */
export const weeklyScheduleAssignments: ScheduleAssignment[] = [
  { id: 'wa1', jobId: 's4827', startDate: '2026-07-20', endDate: '2026-07-20', crewName: "Hank's Crew", rate: 25, workers: 4, note: 'Coordinate with suppliers and schedule weekly progress meetings.' },
  { id: 'wa2', jobId: 's5914', startDate: '2026-07-21', endDate: '2026-07-21', crewName: "John's Crew", rate: 32, workers: 5 },
  { id: 'wa3', jobId: 's3460', startDate: '2026-07-20', endDate: '2026-07-20', crewName: "Bob's Crew", rate: 28, workers: 3, note: 'Watch for permit delays on the west wing.' },
  { id: 'wa4', jobId: 's2049', startDate: '2026-07-22', endDate: '2026-07-22', crewName: "Noah's Crew", rate: 30, workers: 6 },
  { id: 'wa5', jobId: 's8602', startDate: '2026-07-21', endDate: '2026-07-21', crewName: "Lucas's Crew", rate: 27, workers: 4, note: 'Second shift covers cleanup.' },
  { id: 'wa6', jobId: 's7214', startDate: '2026-07-23', endDate: '2026-07-23', crewName: "Liam's Crew", rate: 33, workers: 5, note: 'Confirm dumpster pickup Friday.' },
]

/** Monthly Gantt ranges matching the Schedule Board Figma (July 2026). */
export const monthlyScheduleAssignments: ScheduleAssignment[] = [
  { id: 'ma1', jobId: 's4827', startDate: '2026-07-01', endDate: '2026-07-02', crewName: "Hank's Crew", rate: 25, workers: 4, note: 'Coordinate with suppliers and schedule weekly progress meetings.' },
  { id: 'ma2', jobId: 's5914', startDate: '2026-07-03', endDate: '2026-07-05', crewName: "John's Crew", rate: 32, workers: 5 },
  { id: 'ma7', jobId: 's4706', startDate: '2026-07-08', endDate: '2026-07-12', crewName: "Dan's Crew", rate: 29, workers: 3 },
  { id: 'ma3', jobId: 's3460', startDate: '2026-07-01', endDate: '2026-07-04', crewName: "Bob's Crew", rate: 28, workers: 3, note: 'Watch for permit delays on the west wing.' },
  { id: 'ma3b', jobId: 's3460', startDate: '2026-07-21', endDate: '2026-07-21', crewName: "Bob's Crew", rate: 28, workers: 3 },
  { id: 'ma4', jobId: 's2049', startDate: '2026-07-10', endDate: '2026-07-18', crewName: "Noah's Crew", rate: 30, workers: 6 },
  { id: 'ma5', jobId: 's8602', startDate: '2026-07-06', endDate: '2026-07-09', crewName: "Lucas's Crew", rate: 27, workers: 4, note: 'Second shift covers cleanup.' },
  { id: 'ma6', jobId: 's7214', startDate: '2026-07-13', endDate: '2026-07-17', crewName: "Liam's Crew", rate: 33, workers: 5, note: 'Confirm dumpster pickup Friday.' },
]

/** @deprecated use weeklyScheduleAssignments / monthlyScheduleAssignments */
export const initialScheduleAssignments = weeklyScheduleAssignments

export const initialScheduleNotes: ScheduleNote[] = [
  { id: 'sn1', jobId: 's4706', date: '2026-07-22', text: 'The crew performed efficiently throughout the day. To maximize productivity tomorrow, we should coordinate material delivery earlier.' },
  { id: 'sn2', jobId: 's6829', date: '2026-07-23', text: 'Job is done for this year, next phase begins in spring.' },
  { id: 'sn3', jobId: 's8732', date: '2026-07-20', text: 'The crew performed well despite the weather delays.' },
]

export const TODAY = '2026-07-22'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function fromISO(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
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

export function weekdayShort(d: Date) {
  return WEEKDAY_LABELS[d.getDay()]
}

export function shortDate(d: Date) {
  return `${d.getMonth() + 1}-${d.getDate()}-${String(d.getFullYear()).slice(2)}`
}

export function monthLabel(d: Date) {
  return `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`
}

export function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

/** Full month days plus the first 2 days of the next month (Figma monthly grid). */
export function monthGridDays(d: Date) {
  const count = daysInMonth(d)
  const days: Date[] = []
  for (let i = 1; i <= count; i++) days.push(new Date(d.getFullYear(), d.getMonth(), i))
  days.push(new Date(d.getFullYear(), d.getMonth() + 1, 1))
  days.push(new Date(d.getFullYear(), d.getMonth() + 1, 2))
  return days
}

export function formatMdy(iso: string) {
  const d = fromISO(iso)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`
}
