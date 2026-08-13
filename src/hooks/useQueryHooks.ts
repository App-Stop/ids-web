import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDashboardSummary } from '../api/dashboardApi'
import {
  getJobs,
  getJobById,
  getSchedule,
  getCrewAssignments,
  createJob,
  updateJob,
  deleteJob,
  createCrewAssignment,
  updateCrewAssignment,
  deleteCrewAssignment,
  type GetJobsParams,
  type GetScheduleParams,
  type JobItem,
  type Pagination,
} from '../api/jobApi'
import {
  getCrewsSummary,
  getCrewById,
  getUserById,
  createCrew,
  updateCrew,
  deleteCrew,
  createUser,
  updateUser,
  deactivateUser,
  softDeleteUser,
  removeCrewMember,
  removeCrewLeadOrMember,
  type GetCrewsSummaryParams,
  type CrewSummaryItem,
} from '../api/crewApi'
import {
  getDayNotes,
  createDayNote,
  updateDayNote,
  deleteDayNote,
  type ListDayNotesParams,
} from '../api/noteApi'
import {
  getTimeEntries,
  getLaborReport,
  createTimesheetLog,
  updateTimeEntry,
  deleteTimeEntry,
  type GetTimeEntriesParams,
  type LaborReportParams,
} from '../api/timeEntryApi'
import {
  getCostTrackingReport,
  createDumpsterCost,
  adjustCost,
  type CostTrackingReportParams,
} from '../api/dumpsterCostApi'
import { queryKeys } from '../lib/queryKeys'

const EMPTY_PAGINATION: Pagination = { page: 1, limit: 20, totalCount: 0, totalPages: 1 }

/** The API wraps every list in { success, data, pagination }. */
function unwrapList<T>(res: { success?: boolean; data?: unknown }): T[] {
  return res.success && Array.isArray(res.data) ? (res.data as T[]) : []
}

// ---------------------------------------------------------------- dashboard

export function useDashboardSummary() {
  return useQuery({
    queryKey: queryKeys.dashboardSummary,
    queryFn: async () => (await getDashboardSummary()).data,
  })
}

// -------------------------------------------------------------------- jobs

/**
 * Jobs as a plain array. Pass the *same* params object shape from every caller
 * (the modals all use `{ limit: 100 }`) so they share one cache entry instead
 * of each opening its own request.
 */
export function useJobsList(params?: GetJobsParams, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.jobs.list(params),
    queryFn: () => getJobs(params),
    select: (res) => unwrapList<JobItem>(res),
    enabled,
  })
}

/** Same cache entry as useJobsList, but keeps the pagination envelope. */
export function useJobsPaged(params?: GetJobsParams, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.jobs.list(params),
    queryFn: () => getJobs(params),
    select: (res) => ({
      items: unwrapList<JobItem>(res),
      pagination: res.pagination ?? EMPTY_PAGINATION,
    }),
    enabled,
  })
}

export function useCrewAssignments(jobId: string | null) {
  return useQuery({
    queryKey: queryKeys.jobs.assignments(jobId ?? ''),
    queryFn: () => getCrewAssignments(jobId!),
    select: (res) => res.data ?? [],
    enabled: Boolean(jobId),
  })
}

// ------------------------------------------------------------------ crews

export function useCrewsSummary(params?: GetCrewsSummaryParams, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.crews.list(params),
    queryFn: () => getCrewsSummary(params),
    select: (res) => unwrapList<CrewSummaryItem>(res),
    enabled,
  })
}

/** Same cache entry as useCrewsSummary, but keeps the pagination envelope. */
export function useCrewsSummaryPaged(params?: GetCrewsSummaryParams, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.crews.list(params),
    queryFn: () => getCrewsSummary(params),
    // Roster rows come back as users, not crews — the shape varies by
    // statusEmployee, so callers narrow it themselves.
    select: (res) => ({
      items: unwrapList<Record<string, unknown>>(res),
      pagination: res.pagination ?? EMPTY_PAGINATION,
    }),
    enabled,
  })
}

