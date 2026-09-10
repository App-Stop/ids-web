import api from './axiosInstance'

export interface JobItem {
  _id: string
  jobIdNumber: number
  name: string
  generalContractor: string
  gcSuper?: string | null
  idsSuper?: string | any | null
  siteAddress: string
  assignToCrew: string | any | null
  currentCrew?: string | any | null
  startDate: string
  endDate: string
  contractAmount: number
  laborBudget: number
  laborBudgetUsed?: number
  note: string | null
  status: 'awarded' | 'in-progress' | 'completed' | string
  createdAt: string
  updatedAt: string
}

export interface Pagination {
  page: number
  limit: number
  totalCount: number
  totalPages: number
}

/** A stint's date/time window — shared by every crew named alongside it. */
export interface CrewAssignmentWindow {
  startDate: string
  endDate?: string
  /** "HH:mm" 24h. Send both or neither — neither means the stint runs 24/7. */
  dailyStartTime?: string
  dailyEndTime?: string
  excludeWeekends: boolean
}

/**
 * Who a stint is for: one crew, or several sharing the same window. For
 * `crewIds` the server creates one assignment per crew, all or none. Never both.
 */
export type CrewTarget = { crewId: string; crewIds?: never } | { crewIds: string[]; crewId?: never }

/**
 * One stint, as accepted inline by POST /jobs and PATCH /jobs/:id. `startDate`
 * and `excludeWeekends` are both required per entry; omitting `endDate` makes
 * the stint cover the rest of the job's own duration. There is no `note` here —
 * the job endpoints don't accept one per stint.
 */
export type CrewAssignmentPayloadItem = CrewAssignmentWindow & CrewTarget

export interface CreateJobPayload {
  jobIdNumber?: number
  name?: string
  generalContractor: string
  gcSuper?: string | null
  /**
   * Derived from the assigned crew's lead — there is no separate IDS Super
   * input any more. Still sent because Job.idsSuper is required server-side.
   */
  idsSuper?: string | null
  siteAddress?: string
  assignToCrew?: string | null
  startDate?: string
  endDate?: string
  contractAmount?: number
  laborBudget?: number
  note?: string
  status?: string
  /**
   * Crews to put on the job as it is created. A single object is still
   * accepted, but an array assigns several crews in one request — and the
   * whole thing is atomic: if any stint is rejected the job is rolled back
   * too, so the client never has to clean up a half-assigned job.
   */
  crewAssignment?: CrewAssignmentPayloadItem | CrewAssignmentPayloadItem[]
}

export type UpdateJobPayload = Partial<CreateJobPayload>

export interface CreateJobResponse {
  success: boolean
  message: string
  data: JobItem
}

export interface UpdateJobResponse {
  success: boolean
  message: string
  data: JobItem
}

export interface DeleteJobResponse {
  success: boolean
  message: string
}

export interface GetJobsParams {
  status?: string
  assignToCrew?: string
  search?: string
  sortBy?: string
  page?: number
  limit?: number
}

export interface GetJobsResponse {
  success: boolean
  message: string
  data: JobItem[]
  pagination: Pagination
}

export interface GetJobResponse {
  success: boolean
  message: string
  data: JobItem
}

export async function createJob(payload: CreateJobPayload): Promise<CreateJobResponse> {
  const response = await api.post<CreateJobResponse>('/jobs', payload)
  return response.data
}

export async function updateJob(id: string, payload: UpdateJobPayload): Promise<UpdateJobResponse> {
  const response = await api.patch<UpdateJobResponse>(`/jobs/${id}`, payload)
  return response.data
}

export async function deleteJob(id: string): Promise<DeleteJobResponse> {
  const response = await api.delete<DeleteJobResponse>(`/jobs/${id}`)
  return response.data
}

export async function getJobs(params?: GetJobsParams): Promise<GetJobsResponse> {
  const response = await api.get<GetJobsResponse>('/jobs', { params })
  return response.data
}

export async function getJobById(id: string): Promise<GetJobResponse> {
  const response = await api.get<GetJobResponse>(`/jobs/${id}`)
  return response.data
}

// --- Crew assignments -------------------------------------------------------
// A job's timeline is a sequence of non-overlapping crew "stints". The backend
// rejects (409) any stint that overlaps another on the same job, or that puts
// the same crew on two jobs at once.

/** Crew summary as embedded in an assignment row (crewSummaryTransformer). */
export interface AssignmentCrew {
  _id: string
  name: string | null
  crewLead: { _id: string; firstName?: string; lastName?: string; email?: string } | string | null
  membersCount: number
  crewColor: string | null
  status: string | null
  note: string | null
}

