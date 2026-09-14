import { useState } from 'react'
import { getApiBaseUrl, hasMixedContentProblem, setApiBaseUrl } from '../api/client'

export function LoginPage({ onLogin }: { onLogin: (password: string) => Promise<boolean> | boolean }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showApiField, setShowApiField] = useState(false)
  const [apiBase, setApiBase] = useState(getApiBaseUrl())
  const mixedContent = hasMixedContentProblem()

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setApiBaseUrl(apiBase)
    const ok = await onLogin(password)
    if (!ok) {
      setError('Invalid password. Please try again.')
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-mark large">R</div>
          <h1>Residency Monitor</h1>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <label htmlFor="password" className="input-label">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
            autoComplete="current-password"
          />
          {error ? <div className="form-error">{error}</div> : null}
          <button type="submit" className="primary-button full-width">Sign In</button>
        </form>

        {/* The same static bundle has to reach whichever backend is running. */}
        <button className="link-button" onClick={() => setShowApiField((v) => !v)}>
          {showApiField ? 'Hide' : 'Change'} backend address
        </button>

        {showApiField ? (
          <div className="login-api-field">
            <label htmlFor="api-base" className="input-label">API base URL</label>
            <input
              id="api-base"
              type="url"
              value={apiBase}
              onChange={(event) => setApiBase(event.target.value)}
              placeholder="https://your-backend.example.com/api/v1"
            />
          </div>
        ) : null}

        {mixedContent ? (
          <div className="form-error">
            This page is served over HTTPS but the backend address is plain HTTP,
            so the browser will block the connection. Use an HTTPS address for
            the backend, or open this app locally.
          </div>
        ) : null}
      </div>
    </div>
  )
}
