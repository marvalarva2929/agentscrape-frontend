import type { AuthSession } from '../api/auth'

const AUTH_KEY = 'residency-monitor-auth'
// The static demo accepts the same passwords as the real deployment.
const PASSWORDS = new Set(['residency', 'change-me', 'change-me-admin'])
// Read-only: the static build has no crawler, so it never offers to start one.
const USER = { name: 'Research User', scope: 'client' as const }

export function mockAuthLogin(payload: { password: string }): AuthSession {
  if (PASSWORDS.has(payload.password)) {
    localStorage.setItem(AUTH_KEY, 'true')
    return { authenticated: true, user: USER }
  }

  return { authenticated: false }
}

export function mockAuthLogout() {
  localStorage.removeItem(AUTH_KEY)
}

export function mockGetSessionStatus(): AuthSession {
  const isAuthenticated = localStorage.getItem(AUTH_KEY) === 'true'
  return isAuthenticated ? { authenticated: true, user: USER } : { authenticated: false }
}
