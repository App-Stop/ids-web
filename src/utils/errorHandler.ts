export interface ApiFieldError {
  path: string
  message: string
}

export interface ApiErrorResponse {
  success?: boolean
  message?: string
  error?: ApiFieldError[]
}

/**
  * Formats backend error objects structured like:
  * {
  *   "success": false,
  *   "message": "Unprocessable Entity",
  *   "error": [
  *     { "path": "body.assignCrew", "message": "Invalid input: expected string, received null" }
  *   ]
  * }
  */
export function parseErrorMessage(err: any, defaultFallback = 'An error occurred. Please try again.'): string {
  if (!err) return defaultFallback

  const responseData: ApiErrorResponse | undefined = err.response?.data || err.data

  if (responseData) {
    if (Array.isArray(responseData.error) && responseData.error.length > 0) {
      const fieldErrors = responseData.error
        .map((e) => {
          const field = e.path ? e.path.replace(/^(body|query|params)\./, '') : ''
          return field ? `${field}: ${e.message}` : e.message
        })
        .filter(Boolean)

      if (fieldErrors.length > 0) {
        return fieldErrors.join(' | ')
      }
    }

    if (responseData.message) {
      return responseData.message
    }
  }

  return err.message || defaultFallback
}