export function useCrewDetail(id: string | null) {
  return useQuery({
    queryKey: queryKeys.crews.detail(id ?? ''),
    queryFn: () => getCrewById(id!),
    select: (res) => res.data,
    enabled: Boolean(id),
  })
}

// --------------------------------------------------------------- schedule

export function useScheduleData(params: GetScheduleParams, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.schedule.list(params),
    queryFn: async () => (await getSchedule(params)).data,
    enabled,
  })
}

export function useDayNotesData(params: ListDayNotesParams, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.dayNotes.list(params),
    queryFn: async () => (await getDayNotes(params)).data,
    enabled,
  })
}

// -------------------------------------------------------------- timesheet

export function useTimeEntries(params?: GetTimeEntriesParams, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.timeEntries.list(params),
    queryFn: async () => (await getTimeEntries(params)).data,
    enabled,
  })
}

export function useLaborReport(params?: LaborReportParams, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.timeEntries.laborReport(params),
    queryFn: () => getLaborReport(params),
    enabled,
  })
}

// ---------------------------------------------------------- cost tracking

export function useCostTrackingReport(params?: CostTrackingReportParams, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.costTracking.report(params),
    queryFn: () => getCostTrackingReport(params),
    enabled,
  })
}

/**
 * Imperative reads that still go through the cache. For the modals that hydrate
 * a form inside one effect — they need the data at a point in time, not as a
 * subscription, but there's no reason for them to re-request what a list screen
 * already fetched.
 */
export function useCachedFetchers() {
  const queryClient = useQueryClient()

  return {
    fetchCrewsSummary: (params?: GetCrewsSummaryParams) =>
      queryClient.fetchQuery({
        queryKey: queryKeys.crews.list(params),
        queryFn: () => getCrewsSummary(params),
      }),
    fetchJobs: (params?: GetJobsParams) =>
      queryClient.fetchQuery({
        queryKey: queryKeys.jobs.list(params),
        queryFn: () => getJobs(params),
      }),
    fetchJobById: (id: string) =>
      queryClient.fetchQuery({
        queryKey: queryKeys.jobs.detail(id),
        queryFn: () => getJobById(id),
      }),
    fetchCrewById: (id: string) =>
      queryClient.fetchQuery({
        queryKey: queryKeys.crews.detail(id),
        queryFn: () => getCrewById(id),
      }),
    fetchUserById: (id: string) =>
      queryClient.fetchQuery({
        queryKey: ['user', id],
        queryFn: () => getUserById(id),
      }),
  }
}

// ------------------------------------------------------------- mutations

/**
 * The backend denormalises heavily — assigning a crew to a job moves numbers on
 * the dashboard, the schedule and both crew lists — so writes invalidate the
 * whole server-state surface rather than trying to predict the blast radius.
 */
export function useInvalidateServerState() {
  const queryClient = useQueryClient()

  return {
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.schedule.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary })
      queryClient.invalidateQueries({ queryKey: queryKeys.crews.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dayNotes.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.costTracking.all })
    },
    invalidateJobs: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.schedule.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary })
    },
    invalidateCrews: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crews.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary })
    },
  }
}

export function useJobMutations() {
  const { invalidateAll } = useInvalidateServerState()

  return {
    createJobMutation: useMutation({ mutationFn: createJob, onSuccess: invalidateAll }),
    updateJobMutation: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateJob>[1] }) =>
        updateJob(id, payload),
      onSuccess: invalidateAll,
    }),
    deleteJobMutation: useMutation({ mutationFn: deleteJob, onSuccess: invalidateAll }),
    invalidateAll,
  }
}

