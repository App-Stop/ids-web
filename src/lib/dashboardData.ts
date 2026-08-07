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
  avatar?: string
}

export interface UnassignedCrew {
  id: string
  name: string
  leadName: string
  rate: number
  avatar?: string
}

export function crewAvatarUrl(seed: number) {
  return `https://i.pravatar.cc/64?img=${seed}`
}

export const jobs: Job[] = [
  { id: '#001', name: 'Maplewood Community Center Renovation', color: '#ea3da9', bidNo: '1001', jobNo: '001', gc: 'John D.', estimator: 'Ethan R.', startDate: '12-07-2026', endDate: '13-07-2026', contractAmount: 50000, laborBudgetUsed: 10421, laborBudgetTotal: 12000 },
  { id: '#002', name: 'Riverside Bridge Repair', color: '#56bd6d', bidNo: '1002', jobNo: '002', gc: 'Alice M.', estimator: 'Maya K.', startDate: '20-07-2026', endDate: '21-07-2026', contractAmount: 50000, laborBudgetUsed: 10421, laborBudgetTotal: 12000 },
  { id: '#003', name: 'Greenfield Library Expansion', color: '#df3021', bidNo: '1003', jobNo: '003', gc: 'Emily T.', estimator: 'Liam J.', startDate: '16-07-2026', endDate: '17-07-2026', contractAmount: 50000, laborBudgetUsed: 10421, laborBudgetTotal: 12000 },
  { id: '#004', name: 'Oakridge High School Gym Upgrade', color: '#4193f7', bidNo: '1004', jobNo: '004', gc: 'Michael B.', estimator: 'Noah W.', startDate: '14-07-2026', endDate: '15-07-2026', contractAmount: 50000, laborBudgetUsed: 10421, laborBudgetTotal: 12000 },
  { id: '#005', name: 'Pinecrest Water Treatment Plant Maintenance', color: '#e8752e', bidNo: '1005', jobNo: '005', gc: 'Robert S.', estimator: 'Olivia P.', startDate: '12-07-2026', endDate: '13-07-2026', contractAmount: 50000, laborBudgetUsed: 10421, laborBudgetTotal: 12000 },
  { id: '#006', name: 'Sunset Park Playground Replacement', color: '#14b8a6', bidNo: '1006', jobNo: '006', gc: 'Alice S.', estimator: 'Steve P.', startDate: '18-07-2026', endDate: '19-07-2026', contractAmount: 50000, laborBudgetUsed: 0, laborBudgetTotal: 12000 },
]

export const crewLeads: CrewLead[] = [
  { id: 'c1', name: 'Jameson Reed', rate: 35, avatar: crewAvatarUrl(5) },
  { id: 'c2', name: 'Lena Ortiz', rate: 42, avatar: crewAvatarUrl(9) },
  { id: 'c3', name: 'Milo Grant', rate: 38, avatar: crewAvatarUrl(14) },
  { id: 'c4', name: 'Nina Patel', rate: 40, avatar: crewAvatarUrl(20) },
  { id: 'c5', name: 'Eli Turner', rate: 37, avatar: crewAvatarUrl(26) },
]

/** Crews shown in Assign Crew dropdowns (avatar + name + color). */
export const assignableCrews: {
  id: string
  name: string
  leadName: string
  rate: number
  color: string
  avatar: string
}[] = [
  { id: 'hank', name: "Hank's Crew", leadName: 'Hank Williams', rate: 35, color: '#ea3da9', avatar: crewAvatarUrl(12) },
  { id: 'john', name: "John's Crew", leadName: 'John D.', rate: 32, color: '#56bd6d', avatar: crewAvatarUrl(33) },
  { id: 'bob', name: "Bob's Crew", leadName: 'Bob Martinez', rate: 28, color: '#df3021', avatar: crewAvatarUrl(51) },
  { id: 'chris', name: "Chris's Crew", leadName: 'Chris Lee', rate: 28, color: '#14b8a6', avatar: crewAvatarUrl(15) },
  { id: 'noah', name: "Noah's Crew", leadName: 'Noah Grant', rate: 30, color: '#e8752e', avatar: crewAvatarUrl(22) },
  { id: 'lucas', name: "Lucas's Crew", leadName: 'Lucas Chen', rate: 27, color: '#4193f7', avatar: crewAvatarUrl(41) },
]

export const initialUnassignedCrews: UnassignedCrew[] = [
  { id: 'u1', name: "Matt's Crew", leadName: 'Hank Williams', rate: 25, avatar: crewAvatarUrl(12) },
  { id: 'u2', name: "Col's Crew", leadName: 'Cole Reyes', rate: 28, avatar: crewAvatarUrl(28) },
  { id: 'u3', name: "Cipher's Crew", leadName: 'Cipher Nakamura', rate: 30, avatar: crewAvatarUrl(36) },
  { id: 'u4', name: "Yoru's Crew", leadName: 'Yoru Sato', rate: 32, avatar: crewAvatarUrl(44) },
  { id: 'u5', name: "Jason's Crew", leadName: 'Jason Cole', rate: 27, avatar: crewAvatarUrl(49) },
]

export function findCrewAvatar(nameOrId?: string | null) {
  if (!nameOrId) return undefined
  const fromAssignable = assignableCrews.find(
    (crew) => crew.id === nameOrId || crew.name === nameOrId || crew.leadName === nameOrId,
  )
  if (fromAssignable) return fromAssignable.avatar
  const fromLead = crewLeads.find((lead) => lead.id === nameOrId || lead.name === nameOrId)
  if (fromLead?.avatar) return fromLead.avatar
  const fromUnassigned = initialUnassignedCrews.find(
    (crew) => crew.id === nameOrId || crew.name === nameOrId || crew.leadName === nameOrId,
  )
  return fromUnassigned?.avatar
}

export function formatMoney(n: number) {
  return `$${n.toLocaleString('en-US')}`
}

export const crewColors = ['#8b5cf6', '#22c55e', '#e0399f', '#14b8a6', '#ef4444', '#f97316', '#3b82f6']
