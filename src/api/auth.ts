import { apiFetch, isMockMode, tokenStore } from './client'
import { mockAuthLogin, mockAuthLogout, mockGetSessionStatus } from '../mocks/auth'

export interface LoginPayload {
  password: string
}

export interface AuthSession {
  authenticated: boolean
  user?: { name: string; scope?: 'client' | 'admin' }
}

interface LoginResponse extends AuthSession {
  token: string
  expires_at: string
}

export const authApi = {
  async login(payload: LoginPayload): Promise<AuthSession> {
    if (isMockMode()) {
      return mockAuthLogin(payload)
    }

    const body = await apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
      anonymous: true,
    })
    tokenStore.set(body.token)
    return { authenticated: body.authenticated, user: body.user }
  },

  async logout(): Promise<void> {
    if (isMockMode()) {
      mockAuthLogout()
      return
    }

    try {
      await apiFetch<void>('/auth/logout', { method: 'POST' })
    } finally {
      // The token is stateless, so dropping it locally is what logs us out.
      tokenStore.clear()
    }
  },

  async getSession(): Promise<AuthSession> {
    if (isMockMode()) {
      return mockGetSessionStatus()
    }

    if (!tokenStore.get()) {
      return { authenticated: false }
    }

    try {
      return await apiFetch<AuthSession>('/auth/session')
    } catch {
      // An expired or rejected token means "show the login screen", not an error.
      tokenStore.clear()
      return { authenticated: false }
    }
  },

  /** True when the current session may reach the staff-only areas. */
  isAdmin(session: AuthSession | null): boolean {
    return session?.user?.scope === 'admin'
  },
}
