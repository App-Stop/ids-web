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
  startDate: string
  endDate: string
  contractAmount: number
  laborBudget: number
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

export interface CreateJobPayload {
  jobIdNumber?: number
  name?: string
  generalContractor: string
  gcSuper?: string | null
  idsSuper?: string | null
  siteAddress: string
  assignToCrew?: string | null
  startDate?: string
  endDate?: string
  contractAmount: number
  laborBudget: number
  note?: string
  status?: string
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
