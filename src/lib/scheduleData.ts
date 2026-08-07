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
  { id: '#001', jobNo: '001', name: 'Maplewood Community Center Renovation', color: '#ea3da9', idsSuper: 'Ethan R.', gcSuper: 'Ethan K.', gc: 'John D.', contract: 50000 },
  { id: '#002', jobNo: '002', name: 'Riverside Bridge Repair', color: '#56bd6d', idsSuper: 'Maya K.', gcSuper: 'Maya R.', gc: 'Alice M.', contract: 50000 },
  { id: '#003', jobNo: '003', name: 'Greenfield Library Expansion', color: '#df3021', idsSuper: 'Liam J.', gcSuper: 'Liam J.', gc: 'Emily T.', contract: 50000 },
  { id: '#004', jobNo: '004', name: 'Oakridge High School Gym Upgrade', color: '#4193f7', idsSuper: 'Noah W.', gcSuper: 'Olivia P.', gc: 'Michael B.', contract: 50000 },
  { id: '#005', jobNo: '005', name: 'Pinecrest Water Treatment Plant Maintenance', color: '#e8752e', idsSuper: 'Olivia P.', gcSuper: 'Noah G.', gc: 'Robert S.', contract: 50000 },
  { id: '#006', jobNo: '006', name: 'Sunset Park Playground Replacement', color: '#14b8a6', idsSuper: 'Steve P.', gcSuper: 'Mark T.', gc: 'Alice S.', contract: 50000 },
]

/** Jobs shown in Schedule / Cost pickers — full sheet roster. */
export const sheetPickerJobs = scheduleJobs

/** Weekly view assignments (week of TODAY 2026-07-20 … 2026-07-26) — one crew per job, Mon–Sat. */
const WEEKLY_CREW_BY_JOB: Array<Omit<ScheduleAssignment, 'id' | 'startDate' | 'endDate'>> = [
  { jobId: '#001', crewName: "Hank's Crew", rate: 35, workers: 4, note: 'Coordinate with suppliers and schedule weekly progress meetings.' },
  { jobId: '#002', crewName: "John's Crew", rate: 32, workers: 5, note: 'Confirm crane delivery Tuesday morning.' },
  { jobId: '#003', crewName: "Bob's Crew", rate: 28, workers: 3, note: 'Dust control required near classrooms.' },
  { jobId: '#004', crewName: "Chris's Crew", rate: 27, workers: 4, note: 'Watch for permit delays on the west wing.' },
  { jobId: '#005', crewName: "Noah's Crew", rate: 30, workers: 6, note: 'Full-week interior soft demo.' },
  { jobId: '#006', crewName: "Lucas's Crew", rate: 27, workers: 5, note: 'Tear down old swing sets and prep ground.' },
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
