import type { AuthSession } from '../api/auth'

const AUTH_KEY = 'residency-monitor-auth'

export function mockAuthLogin(payload: { password: string }): AuthSession {
  if (payload.password === 'residency') {
    localStorage.setItem(AUTH_KEY, 'true')
    return { authenticated: true, user: { name: 'Research User' } }
  }

  return { authenticated: false }
}

export function mockAuthLogout() {
  localStorage.removeItem(AUTH_KEY)
}

export function mockGetSessionStatus(): AuthSession {
  const isAuthenticated = localStorage.getItem(AUTH_KEY) === 'true'
  return isAuthenticated ? { authenticated: true, user: { name: 'Research User' } } : { authenticated: false }
}
