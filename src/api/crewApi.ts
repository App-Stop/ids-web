import api from './axiosInstance'

export interface CreateCrewPayload {
  name: string
  crewLead: string
  members: string[]
  crewColor: string
  status?: string
}

export interface CrewDataResponse {
  _id: string
  name: string
  crewLead: string | null
  members: string[]
  crewColor: string
  status: string
  note: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateCrewResponse {
  success: boolean
  message: string
  data: CrewDataResponse
}

export interface CreateUserPayload {
  firstName: string
  lastName: string
  email: string
  role: 'labor' | 'crew-lead'
  hourlyRate?: number
  assignCrew?: string
  password?: string
}

export interface UserResponseData {
  user: {
    _id: string
    firstName: string
    lastName: string
    email: string
    role: string
    assignCrew?: any
    hourlyRate?: number
    isActive: boolean
    createdAt: string
    updatedAt: string
  }
  temporaryPassword?: string
}

export interface CreateUserResponse {
  success: boolean
  message: string
  data: UserResponseData
}

export interface CrewSummaryItem {
  _id: string
  name: string
  crewLead: {
    _id: string
    firstName?: string
    lastName?: string
    email?: string
    hourlyRate?: number | null
  } | string | null
  membersCount: number
  crewColor: string
  status: string
  note: string | null
  /** crewSummaryTransformer only projects _id + name; enrich from /jobs for the rest. */
  job: { _id: string; name: string | null } | null
  createdAt: string
  updatedAt: string
}

export interface GetCrewsSummaryParams {
  statusEmployee?: 'crew' | 'roster'
  status?: string
  search?: string
  jobId?: string
  crewId?: string
  sortBy?: 'nameAsc' | 'nameDesc' | 'rateAsc' | 'rateDesc' | string
  page?: number
  limit?: number
  sortByName?: 'asc' | 'desc'
}

export interface GetCrewsSummaryResponse {
  success: boolean
  message: string
  data: any[]
  pagination?: Pagination
}

export interface UserItem {
  _id: string
  firstName: string
  lastName: string
  email: string
  role: string
  assignCrew?: {
    _id: string
    name: string
    crewLead?: string
    members?: string[]
    crewColor?: string
    status?: string
    isDeleted?: boolean
    createdAt?: string
    updatedAt?: string
  } | null
  crew?: {
    _id: string
    name: string
    crewLead?: string
    members?: string[]
    crewColor?: string
    status?: string
    isDeleted?: boolean
    createdAt?: string
    updatedAt?: string
  } | null
  hourlyRate: number | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface GetUsersParams {
  role?: string
  /** A crew _id, or the literal 'null' to match users with no crew. */
  assignCrew?: string
  isActive?: boolean
  search?: string
  page?: number
  limit?: number
}

export interface Pagination {
  page: number
  limit: number
  totalCount: number
  totalPages: number
}

export interface GetUsersResponse {
  success: boolean
  message: string
  data: UserItem[]
  pagination: Pagination
}

export interface UpdateCrewPayload {
  name?: string
  crewLead?: string
  members?: string[]
  crewColor?: string
  status?: string
  note?: string
}

export interface UpdateCrewResponse {
  success: boolean
  message: string
  data: CrewDataResponse
}

export interface UpdateUserPayload {
  firstName?: string
  lastName?: string
  role?: 'labor' | 'crew-lead'
  hourlyRate?: number
  assignCrew?: string | null
  isActive?: boolean
}

export interface UpdateUserResponse {
  success: boolean
  message: string
  data: UserItem
}

export interface GetCrewResponse {
  success: boolean
  message: string
  data: {
    _id: string
    name: string
    crewLead: any
    members: any[]
    crewColor?: string
    status: string
    note: string | null
    job?: any
    createdAt: string
    updatedAt: string
  }
}

export interface GetUserResponse {
  success: boolean
  message: string
  data: UserItem
}

export async function getCrewById(id: string): Promise<GetCrewResponse> {
  const response = await api.get<GetCrewResponse>(`/crews/${id}`)
  return response.data
}

export async function getUserById(id: string): Promise<GetUserResponse> {
  const response = await api.get<GetUserResponse>(`/users/${id}`)
  return response.data
}

export async function createCrew(payload: CreateCrewPayload): Promise<CreateCrewResponse> {
  const response = await api.post<CreateCrewResponse>('/crews', payload)
  return response.data
}

export async function updateCrew(id: string, payload: UpdateCrewPayload): Promise<UpdateCrewResponse> {
  const response = await api.patch<UpdateCrewResponse>(`/crews/${id}`, payload)
  return response.data
}

export async function createUser(payload: CreateUserPayload): Promise<CreateUserResponse> {
  const response = await api.post<CreateUserResponse>('/users', payload)
  return response.data
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<UpdateUserResponse> {
  const response = await api.patch<UpdateUserResponse>(`/users/${id}`, payload)
  return response.data
}

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
}

/** Crew-lead / labour self-service password change (user token). */
export async function changePassword(payload: ChangePasswordPayload): Promise<DeleteResponse> {
  const response = await api.patch<DeleteResponse>('/users/me/password', payload)
  return response.data
}

export interface ChangeAdminPasswordPayload extends ChangePasswordPayload {
  confirmNewPassword: string
}

/** Admin self-service password change. Admin tokens are rejected by /users/me/password. */
export async function changeAdminPassword(
  payload: ChangeAdminPasswordPayload,
): Promise<DeleteResponse> {
  const response = await api.patch<DeleteResponse>('/admin/me/password', payload)
  return response.data
}

export interface DeleteResponse {
  success: boolean
  message: string
}

/** Soft-deletes the crew and unassigns its lead + members. */
export async function deleteCrew(id: string): Promise<DeleteResponse> {
  const response = await api.delete<DeleteResponse>(`/crews/${id}`)
  return response.data
}

/** There is no hard user delete — DELETE /users/:id flips isActive to false. */
export async function deactivateUser(id: string): Promise<DeleteResponse> {
  const response = await api.delete<DeleteResponse>(`/users/${id}`)
  return response.data
}

/**
 * Stronger than deactivateUser: sets isDeleted (and isActive false) regardless
 * of current state, pulls the user out of any crew they lead or belong to, and
 * force-clocks them out of an open shift. Use for "remove this person", and
 * deactivateUser only for a reversible active/inactive toggle.
 */
export async function softDeleteUser(id: string): Promise<DeleteResponse> {
  const response = await api.delete<DeleteResponse>(`/users/${id}/soft-delete`)
  return response.data
}

/** Detaches one member from a crew and clears their assignCrew. */
export async function removeCrewMember(
  crewId: string,
  memberId: string,
): Promise<GetCrewResponse> {
  const response = await api.delete<GetCrewResponse>(`/crews/${crewId}/members/${memberId}`)
  return response.data
}

export interface RemoveCrewLeadOrMemberPayload {
  memberId?: string
  removeCrewLead?: boolean
}

/**
 * Same member removal as removeCrewMember, plus the only way to clear a crew's
 * lead. The backend requires exactly one of memberId / removeCrewLead.
 * Note: unlike changing the lead via PATCH /crews/:id, this does NOT demote the
 * user back to 'labor' — they keep role 'crew-lead' with no crew, which makes
 * them unselectable in the crew modal's dropdowns until their role is changed.
 */
export async function removeCrewLeadOrMember(
  crewId: string,
  payload: RemoveCrewLeadOrMemberPayload,
): Promise<GetCrewResponse> {
  const response = await api.delete<GetCrewResponse>(`/crews/${crewId}/lead-or-member`, {
    data: payload,
  })
  return response.data
}

export async function getCrewsSummary(params?: GetCrewsSummaryParams): Promise<GetCrewsSummaryResponse> {
  const response = await api.get<GetCrewsSummaryResponse>('/crews/summary', { params })
  return response.data
}

export async function getUsers(params?: GetUsersParams): Promise<GetUsersResponse> {
  const response = await api.get<GetUsersResponse>('/users', { params })
  return response.data
}
