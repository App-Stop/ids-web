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
  date: string
  crewName: string
  hours: string
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
  { id: 's4827', jobNo: '4827', name: 'Johnson State Prison Kitchen', color: '#e0399f', idsSuper: 'John D.', gcSuper: 'Hank Williams', gc: 'Turner Const.', contract: 50000 },
  { id: 's5914', jobNo: '5914', name: 'Smith County Courthouse Renovation', color: '#22c55e', idsSuper: 'Alice S.', gcSuper: 'David Richards', gc: 'Skanska', contract: 90000 },
  { id: 's4706', jobNo: '4706', name: 'Riverdale Community Center Upgrade', color: '#14b8a6', idsSuper: 'Michael T.', gcSuper: 'John Smith', gc: 'Skanska', contract: 85000 },
  { id: 's9275', jobNo: '9275', name: 'Maple Ridge Bridge Repair', color: '#8b5cf6', idsSuper: 'Sarah P.', gcSuper: 'Jane Doe', gc: 'Turner Const.', contract: 75000 },
  { id: 's3460', jobNo: '3460', name: 'Cedar Valley Library Expansion', color: '#ef4444', idsSuper: 'David L.', gcSuper: 'Michael Johnson', gc: 'Sarah D.', contract: 70000 },
  { id: 's6829', jobNo: '6829', name: 'Pinecrest High School Gymnasium', color: '#f97316', idsSuper: 'Emily W.', gcSuper: 'Emily Davis', gc: 'David T.', contract: 110000 },
  { id: 's8732', jobNo: '8732', name: 'Maplewood Community Center', color: '#3b82f6', idsSuper: 'James R.', gcSuper: 'Chris Brown', gc: 'Laura H.', contract: 100000 },
  { id: 's2049', jobNo: '2049', name: 'Smith County Courthouse Renovation', color: '#f97316', idsSuper: 'Sophia K.', gcSuper: 'Sarah Wilson', gc: 'Kevin M.', contract: 60000 },
  { id: 's1583', jobNo: '1583', name: 'Riverdale Community Center Upgrade', color: '#8b5cf6', idsSuper: 'Daniel M.', gcSuper: 'David Garcia', gc: 'Emily R.', contract: 130000 },
  { id: 's8602', jobNo: '8602', name: 'Johnson State Prison Kitchen', color: '#3b82f6', idsSuper: 'Olivia B.', gcSuper: 'Linda Martinez', gc: 'James L.', contract: 65000 },
  { id: 's3947', jobNo: '3947', name: 'Maple Ridge Bridge Repair', color: '#22c55e', idsSuper: 'Matthew J.', gcSuper: 'James Anderson', gc: 'Sophia G.', contract: 120000 },
  { id: 's7214', jobNo: '7214', name: 'Cedar Valley Library Expansion', color: '#8b5cf6', idsSuper: 'Isabella N.', gcSuper: 'Patricia Taylor', gc: 'Daniel W.', contract: 95000 },
  { id: 's6158', jobNo: '6158', name: 'Pinecrest High School Gymnasium', color: '#14b8a6', idsSuper: 'William H.', gcSuper: 'Robert Thomas', gc: 'Olivia P.', contract: 55000 },
  { id: 's7391', jobNo: '7391', name: 'Maplewood Community Center', color: '#ef4444', idsSuper: 'Sarah L.', gcSuper: 'Jessica White', gc: 'Brian S.', contract: 80000 },
]

export const initialScheduleAssignments: ScheduleAssignment[] = [
  { id: 'sa1', jobId: 's4827', date: '2026-07-20', crewName: "Hank's Crew", hours: '16h 30m', rate: 25, workers: 4, note: 'Coordinate with suppliers and schedule weekly progress meetings.' },
  { id: 'sa2', jobId: 's5914', date: '2026-07-21', crewName: "John's Crew", hours: '29h 09m', rate: 32, workers: 5 },
  { id: 'sa3', jobId: 's3460', date: '2026-07-20', crewName: "Bob's Crew", hours: '18h 30m', rate: 28, workers: 3, note: 'Watch for permit delays on the west wing.' },
  { id: 'sa4', jobId: 's2049', date: '2026-07-22', crewName: "Noah's Crew", hours: '28h 12m', rate: 30, workers: 6 },
  { id: 'sa5', jobId: 's8602', date: '2026-07-21', crewName: "Lucas's Crew", hours: '18h 30m', rate: 27, workers: 4, note: 'Second shift covers cleanup.' },
  { id: 'sa6', jobId: 's7214', date: '2026-07-23', crewName: "Liam's Crew", hours: '18h 30m', rate: 33, workers: 5, note: 'Confirm dumpster pickup Friday.' },
]

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

export function formatMdy(iso: string) {
  const d = fromISO(iso)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`
}
