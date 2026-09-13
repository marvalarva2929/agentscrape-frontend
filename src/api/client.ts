const DEFAULT_API_BASE_URL = 'http://localhost:8000/api/v1'
const TOKEN_STORAGE_KEY = 'agentscrape.token'

// Not named use* : the React hooks lint rule treats that prefix as a hook.
const mockApiEnabled = () => import.meta.env.VITE_USE_MOCK_API === 'true'

export function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL as string | undefined) || DEFAULT_API_BASE_URL
}

/**
 * Bearer token kept in localStorage rather than a session cookie.
 *
 * The app is served from GitHub Pages while the API lives on another origin, so
 * a session cookie would be third-party: it needs SameSite=None and is blocked
 * outright by Safari and increasingly by Chrome. That would work locally and
 * fail in production, which is the worst way for auth to break.
 */
export const tokenStore = {
  get(): string | null {
    try {
      return window.localStorage.getItem(TOKEN_STORAGE_KEY)
    } catch {
      return null
    }
  },
  set(token: string) {
    try {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token)
    } catch {
      /* private browsing: the session simply will not survive a reload */
    }
  },
  clear() {
    try {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY)
    } catch {
      /* nothing to do */
    }
  },
}

export interface RequestOptions extends RequestInit {
  timeoutMs?: number
  /** Skip the Authorization header (login only). */
  anonymous?: boolean
}

export type ApiErrorCode =
  | 'NETWORK'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'UNAVAILABLE'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'UNKNOWN'

export class ApiError extends Error {
  code: ApiErrorCode
  /** The backend's own error code, e.g. K12_INSTITUTION_REJECTED. */
  backendCode?: string
  status?: number
  details?: Record<string, unknown>

  constructor(
    message: string,
    code: ApiErrorCode,
    status?: number,
    details?: Record<string, unknown>,
    backendCode?: string,
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
    this.backendCode = backendCode
  }
}

/** The backend's error envelope: {"error": {code, message, details}}. */
interface ErrorEnvelope {
  error?: { code?: string; message?: string; details?: Record<string, unknown> }
}

const STATUS_TO_CODE: Record<number, ApiErrorCode> = {
  400: 'VALIDATION',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'VALIDATION',
}

async function toApiError(response: Response): Promise<ApiError> {
  let message = ''
  let backendCode: string | undefined
  let details: Record<string, unknown> | undefined

  // Parse the envelope rather than dumping the raw body at the user.
  try {
    const body = (await response.json()) as ErrorEnvelope
    message = body.error?.message ?? ''
    backendCode = body.error?.code
    details = body.error?.details
  } catch {
    message = ''
  }

  const code = STATUS_TO_CODE[response.status] ?? 'UNKNOWN'
  return new ApiError(
    message || `Request failed (${response.status})`,
    code,
    response.status,
    details,
    backendCode,
  )
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (mockApiEnabled()) {
    throw new ApiError('Mock API mode enabled; use the mock adapter layer instead.', 'UNAVAILABLE')
  }

  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? 30000
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)

  const token = options.anonymous ? null : tokenStore.get()
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  }
  // Let the browser set the boundary for multipart uploads.
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }
  if (token) headers.Authorization = `Bearer ${token}`

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    })

    if (!response.ok) {
      const error = await toApiError(response)
      if (error.status === 401) tokenStore.clear()
      throw error
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
    // The server is started on demand and stopped when idle, so an unreachable
    // API is an expected state rather than a bug.
    throw new ApiError('Backend unavailable', 'UNAVAILABLE')
  } finally {
    window.clearTimeout(timer)
  }
}

/** One page of a cursor-paginated list. */
export interface PageResponse<T> {
  items: T[]
  next_cursor: string | null
  has_more: boolean
}

/**
 * Follow the cursor to the end of a list.
 *
 * The backend paginates every list endpoint. Reading only the first page would
 * silently show a partial roster, which looks like missing data rather than
 * missing pagination.
 */
export async function fetchAllPages<T>(
  path: string,
  { pageSize = 200, maxPages = 50 }: { pageSize?: number; maxPages?: number } = {},
): Promise<T[]> {
  const separator = path.includes('?') ? '&' : '?'
  const collected: T[] = []
  let cursor: string | null = null

  for (let page = 0; page < maxPages; page += 1) {
    const query = `${separator}limit=${pageSize}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
    const body: PageResponse<T> = await apiFetch<PageResponse<T>>(`${path}${query}`)
    collected.push(...(body.items ?? []))
    if (!body.has_more || !body.next_cursor) break
    cursor = body.next_cursor
  }

  return collected
}

export function isMockMode() {
  return mockApiEnabled()
}

/** Absolute URL for an artifact link the backend already signed. */
export function artifactUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  const base = getApiBaseUrl().replace(/\/api\/v1$/, '')
  return `${base}${path}`
}
