/**
 * Every server-state key in one place so invalidation stays honest: a mutation
 * can invalidate `queryKeys.crews.all` and hit every parameterised crew list
 * without knowing which filters happen to be mounted.
 */
export const queryKeys = {
  dashboardSummary: ['dashboardSummary'] as const,

  crews: {
    all: ['crews'] as const,
    list: (params?: unknown) => ['crews', params ?? null] as const,
    detail: (id: string) => ['crew', id] as const,
  },

  jobs: {
    all: ['jobs'] as const,
    list: (params?: unknown) => ['jobs', params ?? null] as const,
    detail: (id: string) => ['job', id] as const,
    assignments: (jobId: string) => ['crewAssignments', jobId] as const,
  },

  schedule: {
    all: ['schedule'] as const,
    list: (params: unknown) => ['schedule', params] as const,
  },

  dayNotes: {
    all: ['dayNotes'] as const,
    list: (params: unknown) => ['dayNotes', params] as const,
  },

  timeEntries: {
    all: ['timeEntries'] as const,
    list: (params?: unknown) => ['timeEntries', params ?? null] as const,
    laborReport: (params?: unknown) => ['laborReport', params ?? null] as const,
  },

  costTracking: {
    all: ['costTracking'] as const,
    report: (params?: unknown) => ['costTracking', params ?? null] as const,
  },
} as const
