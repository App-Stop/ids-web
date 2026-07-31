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
  { id: 's3391', jobNo: '3391', name: 'Harbor Point Parking Garage Repair', color: '#14b8a6', idsSuper: 'Ethan R.', gcSuper: 'Jude R.', gc: 'Harbor Works', contract: 54000 },
  { id: 's5108', jobNo: '5108', name: 'Westbrook Fire Station Remodel', color: '#0ea5e9', idsSuper: 'Maya K.', gcSuper: 'Leo S.', gc: 'Reyes Builders', contract: 95000 },
  { id: 's6620', jobNo: '6620', name: 'Copper Hill Waste Transfer Station', color: '#a855f7', idsSuper: 'Noah W.', gcSuper: 'Iris T.', gc: 'Sterling Group', contract: 141000 },
]

/** Jobs shown in Schedule / Cost pickers — full sheet roster. */
export const sheetPickerJobs = scheduleJobs

/** Weekly view assignments (week of TODAY 2026-07-20 … 2026-07-26) — one crew per job, Mon–Sat. */
const WEEKLY_CREW_BY_JOB: Array<Omit<ScheduleAssignment, 'id' | 'startDate' | 'endDate'>> = [
  { jobId: 's4827', crewName: "Hank's Crew", rate: 25, workers: 4, note: 'Coordinate with suppliers and schedule weekly progress meetings.' },
  { jobId: 's5914', crewName: "John's Crew", rate: 32, workers: 5, note: 'Confirm crane delivery Tuesday morning.' },
  { jobId: 's4706', crewName: "Dan's Crew", rate: 29, workers: 3, note: 'Dust control required near classrooms.' },
  { jobId: 's3460', crewName: "Bob's Crew", rate: 28, workers: 3, note: 'Watch for permit delays on the west wing.' },
  { jobId: 's2049', crewName: "Noah's Crew", rate: 30, workers: 6, note: 'Full-week interior soft demo.' },
  { jobId: 's8602', crewName: "Lucas's Crew", rate: 27, workers: 4, note: 'Second shift covers cleanup.' },
  { jobId: 's7214', crewName: "Liam's Crew", rate: 33, workers: 5, note: 'Confirm dumpster pickup Friday.' },
  { jobId: 's3391', crewName: "Aiden's Crew", rate: 30, workers: 5 },
  { jobId: 's5108', crewName: "Mason's Crew", rate: 29, workers: 4, note: 'Coordinate fire-watch overnight.' },
  { jobId: 's6620', crewName: "Luca's Crew", rate: 26, workers: 3 },
]

export const weeklyScheduleAssignments: ScheduleAssignment[] = WEEKLY_CREW_BY_JOB.map((crew, index) => ({
  ...crew,
  id: `wa${index + 1}`,
  startDate: '2026-07-20',
  endDate: '2026-07-25',
}))

/**
 * Monthly Gantt — one crew per job.
 * Each week is Mon–Sat; Sundays (Jul 5, 12, 19, 26, Aug 2) stay empty.
 * July 2026 starts on Wednesday, so the first block is Wed–Sat (1–4).
 */
const MONTHLY_MON_SAT_RANGES: Array<{ startDate: string; endDate: string }> = [
  { startDate: '2026-07-01', endDate: '2026-07-04' }, // Wed–Sat
  { startDate: '2026-07-06', endDate: '2026-07-11' }, // Mon–Sat
  { startDate: '2026-07-13', endDate: '2026-07-18' }, // Mon–Sat
  { startDate: '2026-07-20', endDate: '2026-07-25' }, // Mon–Sat
  { startDate: '2026-07-27', endDate: '2026-08-01' }, // Mon–Sat (into next-month overflow cols)
]

export const monthlyScheduleAssignments: ScheduleAssignment[] = WEEKLY_CREW_BY_JOB.flatMap((crew, jobIndex) =>
  MONTHLY_MON_SAT_RANGES.map((range, weekIndex) => ({
    ...crew,
    id: `ma${jobIndex + 1}w${weekIndex + 1}`,
    startDate: range.startDate,
    endDate: range.endDate,
  })),
)

/** @deprecated use weeklyScheduleAssignments / monthlyScheduleAssignments */
export const initialScheduleAssignments = weeklyScheduleAssignments

export const initialScheduleNotes: ScheduleNote[] = [
  { id: 'sn1', jobId: 's4706', date: '2026-07-22', text: 'The crew performed efficiently throughout the day. To maximize productivity tomorrow, we should coordinate material delivery earlier.' },
  { id: 'sn2', jobId: 's6829', date: '2026-07-23', text: 'Job is done for this year, next phase begins in spring.' },
  { id: 'sn3', jobId: 's8732', date: '2026-07-20', text: 'The crew performed well despite the weather delays.' },
]

export const TODAY = '2026-07-22'

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
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
  return WEEKDAY_SHORT[d.getDay()]
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
