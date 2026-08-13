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

export interface ParsedApiErrors {
  generalMessage: string
  fieldErrors: Record<string, string>
}

export function parseApiErrors(err: unknown, fallback = 'Something went wrong. Please try again.'): ParsedApiErrors {
  const fieldErrors: Record<string, string> = {}
  let generalMessage = ''

  if (err instanceof AxiosError || (err && typeof err === 'object' && 'response' in err)) {
    const data = (err as any).response?.data as ApiErrorResponse | undefined
    if (data) {
      if (data.message && data.message !== 'Unprocessable Entity') {
        generalMessage = data.message
      }
      if (Array.isArray(data.error) && data.error.length > 0) {
        data.error.forEach((e) => {
          if (e.path) {
            const rawField = e.path
              .replace(/^(body|query|params)\./, '')
              .replace(/^crewAssignment\./, 'crewAssignment.')
            fieldErrors[rawField] = e.message
          } else if (e.message && !generalMessage) {
            generalMessage = e.message
          }
        })
      }
    } else if (!(err as any).response) {
      generalMessage = 'Cannot reach the server. Check your connection.'
    }
  } else if (err instanceof Error) {
    generalMessage = err.message
  }

  if (!generalMessage && Object.keys(fieldErrors).length === 0) {
    generalMessage = fallback
  }

  return { generalMessage, fieldErrors }
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
