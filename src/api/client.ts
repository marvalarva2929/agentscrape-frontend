const DEFAULT_API_BASE_URL = 'http://localhost:3000/api/v1'

const useMockApi = () => import.meta.env.VITE_USE_MOCK_API === 'true'

export function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL as string | undefined) || DEFAULT_API_BASE_URL
}

export interface RequestOptions extends RequestInit {
  timeoutMs?: number
}

export class ApiError extends Error {
  code: 'NETWORK' | 'UNAUTHORIZED' | 'NOT_FOUND' | 'UNAVAILABLE' | 'VALIDATION' | 'UNKNOWN'
  status?: number
  details?: Record<string, unknown>

  constructor(message: string, code: ApiError['code'], status?: number, details?: Record<string, unknown>) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (useMockApi()) {
    throw new ApiError('Mock API mode enabled; use the mock adapter layer instead.', 'UNAVAILABLE')
  }

  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? 15000

  const timer = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
      signal: controller.signal,
    })

    if (response.status === 401) {
      throw new ApiError('Unauthorized', 'UNAUTHORIZED', response.status)
    }

    if (!response.ok) {
      const message = await response.text()
      throw new ApiError(message || 'Request failed', 'UNKNOWN', response.status)
    }

    if (response.status === 204) {
      return undefined as T
    }

    return (await response.json()) as T
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('Request timed out', 'NETWORK')
    }

    if (error instanceof ApiError) {
      throw error
    }

    throw new ApiError('Backend unavailable', 'UNAVAILABLE')
  } finally {
    window.clearTimeout(timer)
  }
}

export function isMockMode() {
  return useMockApi()
}
