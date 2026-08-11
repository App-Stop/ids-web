export type Status = 'Active' | 'Inactive' | 'Assigned' | 'Unassigned'

export interface CrewJobAssignment {
  bidNo: string
  jobNo: string
  date: string // MM-DD-YYYY, display-ready
  jobName: string
}

export interface CrewRow {
  id: string
  crewId: string // e.g. '8742'
  name: string
  avatar: string
  color: string
  jobs: CrewJobAssignment[]
  workers: number
  laborNames: string[]
  rate: number
  status: Status
}

export interface RosterRow {
  id: string
  rosterId: string // e.g. '68'
  name: string
  avatar: string
  crewName: string | null
  crewColor: string
  role: 'Labor' | 'Crew Lead'
  rate: number
  status: Status
}

export interface CrewMenuOption {
  id: string
  label: string
  color: string
  avatar?: string
  avatarName?: string
}

export interface JobMenuOption {
  id: string
  label: string
}

const avatar = (seed: number) => `https://i.pravatar.cc/64?img=${seed}`

export const crewRows: CrewRow[] = [
  {
    id: 'c8742',
    crewId: '8742',
    name: "Hank's Crew",
    avatar: avatar(12),
    color: '#e0399f',
    jobs: [
      { bidNo: '1001', jobNo: '001', date: '12-07-2026', jobName: 'Maplewood Community Center Renovation' }
    ],
    workers: 4,
    laborNames: ['Maya R.', 'Liam T.', 'Sophia K.', 'Ethan B.'],
    rate: 30,
    status: 'Active',
  },
  {
    id: 'c5917',
    crewId: '5917',
    name: "John's Crew",
    avatar: avatar(33),
    color: '#22c55e',
    jobs: [{ bidNo: '1002', jobNo: '002', date: '20-07-2026', jobName: 'Riverside Bridge Repair' }],
    workers: 5,
    laborNames: ['Avery N.', 'Noah P.', 'Mila S.', 'Cole R.', 'June H.'],
    rate: 40,
    status: 'Inactive',
  },
  {
    id: 'c4638',
    crewId: '4638',
    name: "Bob's Crew",
    avatar: avatar(51),
    color: '#ef4444',
    jobs: [{ bidNo: '1003', jobNo: '003', date: '16-07-2026', jobName: 'Greenfield Library Expansion' }],
    workers: 4,
    laborNames: ['Rico M.', 'Landon F.', 'Tessa J.', 'Owen P.'],
    rate: 25,
    status: 'Active',
  },
  {
    id: 'c7291',
    crewId: '7291',
    name: "Chris's Crew",
    avatar: avatar(15),
    color: '#06b6d4',
    jobs: [
      { bidNo: '1004', jobNo: '004', date: '14-07-2026', jobName: 'Oakridge High School Gym Upgrade' }
    ],
    workers: 4,
    laborNames: ['Zane D.', 'Ivy M.', 'Marco L.', 'Aria S.'],
    rate: 30,
    status: 'Active',
  },
  {
    id: 'c3856',
    crewId: '3856',
    name: "Noah's Crew",
    avatar: avatar(22),
    color: '#f97316',
    jobs: [
      { bidNo: '1005', jobNo: '005', date: '12-07-2026', jobName: 'Pinecrest Water Treatment Plant Maintenance' }
    ],
    workers: 6,
    laborNames: ['Nia C.', 'Leo W.', 'Mina T.'],
    rate: 35,
    status: 'Active',
  },
  {
    id: 'c6429',
    crewId: '6429',
    name: "Lucas's Crew",
    avatar: avatar(41),
    color: '#3b82f6',
    jobs: [{ bidNo: '1006', jobNo: '006', date: '18-07-2026', jobName: 'Sunset Park Playground Replacement' }],
    workers: 5,
    laborNames: ['Finn J.', 'Luca P.', 'Ruby A.'],
    rate: 45,
    status: 'Active',
  },
]

export const rosterRows: RosterRow[] = [
  { id: 'r68', rosterId: '68', name: 'Hank Williams', avatar: avatar(12), crewName: "Hank's Crew", crewColor: '#e0399f', role: 'Crew Lead', rate: 30, status: 'Active' },
  { id: 'r64a', rosterId: '64', name: 'Kathy Pacheco', avatar: avatar(45), crewName: "John's Crew", crewColor: '#22c55e', role: 'Labor', rate: 40, status: 'Inactive' },
  { id: 'r67', rosterId: '67', name: 'John Dukes', avatar: avatar(52), crewName: "Noah's Crew", crewColor: '#f97316', role: 'Labor', rate: 25, status: 'Inactive' },
  { id: 'r65', rosterId: '65', name: 'Katie Sims', avatar: avatar(47), crewName: "Hank's Crew", crewColor: '#e0399f', role: 'Crew Lead', rate: 30, status: 'Active' },
  { id: 'r66', rosterId: '66', name: 'Bradley Lawlor', avatar: avatar(60), crewName: "Bob's Crew", crewColor: '#ef4444', role: 'Labor', rate: 35, status: 'Active' },
  { id: 'r64b', rosterId: '64', name: 'Iva Ryan', avatar: avatar(48), crewName: "Chris's Crew", crewColor: '#06b6d4', role: 'Labor', rate: 45, status: 'Active' },
  { id: 'r64c', rosterId: '64', name: 'Isaac Ryder', avatar: avatar(29), crewName: null, crewColor: '#808080', role: 'Labor', rate: 45, status: 'Unassigned' },
  { id: 'r64d', rosterId: '64', name: 'Ivan Reyes', avatar: avatar(31), crewName: null, crewColor: '#808080', role: 'Labor', rate: 45, status: 'Unassigned' },
]

// Full crew directory used for filter/assign dropdowns (a superset of the
// crews shown in the Crew tab table, since not every crew has to appear
// there to be assignable on the Roster side).
export const crewMenuOptions: CrewMenuOption[] = [
  { id: 'c8742', label: "Hank's Crew", color: '#e0399f', avatar: avatar(12), avatarName: 'Hank Williams' },
  { id: 'c5917', label: "John's Crew", color: '#22c55e', avatar: avatar(33), avatarName: 'John D.' },
  { id: 'c4638', label: "Bob's Crew", color: '#ef4444', avatar: avatar(51), avatarName: 'Bob Martinez' },
  { id: 'c7291', label: "Chris's Crew", color: '#06b6d4', avatar: avatar(15), avatarName: 'Chris Lee' },
  { id: 'c3856', label: "Noah's Crew", color: '#f97316', avatar: avatar(22), avatarName: 'Noah Grant' },
  { id: 'c6429', label: "Lucas's Crew", color: '#3b82f6', avatar: avatar(41), avatarName: 'Lucas Chen' },
]

export const jobMenuOptions: JobMenuOption[] = [
  { id: '#001', label: 'Maplewood Community Center Renovation' },
  { id: '#002', label: 'Riverside Bridge Repair' },
  { id: '#003', label: 'Greenfield Library Expansion' },
  { id: '#004', label: 'Oakridge High School Gym Upgrade' },
  { id: '#005', label: 'Pinecrest Water Treatment Plant Maintenance' },
  { id: '#006', label: 'Sunset Park Playground Replacement' },
]
