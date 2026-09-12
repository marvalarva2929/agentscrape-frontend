import { isMockMode } from './client'
import { mockAuthLogin, mockAuthLogout, mockGetSessionStatus } from '../mocks/auth'

export interface LoginPayload {
  password: string
}

export interface AuthSession {
  authenticated: boolean
  user?: { name: string }
}

export const authApi = {
  async login(payload: LoginPayload): Promise<AuthSession> {
    if (isMockMode()) {
      return mockAuthLogin(payload)
    }

    throw new Error('Real auth backend not yet connected')
  },

  async logout(): Promise<void> {
    if (isMockMode()) {
      mockAuthLogout()
      return
    }

    throw new Error('Real auth backend not yet connected')
  },

  async getSession(): Promise<AuthSession> {
    if (isMockMode()) {
      return mockGetSessionStatus()
    }

    throw new Error('Real auth backend not yet connected')
  },
}
