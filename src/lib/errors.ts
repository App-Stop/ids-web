import { AxiosError } from 'axios'

export interface ApiFieldError {
  path: string
  message: string
}

export interface ApiErrorResponse {
  success?: boolean
  message?: string
  error?: ApiFieldError[]
}

export function getErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as ApiErrorResponse | undefined
    if (data) {
      if (Array.isArray(data.error) && data.error.length > 0) {
        const fieldErrors = data.error
          .map((e) => {
            const field = e.path ? e.path.replace(/^(body|query|params)\./, '') : ''
            return field ? `${field}: ${e.message}` : e.message
          })
          .filter(Boolean)

        if (fieldErrors.length > 0) {
          return fieldErrors.join(' | ')
        }
      }
      if (data.message) return data.message
    }
    if (!err.response) return 'Cannot reach the server. Check your connection.'
  }

  if (err && typeof err === 'object' && 'response' in err) {
    const data = (err as any).response?.data as ApiErrorResponse | undefined
    if (data) {
      if (Array.isArray(data.error) && data.error.length > 0) {
        const fieldErrors = data.error
          .map((e) => {
            const field = e.path ? e.path.replace(/^(body|query|params)\./, '') : ''
            return field ? `${field}: ${e.message}` : e.message
          })
          .filter(Boolean)

        if (fieldErrors.length > 0) {
          return fieldErrors.join(' | ')
        }
      }
      if (data.message) return data.message
    }
  }

  if (err instanceof Error) return err.message
  return fallback
}
