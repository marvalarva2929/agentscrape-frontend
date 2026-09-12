import { useState } from 'react'

export function LoginPage({ onLogin }: { onLogin: (password: string) => Promise<boolean> | boolean }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
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
      </div>
    </div>
  )
}