export interface CrewAssignment {
  _id: string
  jobId: string
  /** Populated crew, or null when the backend didn't populate it. */
  crew: AssignmentCrew | null
  crewId: string
  startDate: string
  /** null = open-ended; the stint runs until explicitly closed out. */
  endDate: string | null
  /**
   * Recurring daily window ("HH:mm", 24h) applied to every day in the range.
   * Both null = the stint runs the whole day. The window may wrap past
   * midnight, e.g. "22:00"-"06:00" for an overnight shift.
   */
  dailyStartTime: string | null
  dailyEndTime: string | null
  laborCost: number
  isLaborCostOverridden: boolean
  status: 'scheduled' | 'cancelled'
  /** True when this stint's date range covers today. */
  isCurrent: boolean
  excludeWeekends?: boolean
  note: string | null
  createdAt: string
  updatedAt: string
}

interface CrewAssignmentFields {
  startDate: string
  endDate?: string
  /** Send both or neither; omitting both assigns the crew for the whole day. */
  dailyStartTime?: string
  dailyEndTime?: string
  excludeWeekends?: boolean
  /** Passing this marks the cost as admin-overridden; omit to auto-compute. */
  laborCost?: number
  note?: string
}

/**
 * One crew, or several sharing one window (one assignment per crew, all or
 * none). The server rejects a `laborCost` override for several crews at once.
 */
export type CreateCrewAssignmentPayload =
  | (CrewAssignmentFields & { crewId: string; crewIds?: never })
  | (Omit<CrewAssignmentFields, 'laborCost'> & { crewIds: string[]; crewId?: never; laborCost?: never })

export type UpdateCrewAssignmentPayload = Partial<Omit<CrewAssignmentFields, 'endDate'>> & {
  /** A saved stint belongs to one crew — this endpoint rejects `crewIds`. */
  crewId?: string
  /** Explicit null clears the end date, making the stint open-ended. */
  endDate?: string | null
}

export interface CrewAssignmentResponse {
  success: boolean
  message: string
  data: CrewAssignment
}

export interface ListCrewAssignmentsResponse {
  success: boolean
  message: string
  data: CrewAssignment[]
}

export async function getCrewAssignments(jobId: string): Promise<ListCrewAssignmentsResponse> {
  const response = await api.get<ListCrewAssignmentsResponse>(`/jobs/${jobId}/crew-assignments`)
  return response.data
}

export async function createCrewAssignment(
  jobId: string,
  payload: CreateCrewAssignmentPayload,
): Promise<CrewAssignmentResponse> {
  const response = await api.post<CrewAssignmentResponse>(`/jobs/${jobId}/crew-assignments`, payload)
  return response.data
}

export async function updateCrewAssignment(
  jobId: string,
  assignmentId: string,
  payload: UpdateCrewAssignmentPayload,
): Promise<CrewAssignmentResponse> {
  const response = await api.patch<CrewAssignmentResponse>(
    `/jobs/${jobId}/crew-assignments/${assignmentId}`,
    payload,
  )
  return response.data
}

/** Rejected (400) once the stint has started — trim its endDate instead. */
export async function deleteCrewAssignment(
  jobId: string,
  assignmentId: string,
): Promise<DeleteJobResponse> {
  const response = await api.delete<DeleteJobResponse>(
    `/jobs/${jobId}/crew-assignments/${assignmentId}`,
  )
  return response.data
}

// --- Schedule board ---------------------------------------------------------

export interface GetScheduleParams {
  /** Anchor day (ISO date). Weekly spans 7 days from here, monthly spans 30. */
  startDate: string
  view?: 'weekly' | 'monthly'
  search?: string
  jobId?: string
  status?: string
  /** 1-based. Backend clamps to the last page. */
  page?: number
  /** 1–100, backend default 20. */
  limit?: number
}

export interface SchedulePagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export interface ScheduleJobRow extends JobItem {
  /** Stints overlapping the requested range, sorted by startDate. */
  assignments: CrewAssignment[]
  /**
   * Per-day job notes in range. Only present once the backend embeds them in
   * the schedule response; until then the board fetches them from /notes.
   */
  notes?: Array<{ _id: string; jobId: string; date: string; note: string }>
}

export interface GetScheduleResponse {
  success: boolean
  message: string
  data: {
    range: { from: string; to: string }
    pagination: SchedulePagination
    jobs: ScheduleJobRow[]
  }
}

export async function getSchedule(params: GetScheduleParams): Promise<GetScheduleResponse> {
  const response = await api.get<GetScheduleResponse>('/jobs/schedule', { params })
  return response.data
}
