import api from './axiosInstance'

/** One sync job's last outcome. Every field is null until it has run. */
export interface SyncRunStatus {
  status: 'success' | 'failed' | null
  lastRunAt: string | null
  /** Instant the last run finished cleanly; a failed run leaves it untouched. */
  lastSuccessAt: string | null
  lastError: string | null
}

/** Fingercheck runs two independent syncs, each on its own interval. */
export interface FingercheckSyncStatus {
  timeEntries: SyncRunStatus
  crewAssignments: SyncRunStatus
}

export type FingercheckSyncKey = keyof FingercheckSyncStatus

export interface FingercheckSyncStatusResponse {
  success: boolean
  message: string
  data: FingercheckSyncStatus
}

export async function getFingercheckSyncStatus(): Promise<FingercheckSyncStatusResponse> {
  const response = await api.get<FingercheckSyncStatusResponse>('/integrations/fingercheck/sync-status')
  return response.data
}
