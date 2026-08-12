import api from './axiosInstance'

export interface DashboardJobsSummary {
  totalJobs: number
  activeJobs: number
  unassignedJobs: number
}

export interface DashboardCrewsSummary {
  totalCrewsAssigned: number
  unassignedCrews: number
  totalCrewMembers: number
}

export interface UnassignedJobItem {
  _id: string
  jobIdNumber: number
  Name: string
  generalContractor: string
  siteAddress: string
  startDate: string
  endDate?: string
  status: string
}

export interface UnassignedCrewItem {
  _id: string
  name: string
  crewLead: string
  members: string[]
  crewColor: string
}

export interface DashboardLaborCost {
  thisWeek: number
  lastWeek: number
  percentChange: number
}

export interface JobOverBudgetItem {
  _id: string
  jobIdNumber?: number
  Name?: string
  laborBudget?: number
  laborCost?: number
  overBudgetBy?: number
}

export interface DashboardSummaryData {
  jobs: DashboardJobsSummary
  crews: DashboardCrewsSummary
  unassignedJobsList: UnassignedJobItem[]
  unassignedCrewsList: UnassignedCrewItem[]
  laborCost: DashboardLaborCost
  jobsOverBudget: JobOverBudgetItem[]
}

export interface DashboardSummaryResponse {
  success: boolean
  message: string
  data: DashboardSummaryData
}

export async function getDashboardSummary(): Promise<DashboardSummaryResponse> {
  const response = await api.get<DashboardSummaryResponse>('/dashboard/summary')
  return response.data
}
