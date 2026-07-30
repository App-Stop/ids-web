export interface Job {
  id: string
  name: string
  color: string
  bidNo: string
  jobNo: string
  gc: string
  estimator: string
  startDate: string
  endDate: string
  contractAmount: number
  laborBudgetUsed: number
  laborBudgetTotal: number
}

export interface CrewLead {
  id: string
  name: string
  rate: number
  color?: string
}

export interface UnassignedCrew {
  id: string
  name: string
  leadName: string
  rate: number
}

export interface ActivityItem {
  id: string
  kind: 'labor' | 'assigned' | 'completed' | 'overdue'
  title: string
  email: string
  date: string
}

export const jobs: Job[] = [
  { id: 'j1', name: 'Jordan Park Renovation', color: '#e0399f', bidNo: '1038', jobNo: '004', gc: 'Reyes Builders', estimator: 'Mara L.', startDate: '02-07-2026', endDate: '20-08-2026', contractAmount: 98000, laborBudgetUsed: 4210, laborBudgetTotal: 28000 },
  { id: 'j2', name: 'Johnson State Prison Kitchen', color: '#22c55e', bidNo: '1042', jobNo: '001', gc: 'Turner Const.', estimator: 'John D.', startDate: '12-07-2026', endDate: '13-07-2026', contractAmount: 150000, laborBudgetUsed: 10421, laborBudgetTotal: 45000 },
  { id: 'j3', name: 'Riverbend School Renovation', color: '#14b8a6', bidNo: '1044', jobNo: '002', gc: 'Vance Contracting', estimator: 'Priya S.', startDate: '18-07-2026', endDate: '30-09-2026', contractAmount: 210000, laborBudgetUsed: 6300, laborBudgetTotal: 52000 },
  { id: 'j4', name: 'Downtown Highrise Demolition', color: '#ef4444', bidNo: '1046', jobNo: '003', gc: 'Sterling Group', estimator: 'John D.', startDate: '01-08-2026', endDate: '15-11-2026', contractAmount: 480000, laborBudgetUsed: 21000, laborBudgetTotal: 110000 },
  { id: 'j5', name: 'Greenfield Park Expansion', color: '#f97316', bidNo: '1048', jobNo: '005', gc: 'Reyes Builders', estimator: 'Mara L.', startDate: '05-08-2026', endDate: '25-09-2026', contractAmount: 76000, laborBudgetUsed: 1800, laborBudgetTotal: 19000 },
  { id: 'j6', name: 'Lakeside Community Center Build', color: '#3b82f6', bidNo: '1051', jobNo: '006', gc: 'Vance Contracting', estimator: 'Priya S.', startDate: '10-08-2026', endDate: '20-12-2026', contractAmount: 320000, laborBudgetUsed: 5200, laborBudgetTotal: 80000 },
  { id: 'j7', name: 'Old Mill Warehouse Tear Down', color: '#8b5cf6', bidNo: '1053', jobNo: '007', gc: 'Sterling Group', estimator: 'John D.', startDate: '15-08-2026', endDate: '30-08-2026', contractAmount: 54000, laborBudgetUsed: 900, laborBudgetTotal: 12000 },
]

export const crewLeads: CrewLead[] = [
  { id: 'c1', name: 'Jameson Reed', rate: 35 },
  { id: 'c2', name: 'Lena Ortiz', rate: 42 },
  { id: 'c3', name: 'Milo Grant', rate: 38 },
  { id: 'c4', name: 'Nina Patel', rate: 40 },
  { id: 'c5', name: 'Eli Turner', rate: 37 },
]

/** Crews shown in Assign Crew dropdowns (avatar + name + color). */
export const assignableCrews: { id: string; name: string; leadName: string; rate: number; color: string }[] = [
  { id: 'hank', name: "Hank's Crew", leadName: 'Hank Williams', rate: 25, color: '#ea3da9' },
  { id: 'john', name: "John's Crew", leadName: 'John D.', rate: 32, color: '#56bd6d' },
  { id: 'bob', name: "Bob's Crew", leadName: 'Bob Martinez', rate: 28, color: '#df3021' },
  { id: 'chris', name: "Chris's Crew", leadName: 'Chris Lee', rate: 28, color: '#14b8a6' },
  { id: 'noah', name: "Noah's Crew", leadName: 'Noah Grant', rate: 30, color: '#e8752e' },
  { id: 'lucas', name: "Lucas's Crew", leadName: 'Lucas Chen', rate: 27, color: '#4193f7' },
  { id: 'liam', name: "Liam's Crew", leadName: 'Liam Brooks', rate: 33, color: '#8640f6' },
]

export const initialUnassignedCrews: UnassignedCrew[] = [
  { id: 'u1', name: "Matt's Crew", leadName: 'Hank Williams', rate: 25 },
  { id: 'u2', name: "Col's Crew", leadName: 'Cole Reyes', rate: 28 },
  { id: 'u3', name: "Cipher's Crew", leadName: 'Cipher Nakamura', rate: 30 },
  { id: 'u4', name: "Yoru's Crew", leadName: 'Yoru Sato', rate: 32 },
  { id: 'u5', name: "Jason's Crew", leadName: 'Jason Cole', rate: 27 },
]

export const activity: ActivityItem[] = [
  { id: 'a1', kind: 'labor', title: 'Labor Logged: Rafael on CapX Warehouse', email: 'rafael@ids.com', date: 'Jul 9, 5:30 PM' },
  { id: 'a2', kind: 'labor', title: 'Labor Logged: Rafael on CapX Warehouse', email: 'rafael@ids.com', date: 'Jul 9, 5:30 PM' },
  { id: 'a3', kind: 'assigned', title: 'Job Assigned: Alan on Hays State Prison Kitchen', email: 'rafael@ids.com', date: 'Jul 9, 5:30 PM' },
  { id: 'a4', kind: 'assigned', title: 'Job Assigned: Alan on Hays State Prison Kitchen', email: 'rafael@ids.com', date: 'Jul 9, 5:30 PM' },
  { id: 'a5', kind: 'completed', title: 'Job Completed: Alan on Hays State Prison Kitchen', email: 'rafael@ids.com', date: 'Jul 9, 5:30 PM' },
  { id: 'a6', kind: 'completed', title: 'Job Completed: Alan on Hays State Prison Kitchen', email: 'rafael@ids.com', date: 'Jul 9, 5:30 PM' },
  { id: 'a7', kind: 'overdue', title: 'Budget Overdue ($425): Alan on Hays State Prison Kitchen', email: 'rafael@ids.com', date: 'Jul 9, 5:30 PM' },
]

export function formatMoney(n: number) {
  return `$${n.toLocaleString('en-US')}`
}

export const crewColors = ['#8b5cf6', '#22c55e', '#e0399f', '#14b8a6', '#ef4444', '#f97316', '#3b82f6']
