import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
      // Filter/pagination changes swap the query key; without this the table
      // blanks out on every keystroke instead of dimming the previous page.
      placeholderData: <T,>(previous: T) => previous,
    },
  },
})
