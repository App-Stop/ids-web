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

/** Weekly view assignments (week of TODAY 2026-07-20 … 2026-07-26). */
export const weeklyScheduleAssignments: ScheduleAssignment[] = [
  { id: 'wa1', jobId: 's4827', startDate: '2026-07-20', endDate: '2026-07-22', crewName: "Hank's Crew", rate: 25, workers: 4, note: 'Coordinate with suppliers and schedule weekly progress meetings.' },
  { id: 'wa1b', jobId: 's4827', startDate: '2026-07-24', endDate: '2026-07-26', crewName: "Chris's Crew", rate: 28, workers: 3 },
  { id: 'wa2', jobId: 's5914', startDate: '2026-07-20', endDate: '2026-07-24', crewName: "John's Crew", rate: 32, workers: 5, note: 'Confirm crane delivery Tuesday morning.' },
  { id: 'wa3', jobId: 's4706', startDate: '2026-07-21', endDate: '2026-07-23', crewName: "Dan's Crew", rate: 29, workers: 3, note: 'Dust control required near classrooms.' },
  { id: 'wa3b', jobId: 's4706', startDate: '2026-07-25', endDate: '2026-07-26', crewName: "Eli's Crew", rate: 33, workers: 4 },
  { id: 'wa4', jobId: 's3460', startDate: '2026-07-20', endDate: '2026-07-23', crewName: "Bob's Crew", rate: 28, workers: 3, note: 'Watch for permit delays on the west wing.' },
  { id: 'wa5', jobId: 's2049', startDate: '2026-07-20', endDate: '2026-07-26', crewName: "Noah's Crew", rate: 30, workers: 6, note: 'Full-week interior soft demo.' },
  { id: 'wa6', jobId: 's8602', startDate: '2026-07-21', endDate: '2026-07-25', crewName: "Lucas's Crew", rate: 27, workers: 4, note: 'Second shift covers cleanup.' },
  { id: 'wa7', jobId: 's7214', startDate: '2026-07-20', endDate: '2026-07-22', crewName: "Liam's Crew", rate: 33, workers: 5, note: 'Confirm dumpster pickup Friday.' },
  { id: 'wa7b', jobId: 's7214', startDate: '2026-07-23', endDate: '2026-07-26', crewName: "Owen's Crew", rate: 34, workers: 4 },
  { id: 'wa8', jobId: 's3391', startDate: '2026-07-20', endDate: '2026-07-24', crewName: "Aiden's Crew", rate: 30, workers: 5 },
  { id: 'wa9', jobId: 's5108', startDate: '2026-07-22', endDate: '2026-07-26', crewName: "Mason's Crew", rate: 29, workers: 4, note: 'Coordinate fire-watch overnight.' },
  { id: 'wa10', jobId: 's6620', startDate: '2026-07-20', endDate: '2026-07-23', crewName: "Luca's Crew", rate: 26, workers: 3 },
  { id: 'wa10b', jobId: 's6620', startDate: '2026-07-24', endDate: '2026-07-26', crewName: "Hank's Crew", rate: 25, workers: 4 },
]

