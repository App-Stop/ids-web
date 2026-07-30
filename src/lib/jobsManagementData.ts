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
  completed: '#60a5fa',
  awarded: '#e0399f',
}

export const initialManagedJobs: ManagedJob[] = [
  { id: '#001', name: 'Maplewood Community Center Renovation', color: '#ea3da9', crewName: "Hank's Crew", gc: 'John D.', gcSuper: 'Ethan K.', idsSuper: 'Ethan R.', contract: 50000, startDate: '12-07-2026', endDate: '13-07-2026', status: 'in-progress', laborBudgetUsed: 10421, laborBudgetTotal: 12000, crewRate: 25, workers: 4 },
  { id: '#002', name: 'Riverside Bridge Repair', color: '#56bd6d', crewName: "John's Crew", gc: 'Alice M.', gcSuper: 'Maya R.', idsSuper: 'Maya K.', contract: 50000, startDate: '20-07-2026', endDate: '21-07-2026', status: 'completed', laborBudgetUsed: 10421, laborBudgetTotal: 12000, crewRate: 32, workers: 5 },
  { id: '#003', name: 'Greenfield Library Expansion', color: '#df3021', crewName: "Dan's Crew", gc: 'Emily T.', gcSuper: 'Liam J.', idsSuper: 'Liam J.', contract: 50000, startDate: '16-07-2026', endDate: '17-07-2026', status: 'awarded', laborBudgetUsed: 10421, laborBudgetTotal: 12000, crewRate: 29, workers: 3 },
  { id: '#004', name: 'Oakridge High School Gym Upgrade', color: '#14b8a6', crewName: "Ali's Crew", gc: 'Michael B.', gcSuper: 'Olivia P.', idsSuper: 'Noah W.', contract: 50000, startDate: '14-07-2026', endDate: '15-07-2026', status: 'in-progress', laborBudgetUsed: 10421, laborBudgetTotal: 12000, crewRate: 27, workers: 4 },
  { id: '#005', name: 'Pinecrest Water Treatment Plant Maintenance', color: '#e8752e', crewName: "Mark's Crew", gc: 'Robert S.', gcSuper: 'Noah G.', idsSuper: 'Olivia P.', contract: 50000, startDate: '12-07-2026', endDate: '13-07-2026', status: 'in-progress', laborBudgetUsed: 10421, laborBudgetTotal: 12000, crewRate: 30, workers: 6 },
  { id: '#006', name: 'Lakeside Park Playground Installation', color: '#4193f7', crewName: "Chris's Crew", gc: 'Sophia L.', gcSuper: 'Ava C.', idsSuper: 'Ava C.', contract: 50000, startDate: '18-07-2026', endDate: '19-07-2026', status: 'completed', laborBudgetUsed: 14421, laborBudgetTotal: 12000, crewRate: 28, workers: 4 },
  { id: '#007', name: 'Evergreen Medical Center Renovation', color: '#06b6d4', crewName: "Noah's Crew", gc: 'Grace H.', gcSuper: 'Mila P.', idsSuper: 'Mila P.', contract: 65000, startDate: '22-07-2026', endDate: '23-07-2026', status: 'awarded', laborBudgetUsed: 9000, laborBudgetTotal: 26000, crewRate: 31, workers: 5 },
  { id: '#008', name: 'Northside Community Pool Upgrade', color: '#f59e0b', crewName: "Eli's Crew", gc: 'Harper J.', gcSuper: 'Leo S.', idsSuper: 'Leo S.', contract: 72000, startDate: '24-07-2026', endDate: '25-07-2026', status: 'in-progress', laborBudgetUsed: 14500, laborBudgetTotal: 28000, crewRate: 33, workers: 6 },
  { id: '#009', name: 'Cedar Grove Office Building Demo', color: '#8640f6', crewName: "Owen's Crew", gc: 'Nora A.', gcSuper: 'Kai M.', idsSuper: 'Kai M.', contract: 83000, startDate: '26-07-2026', endDate: '27-07-2026', status: 'completed', laborBudgetUsed: 17000, laborBudgetTotal: 30000, crewRate: 34, workers: 5 },
  { id: '#010', name: 'Valley View Elementary Rebuild', color: '#56bd6d', crewName: "Mason's Crew", gc: 'Zoe C.', gcSuper: 'Iris T.', idsSuper: 'Iris T.', contract: 91000, startDate: '28-07-2026', endDate: '29-07-2026', status: 'awarded', laborBudgetUsed: 12000, laborBudgetTotal: 32000, crewRate: 29, workers: 4 },
  { id: '#011', name: 'Harbor Point Parking Garage Repair', color: '#df3021', crewName: "Luca's Crew", gc: 'Emma D.', gcSuper: 'Jude R.', idsSuper: 'Jude R.', contract: 54000, startDate: '30-07-2026', endDate: '31-07-2026', status: 'in-progress', laborBudgetUsed: 8400, laborBudgetTotal: 21000, crewRate: 26, workers: 3 },
  { id: '#012', name: 'Sunset Ridge Apartment Upgrade', color: '#14b8a6', crewName: "Aiden's Crew", gc: 'Maya N.', gcSuper: 'Evan B.', idsSuper: 'Evan B.', contract: 76000, startDate: '01-08-2026', endDate: '02-08-2026', status: 'completed', laborBudgetUsed: 13600, laborBudgetTotal: 29000, crewRate: 30, workers: 5 },
  { id: '#013', name: 'Brookside Transit Hub Expansion', color: '#ea3da9', crewName: "Hank's Crew", gc: 'Turner Const.', gcSuper: 'Ethan K.', idsSuper: 'Ethan R.', contract: 88000, startDate: '03-08-2026', endDate: '10-08-2026', status: 'in-progress', laborBudgetUsed: 15000, laborBudgetTotal: 30000, crewRate: 25, workers: 5 },
  { id: '#014', name: 'Westbrook Fire Station Remodel', color: '#4193f7', crewName: "Lucas's Crew", gc: 'Skanska', gcSuper: 'David Richards', idsSuper: 'Alice S.', contract: 95000, startDate: '05-08-2026', endDate: '20-08-2026', status: 'awarded', laborBudgetUsed: 5000, laborBudgetTotal: 28000, crewRate: 27, workers: 4 },
  { id: '#015', name: 'Ironwood Courthouse Annex Demo', color: '#e0399f', crewName: "John's Crew", gc: 'Reyes Builders', gcSuper: 'Hank Williams', idsSuper: 'John D.', contract: 112000, startDate: '06-08-2026', endDate: '22-08-2026', status: 'in-progress', laborBudgetUsed: 18600, laborBudgetTotal: 36000, crewRate: 32, workers: 6 },
  { id: '#016', name: 'Silver Creek Retail Plaza Buildout', color: '#22c55e', crewName: "Bob's Crew", gc: 'Vance Contracting', gcSuper: 'Priya S.', idsSuper: 'Maya K.', contract: 64000, startDate: '08-08-2026', endDate: '18-08-2026', status: 'awarded', laborBudgetUsed: 7200, laborBudgetTotal: 22000, crewRate: 28, workers: 4 },
  { id: '#017', name: 'Redwood Industrial Warehouse Clear', color: '#ef4444', crewName: "Chris's Crew", gc: 'Sterling Group', gcSuper: 'Liam J.', idsSuper: 'Noah W.', contract: 128000, startDate: '09-08-2026', endDate: '30-08-2026', status: 'in-progress', laborBudgetUsed: 24100, laborBudgetTotal: 42000, crewRate: 29, workers: 7 },
  { id: '#018', name: 'Bayfront Marina Deck Replacement', color: '#0ea5e9', crewName: "Liam's Crew", gc: 'Harbor Works', gcSuper: 'Ava C.', idsSuper: 'Olivia B.', contract: 87000, startDate: '11-08-2026', endDate: '25-08-2026', status: 'completed', laborBudgetUsed: 19800, laborBudgetTotal: 31000, crewRate: 33, workers: 5 },
  { id: '#019', name: 'Highland Middle School Wing Demo', color: '#a855f7', crewName: "Noah's Crew", gc: 'Turner Const.', gcSuper: 'David Richards', idsSuper: 'Isabella N.', contract: 99000, startDate: '12-08-2026', endDate: '28-08-2026', status: 'in-progress', laborBudgetUsed: 11200, laborBudgetTotal: 34000, crewRate: 30, workers: 5 },
  { id: '#020', name: 'Copper Hill Waste Transfer Station', color: '#f97316', crewName: "Eli's Crew", gc: 'Skanska', gcSuper: 'Sarah Wilson', idsSuper: 'Sophia K.', contract: 141000, startDate: '14-08-2026', endDate: '05-09-2026', status: 'awarded', laborBudgetUsed: 8600, laborBudgetTotal: 45000, crewRate: 34, workers: 6 },
]
