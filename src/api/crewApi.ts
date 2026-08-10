import api from './axiosInstance'

export interface CreateCrewPayload {
  name: string
  crewLead: string
  members: string[]
  crewColor: string
  status: string
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

export async function createCrew(payload: CreateCrewPayload): Promise<CreateCrewResponse> {
  const response = await api.post<CreateCrewResponse>('/crews', payload)
  return response.data
}