/** Monthly Gantt ranges for July 2026 — dense coverage across the sheet. */
export const monthlyScheduleAssignments: ScheduleAssignment[] = [
  { id: 'ma1', jobId: 's4827', startDate: '2026-07-01', endDate: '2026-07-07', crewName: "Hank's Crew", rate: 25, workers: 4, note: 'Coordinate with suppliers and schedule weekly progress meetings.' },
  { id: 'ma1b', jobId: 's4827', startDate: '2026-07-14', endDate: '2026-07-22', crewName: "Chris's Crew", rate: 28, workers: 3 },
  { id: 'ma1c', jobId: 's4827', startDate: '2026-07-27', endDate: '2026-07-31', crewName: "Hank's Crew", rate: 25, workers: 4 },
  { id: 'ma2', jobId: 's5914', startDate: '2026-07-02', endDate: '2026-07-11', crewName: "John's Crew", rate: 32, workers: 5, note: 'Confirm crane delivery Tuesday morning.' },
  { id: 'ma2b', jobId: 's5914', startDate: '2026-07-16', endDate: '2026-07-28', crewName: "John's Crew", rate: 32, workers: 5 },
  { id: 'ma7', jobId: 's4706', startDate: '2026-07-03', endDate: '2026-07-12', crewName: "Dan's Crew", rate: 29, workers: 3, note: 'Dust control required near classrooms.' },
  { id: 'ma7b', jobId: 's4706', startDate: '2026-07-18', endDate: '2026-07-26', crewName: "Eli's Crew", rate: 33, workers: 4 },
  { id: 'ma3', jobId: 's3460', startDate: '2026-07-01', endDate: '2026-07-09', crewName: "Bob's Crew", rate: 28, workers: 3, note: 'Watch for permit delays on the west wing.' },
  { id: 'ma3b', jobId: 's3460', startDate: '2026-07-15', endDate: '2026-07-24', crewName: "Bob's Crew", rate: 28, workers: 3 },
  { id: 'ma3c', jobId: 's3460', startDate: '2026-07-28', endDate: '2026-08-02', crewName: "Owen's Crew", rate: 34, workers: 4 },
  { id: 'ma4', jobId: 's2049', startDate: '2026-07-04', endDate: '2026-07-18', crewName: "Noah's Crew", rate: 30, workers: 6, note: 'Full-week interior soft demo.' },
  { id: 'ma4b', jobId: 's2049', startDate: '2026-07-22', endDate: '2026-07-31', crewName: "Noah's Crew", rate: 30, workers: 6 },
  { id: 'ma5', jobId: 's8602', startDate: '2026-07-06', endDate: '2026-07-15', crewName: "Lucas's Crew", rate: 27, workers: 4, note: 'Second shift covers cleanup.' },
  { id: 'ma5b', jobId: 's8602', startDate: '2026-07-20', endDate: '2026-07-30', crewName: "Lucas's Crew", rate: 27, workers: 4 },
  { id: 'ma6', jobId: 's7214', startDate: '2026-07-01', endDate: '2026-07-08', crewName: "Liam's Crew", rate: 33, workers: 5, note: 'Confirm dumpster pickup Friday.' },
  { id: 'ma6b', jobId: 's7214', startDate: '2026-07-12', endDate: '2026-07-21', crewName: "Owen's Crew", rate: 34, workers: 4 },
  { id: 'ma6c', jobId: 's7214', startDate: '2026-07-25', endDate: '2026-08-02', crewName: "Liam's Crew", rate: 33, workers: 5 },
  { id: 'ma8', jobId: 's3391', startDate: '2026-07-05', endDate: '2026-07-14', crewName: "Aiden's Crew", rate: 30, workers: 5 },
  { id: 'ma8b', jobId: 's3391', startDate: '2026-07-19', endDate: '2026-07-29', crewName: "Aiden's Crew", rate: 30, workers: 5 },
  { id: 'ma9', jobId: 's5108', startDate: '2026-07-08', endDate: '2026-07-17', crewName: "Mason's Crew", rate: 29, workers: 4, note: 'Coordinate fire-watch overnight.' },
  { id: 'ma9b', jobId: 's5108', startDate: '2026-07-21', endDate: '2026-07-31', crewName: "Mason's Crew", rate: 29, workers: 4 },
  { id: 'ma10', jobId: 's6620', startDate: '2026-07-02', endDate: '2026-07-10', crewName: "Luca's Crew", rate: 26, workers: 3 },
  { id: 'ma10b', jobId: 's6620', startDate: '2026-07-13', endDate: '2026-07-23', crewName: "Hank's Crew", rate: 25, workers: 4 },
  { id: 'ma10c', jobId: 's6620', startDate: '2026-07-26', endDate: '2026-08-02', crewName: "Luca's Crew", rate: 26, workers: 3 },
]

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
