import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { assignableCrews } from './dashboardData'
import { initialManagedJobs } from './jobsManagementData'

export interface StoreJob {
  id: string
  name: string
  bidNo: string
  jobNo: string
  gc: string
  gcSuper: string
  idsSuper: string
  contractAmount: number
  laborBudgetUsed: number
  laborBudgetTotal: number
  color: string
}

export interface StoreCrew {
  id: string
  name: string
  leadName: string
  rate: number
  color: string
  avatar: string
}

export interface StoreAssignment {
  id: string
  jobId: string
  crewId: string
  startDate: string
  endDate: string
  note?: string
}

interface AppState {
  jobs: StoreJob[]
  crews: StoreCrew[]
  assignments: StoreAssignment[]
  assignCrew: (jobId: string, crewId: string, startDate: string, endDate: string, note?: string) => void
  removeAssignment: (assignmentId: string) => void
}

const initialStoreJobs: StoreJob[] = initialManagedJobs.map(j => ({
  id: j.id,
  name: j.name,
  bidNo: String(1000 + Number(j.id.replace('#', ''))),
  jobNo: j.id.replace('#', ''),
  gc: j.gc,
  gcSuper: j.gcSuper,
  idsSuper: j.idsSuper,
  contractAmount: j.contract,
  laborBudgetUsed: j.laborBudgetUsed,
  laborBudgetTotal: j.laborBudgetTotal,
  color: j.color
}))

const initialStoreAssignments: StoreAssignment[] = initialManagedJobs.map(j => {
  const crew = assignableCrews.find(c => c.name === j.crewName)
  if (!crew) return null
  return {
    id: `assign-${j.id}-${crew.id}`,
    jobId: j.id,
    crewId: crew.id,
    startDate: j.startDate,
    endDate: j.endDate,
  }
}).filter(Boolean) as StoreAssignment[]

function parseDate(dStr: string) {
  const [day, month, year] = dStr.split('-').map(Number)
  return new Date(year, month - 1, day).getTime()
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      jobs: initialStoreJobs,
      crews: assignableCrews,
      assignments: initialStoreAssignments,

      assignCrew: (jobId: string, crewId: string, startDate: string, endDate: string, note?: string) => {
        const { assignments } = get()
        const newStart = parseDate(startDate)
        const newEnd = parseDate(endDate)

        // Check if the crew is already assigned to ANY job overlapping these dates
        const overlap = assignments.find((a: StoreAssignment) => {
          if (a.crewId !== crewId) return false
          const aStart = parseDate(a.startDate)
          const aEnd = parseDate(a.endDate)
          return newStart <= aEnd && newEnd >= aStart
        })

        if (overlap) {
          throw new Error(`Crew is already assigned to a job between ${overlap.startDate} and ${overlap.endDate}`)
        }

        const newAssignment: StoreAssignment = {
          id: `assign-${Date.now()}`,
          jobId,
          crewId,
          startDate,
          endDate,
          note
        }

        set((state: AppState) => ({
          assignments: [...state.assignments, newAssignment]
        }))
      },

      removeAssignment: (assignmentId: string) => {
        set((state: AppState) => ({
          assignments: state.assignments.filter((a: StoreAssignment) => a.id !== assignmentId)
        }))
      }
    }),
    {
      name: 'ids-data-store-v4',
    }
  )
)
