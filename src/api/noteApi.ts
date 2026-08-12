import api from './axiosInstance'

/**
 * Per-job-per-day notes. Distinct from `CrewAssignment.note`, which belongs to
 * a single crew stint — a day note stays put regardless of who is assigned.
 */
export interface DayNote {
  _id: string
  jobId: string
  date: string
  note: string
  createdAt: string
  updatedAt: string
}

export interface DayNoteResponse {
  success: boolean
  message: string
  data: DayNote
}

export interface ListDayNotesResponse {
  success: boolean
  message: string
  data: DayNote[]
}

export interface ListDayNotesParams {
  /** Omit to get notes across all jobs in the range. */
  jobId?: string
  dateFrom?: string
  dateTo?: string
}

export async function getDayNotes(params?: ListDayNotesParams): Promise<ListDayNotesResponse> {
  const response = await api.get<ListDayNotesResponse>('/notes', { params })
  return response.data
}

export async function createDayNote(payload: {
  jobId: string
  date: string
  note: string
}): Promise<DayNoteResponse> {
  const response = await api.post<DayNoteResponse>('/notes', payload)
  return response.data
}

export async function updateDayNote(
  id: string,
  payload: { jobId?: string; date?: string; note?: string },
): Promise<DayNoteResponse> {
  const response = await api.patch<DayNoteResponse>(`/notes/${id}`, payload)
  return response.data
}

export async function deleteDayNote(id: string): Promise<{ success: boolean; message: string }> {
  const response = await api.delete(`/notes/${id}`)
  return response.data
}
