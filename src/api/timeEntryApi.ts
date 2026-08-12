import api from './axiosInstance'

export interface TimeEntryGeoPoint {
  lat: number
  lng: number
}

/** Shape returned by `timeEntryTransformer` on the backend. */
export interface TimeEntryItem {
  _id: string
  jobId: string | null
  crewId: string | null
  userId: string | any | null
  date: string | null
  clockIn: string | null
  clockOut: string | null
  clockInPicture: unknown | null
  clockOutPicture: unknown | null
  hourlyRate: number | null
  hoursWorked: number | null
  laborCost: number | null
  clockInLocation: TimeEntryGeoPoint | null
  clockOutLocation: TimeEntryGeoPoint | null
  status: 'active' | 'completed' | null
  override: boolean
  createdAt: string | null
  updatedAt: string | null
}

export interface GetTimeEntriesParams {
  jobId?: string
  crewId?: string
  userId?: string
  /** YYYY-MM-DD — compared against the entry's UTC day. */
  dateFrom?: string
  dateTo?: string
}

export interface GetTimeEntriesResponse {
  success: boolean
  message: string
  data: TimeEntryItem[]
}

export interface GetTimeEntryResponse {
  success: boolean
  message: string
  data: TimeEntryItem
}

export interface CreateTimesheetLogPayload {
  userId: string
  /** YYYY-MM-DD */
  date: string
  /** Full ISO timestamp */
  clockIn: string
  clockOut?: string
  override?: boolean
}

export interface UpdateTimeEntryPayload {
  jobId?: string
  crewId?: string
  date?: string
  clockIn?: string
  clockOut?: string
  hourlyRate?: number
  hoursWorked?: number
  laborCost?: number
  status?: 'active' | 'completed'
  override?: boolean
  clockInLat?: number
  clockInLng?: number
  clockOutLat?: number
  clockOutLng?: number
}

export interface DeleteTimeEntryResponse {
  success: boolean
  message: string
}

export interface LaborReportRow {
  userId: string
  name: string
  role: string
  date: string
  clockIn: string | null
  clockOut: string | null
  hoursWorked: number | null
}

export interface LaborReportParams {
  userId?: string
  range?: 'all' | 'monthly' | 'weekly' | 'today'
  sortBy?: 'newest' | 'oldest' | 'hoursDesc' | 'hoursAsc' | 'nameAsc' | 'nameDesc'
  search?: string
  page?: number
  limit?: number
}

export interface LaborReportResponse {
  success: boolean
  message: string
  data: {
    records: LaborReportRow[]
    summary: {
      totalHours: number
      membersLogged: number
      daysCovered: number
      avgHoursPerDay: number
    }
  }
  pagination: { page: number; limit: number; totalCount: number; totalPages: number }
}

export async function getTimeEntries(params?: GetTimeEntriesParams): Promise<GetTimeEntriesResponse> {
  const response = await api.get<GetTimeEntriesResponse>('/time-entries', { params })
  return response.data
}

export async function getTimeEntryById(id: string): Promise<GetTimeEntryResponse> {
  const response = await api.get<GetTimeEntryResponse>(`/time-entries/${id}`)
  return response.data
}

export async function getLaborReport(params?: LaborReportParams): Promise<LaborReportResponse> {
  const response = await api.get<LaborReportResponse>('/time-entries/report', { params })
  return response.data
}

export async function createTimesheetLog(payload: CreateTimesheetLogPayload): Promise<GetTimeEntryResponse> {
  const response = await api.post<GetTimeEntryResponse>('/time-entries/create-timesheet-log', payload)
  return response.data
}

export async function updateTimeEntry(id: string, payload: UpdateTimeEntryPayload): Promise<GetTimeEntryResponse> {
  const response = await api.patch<GetTimeEntryResponse>(`/time-entries/${id}`, payload)
  return response.data
}

export async function deleteTimeEntry(id: string): Promise<DeleteTimeEntryResponse> {
  const response = await api.delete<DeleteTimeEntryResponse>(`/time-entries/${id}`)
  return response.data
}