export function useCrewAssignmentMutations() {
  const { invalidateAll } = useInvalidateServerState()

  return {
    createAssignmentMutation: useMutation({
      mutationFn: ({ jobId, payload }: { jobId: string; payload: Parameters<typeof createCrewAssignment>[1] }) =>
        createCrewAssignment(jobId, payload),
      onSuccess: invalidateAll,
    }),
    updateAssignmentMutation: useMutation({
      mutationFn: ({
        jobId,
        assignmentId,
        payload,
      }: {
        jobId: string
        assignmentId: string
        payload: Parameters<typeof updateCrewAssignment>[2]
      }) => updateCrewAssignment(jobId, assignmentId, payload),
      onSuccess: invalidateAll,
    }),
    deleteAssignmentMutation: useMutation({
      mutationFn: ({ jobId, assignmentId }: { jobId: string; assignmentId: string }) =>
        deleteCrewAssignment(jobId, assignmentId),
      onSuccess: invalidateAll,
    }),
    invalidateAll,
  }
}

export function useCrewMutations() {
  const { invalidateAll } = useInvalidateServerState()

  return {
    createCrewMutation: useMutation({ mutationFn: createCrew, onSuccess: invalidateAll }),
    updateCrewMutation: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateCrew>[1] }) =>
        updateCrew(id, payload),
      onSuccess: invalidateAll,
    }),
    deleteCrewMutation: useMutation({ mutationFn: deleteCrew, onSuccess: invalidateAll }),
    removeCrewMemberMutation: useMutation({
      mutationFn: ({ crewId, memberId }: { crewId: string; memberId: string }) =>
        removeCrewMember(crewId, memberId),
      onSuccess: invalidateAll,
    }),
    removeCrewLeadOrMemberMutation: useMutation({
      mutationFn: ({
        crewId,
        payload,
      }: {
        crewId: string
        payload: Parameters<typeof removeCrewLeadOrMember>[1]
      }) => removeCrewLeadOrMember(crewId, payload),
      onSuccess: invalidateAll,
    }),
    invalidateAll,
  }
}

export function useUserMutations() {
  const { invalidateAll } = useInvalidateServerState()

  return {
    createUserMutation: useMutation({ mutationFn: createUser, onSuccess: invalidateAll }),
    updateUserMutation: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateUser>[1] }) =>
        updateUser(id, payload),
      onSuccess: invalidateAll,
    }),
    deactivateUserMutation: useMutation({ mutationFn: deactivateUser, onSuccess: invalidateAll }),
    softDeleteUserMutation: useMutation({ mutationFn: softDeleteUser, onSuccess: invalidateAll }),
    invalidateAll,
  }
}

export function useDayNoteMutations() {
  const queryClient = useQueryClient()
  const invalidateNotes = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.dayNotes.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.schedule.all })
  }

  return {
    createNoteMutation: useMutation({ mutationFn: createDayNote, onSuccess: invalidateNotes }),
    updateNoteMutation: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateDayNote>[1] }) =>
        updateDayNote(id, payload),
      onSuccess: invalidateNotes,
    }),
    deleteNoteMutation: useMutation({ mutationFn: deleteDayNote, onSuccess: invalidateNotes }),
    invalidateNotes,
  }
}

export function useTimeEntryMutations() {
  const { invalidateAll } = useInvalidateServerState()

  return {
    createTimeEntryMutation: useMutation({ mutationFn: createTimesheetLog, onSuccess: invalidateAll }),
    updateTimeEntryMutation: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateTimeEntry>[1] }) =>
        updateTimeEntry(id, payload),
      onSuccess: invalidateAll,
    }),
    deleteTimeEntryMutation: useMutation({ mutationFn: deleteTimeEntry, onSuccess: invalidateAll }),
    invalidateAll,
  }
}

export function useCostMutations() {
  const { invalidateAll } = useInvalidateServerState()

  return {
    createDumpsterCostMutation: useMutation({ mutationFn: createDumpsterCost, onSuccess: invalidateAll }),
    adjustCostMutation: useMutation({ mutationFn: adjustCost, onSuccess: invalidateAll }),
    invalidateAll,
  }
}
