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
  } | string | null
  membersCount: number
  crewColor: string
  status: string
  note: string | null
  job: any | null
  createdAt: string
  updatedAt: string
}

export interface GetCrewsSummaryParams {
  jobId?: string
  status?: string
  sortByName?: 'asc' | 'dec' | 'desc'
}

export interface GetCrewsSummaryResponse {
  success: boolean
  message: string
  data: CrewSummaryItem[]
}

export interface UserItem {
  _id: string
  firstName: string
  lastName: string
  email: string
  role: string
  assignCrew: {
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
  assignCrew?: string
  isActive?: boolean
}

export interface GetUsersResponse {
  success: boolean
  message: string
  data: UserItem[]
}

export interface UpdateCrewPayload {
  name?: string
  crewLead?: string
  members?: string[]
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

export async function getCrewsSummary(params?: GetCrewsSummaryParams): Promise<GetCrewsSummaryResponse> {
  const response = await api.get<GetCrewsSummaryResponse>('/crews/summary', { params })
  return response.data
}

export async function getUsers(params?: GetUsersParams): Promise<GetUsersResponse> {
  const response = await api.get<GetUsersResponse>('/users', { params })
  return response.data
}
