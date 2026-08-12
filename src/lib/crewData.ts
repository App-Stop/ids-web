// Types only — every row, dropdown option and menu on the Crew page is loaded
// from the API at runtime (see src/pages/Crew.tsx). Nothing here is seeded.

export type Status = 'Active' | 'Inactive' | 'Assigned' | 'Unassigned'

export interface CrewJobAssignment {
  /** Real job _id, so the row can be opened / reassigned against the API. */
  jobId: string
  /** The backend has no bid number; null renders as "Job #N" alone. */
  bidNo: string | null
  jobNo: string
  /** Job start date, ISO (YYYY-MM-DD). */
  date: string
  jobName: string
}

export interface CrewRow {
  id: string
  crewId: string
  name: string
  color: string
  jobs: CrewJobAssignment[]
  workers: number
  /** Member names, lazily fetched from GET /crews/:id on demand. */
  laborNames: string[]
  /** Crew lead's hourly rate, or null when the lead has none set. */
  rate: number | null
  leadName: string
  status: Status
}

export interface RosterRow {
  id: string
  rosterId: string
  name: string
  /** No avatar field exists on the User model; omitted here, rendered as initials. */
  avatar?: string
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
