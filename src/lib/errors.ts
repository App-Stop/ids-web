import { AxiosError } from 'axios'

interface ApiError {
  success: false
  message: string
}

export function getErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as ApiError | undefined
    if (data?.message) return data.message
    if (!err.response) return 'Cannot reach the server. Check your connection.'
  }
  if (err instanceof Error) return err.message
  return fallback
}
