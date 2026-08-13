import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDashboardSummary } from '../api/dashboardApi'
import { getJobs, getSchedule, createJob, updateJob, deleteJob, type GetJobsParams, type GetScheduleParams } from '../api/jobApi'
import { getCrewsSummary, type GetCrewsSummaryParams } from '../api/crewApi'
import { getDayNotes } from '../api/noteApi'

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboardSummary'],
    queryFn: async () => {
      const res = await getDashboardSummary()
      return res.data
    },
  })
}

export function useJobsList(params?: GetJobsParams) {
  return useQuery({
    queryKey: ['jobs', params],
    queryFn: async () => {
      const res = await getJobs(params)
      return res
    },
  })
}

export function useScheduleData(params: GetScheduleParams) {
  return useQuery({
    queryKey: ['schedule', params],
    queryFn: async () => {
      const res = await getSchedule(params)
      return res.data
    },
  })
}

export function useDayNotesData(params: { dateFrom: string; dateTo: string }, enabled: boolean = true) {
  return useQuery({
    queryKey: ['dayNotes', params],
    queryFn: async () => {
      const res = await getDayNotes(params)
      return res.data
    },
    enabled,
  })
}

export function useCrewsSummary(params?: GetCrewsSummaryParams) {
  return useQuery({
    queryKey: ['crews', params],
    queryFn: async () => {
      const res = await getCrewsSummary(params)
      return res.data
    },
  })
}

export function useJobMutations() {
  const queryClient = useQueryClient()

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['jobs'] })
    queryClient.invalidateQueries({ queryKey: ['schedule'] })
    queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] })
    queryClient.invalidateQueries({ queryKey: ['crews'] })
    queryClient.invalidateQueries({ queryKey: ['dayNotes'] })
  }

  const createJobMutation = useMutation({
    mutationFn: createJob,
    onSuccess: invalidateAll,
  })

  const updateJobMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => updateJob(id, payload),
    onSuccess: invalidateAll,
  })

  const deleteJobMutation = useMutation({
    mutationFn: deleteJob,
    onSuccess: invalidateAll,
  })

  return {
    createJobMutation,
    updateJobMutation,
    deleteJobMutation,
    invalidateAll,
  }
}
