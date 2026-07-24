export type JobStatus = 'in-progress' | 'completed' | 'awarded'

export interface ManagedJob {
  id: string
  name: string
  color: string
  crewName: string
  gc: string
  gcSuper: string
  idsSuper: string
  contract: number
  startDate: string
  endDate: string
  status: JobStatus
  laborBudgetUsed: number
  laborBudgetTotal: number
  crewRate: number
  workers: number
}

export const STATUS_LABELS: Record<JobStatus, string> = {
  'in-progress': 'In Progress',
  completed: 'Completed',
  awarded: 'Awarded',
}

export const STATUS_COLORS: Record<JobStatus, string> = {
  'in-progress': '#22c55e',
  completed: '#3b82f6',
  awarded: '#e0399f',
}

export const initialManagedJobs: ManagedJob[] = [
  { id: '#001', name: 'Maplewood Community Center Renovation', color: '#e0399f', crewName: "Hank's Crew", gc: 'John D.', gcSuper: 'Ethan K.', idsSuper: 'Ethan R.', contract: 50000, startDate: '12-07-2026', endDate: '13-07-2026', status: 'in-progress', laborBudgetUsed: 12000, laborBudgetTotal: 20000, crewRate: 25, workers: 4 },
  { id: '#002', name: 'Riverside Bridge Repair', color: '#22c55e', crewName: "John's Crew", gc: 'Alice M.', gcSuper: 'Maya R.', idsSuper: 'Maya K.', contract: 50000, startDate: '20-07-2026', endDate: '21-07-2026', status: 'completed', laborBudgetUsed: 18000, laborBudgetTotal: 20000, crewRate: 32, workers: 5 },
  { id: '#003', name: 'Greenfield Library Expansion', color: '#f97316', crewName: "Dan's Crew", gc: 'Emily T.', gcSuper: 'Liam J.', idsSuper: 'Liam J.', contract: 50000, startDate: '16-07-2026', endDate: '17-07-2026', status: 'awarded', laborBudgetUsed: 4000, laborBudgetTotal: 20000, crewRate: 29, workers: 3 },
  { id: '#004', name: 'Oakridge High School Gym Upgrade', color: '#8b5cf6', crewName: "Ali's Crew", gc: 'Michael B.', gcSuper: 'Olivia P.', idsSuper: 'Noah W.', contract: 50000, startDate: '14-07-2026', endDate: '15-07-2026', status: 'in-progress', laborBudgetUsed: 6000, laborBudgetTotal: 20000, crewRate: 27, workers: 4 },
  { id: '#005', name: 'Pinecrest Water Treatment Plant Maintenance', color: '#ef4444', crewName: "Mark's Crew", gc: 'Robert S.', gcSuper: 'Noah G.', idsSuper: 'Olivia P.', contract: 50000, startDate: '12-07-2026', endDate: '13-07-2026', status: 'in-progress', laborBudgetUsed: 11000, laborBudgetTotal: 20000, crewRate: 30, workers: 6 },
  { id: '#006', name: 'Lakeside Park Playground Installation', color: '#14b8a6', crewName: "Chris's Crew", gc: 'Sophia L.', gcSuper: 'Ava C.', idsSuper: 'Ava C.', contract: 50000, startDate: '18-07-2026', endDate: '19-07-2026', status: 'completed', laborBudgetUsed: 21000, laborBudgetTotal: 20000, crewRate: 28, workers: 4 },
]
