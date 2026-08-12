import api from './axiosInstance'

export interface CreateDumpsterCostPayload {
  jobId: string
  date: string
  dumpsterCount: number
  dumpsterCost: number
  note?: string
}

export interface DumpsterCostItem {
  _id: string
  jobId: string
  date: string
  dumpsterCount: number
  dumpsterCost: number
  totalCost: number
  note?: string
  createdAt?: string
  updatedAt?: string
}

export interface CreateDumpsterCostResponse {
  success: boolean
  message: string
  data: DumpsterCostItem
}

export interface CostByDateItem {
  date: string
  laborCost: number
  dumpsterCost: number
  totalCost: number
  hoursWorked: number
  entryCount: number
}

export interface CostTrackingGroup {
  jobId?: string
  jobName?: string
  jobIdNumber?: number
  crewId?: string
  crewName?: string
  hourlyRate?: number
  totalLaborCost: number
  totalDumpsterCost: number
  totalHoursWorked: number
  totalEntries: number
  costByDate: CostByDateItem[]
}

export interface CostTrackingReportData {
  filters: {
    dateFilter: 'allTime' | 'custom' | 'weekly' | 'monthly'
    groupBy: 'jobs' | 'crews'
  }
  totalLaborCost: number
  totalDumpsterCost: number
  totalHoursWorked: number
  totalEntries: number
  groups: CostTrackingGroup[]
}

export interface Pagination {
  page: number
  limit: number
  totalCount: number
  totalPages: number
}

export interface CostTrackingReportResponse {
  success: boolean
  message: string
  data: CostTrackingReportData
  pagination: Pagination
}

export interface CostTrackingReportParams {
  dateFilter?: 'allTime' | 'custom' | 'weekly' | 'monthly'
  dateFrom?: string
  dateTo?: string
  startDate?: string
  groupBy?: 'jobs' | 'crews'
  jobId?: string
  crewId?: string
  search?: string
  page?: number
  limit?: number
}

export interface CostAdjustmentData {
  jobId: string
  date: string
  laborCost: number
  dumpsterCount: number
  dumpsterCost: number
  dumpsterTotalCost: number
  totalCost: number
}

export interface GetCostAdjustmentResponse {
  success: boolean
  message: string
  data: CostAdjustmentData
}

export interface AdjustCostPayload {
  jobId: string
  date: string
  laborCost: number
  dumpsterCount: number
  dumpsterCost: number
}

export interface AdjustCostResponse {
  success: boolean
  message: string
  data: CostAdjustmentData
}

export async function createDumpsterCost(
  payload: CreateDumpsterCostPayload
): Promise<CreateDumpsterCostResponse> {
  const response = await api.post<CreateDumpsterCostResponse>('/dumpster-costs', payload)
  return response.data
}

export async function getCostTrackingReport(
  params?: CostTrackingReportParams
): Promise<CostTrackingReportResponse> {
  const response = await api.get<CostTrackingReportResponse>('/reports/cost-tracking', { params })
  return response.data
}

export async function getCostAdjustment(
  jobId: string,
  date: string
): Promise<GetCostAdjustmentResponse> {
  const response = await api.get<GetCostAdjustmentResponse>('/reports/cost-tracking/adjust', {
    params: { jobId, date },
  })
  return response.data
}

export async function adjustCost(
  payload: AdjustCostPayload
): Promise<AdjustCostResponse> {
  const response = await api.patch<AdjustCostResponse>('/reports/cost-tracking/adjust', payload)
  return response.data
}

