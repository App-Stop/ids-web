import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import BrandLogos from '../components/BrandLogos'
import EmailField, { DOMAIN } from '../components/EmailField'
import { getErrorMessage } from '../lib/errors'
import { useAuth } from '../context/AuthContext'
import { homePathForRole } from '../components/ProtectedRoute'

import PasswordInput from '../components/PasswordInput'

/** Admin-only sign in. Crew-lead / labour use /login. */
export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const {adminLogin} = useAuth()

  async function onSubmit(e : React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const fullEmail = email.includes('@') ? email : `${email.trim()}${DOMAIN}`
      const body = await adminLogin(fullEmail, password)
      navigate(homePathForRole(body.data?.admin?.role ?? 'admin'), { replace: true })
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid email or password'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <form className="auth-card" onSubmit={onSubmit}>
        <BrandLogos />

        <h1 className="auth-title">Sign In</h1>
        <p className="auth-subtitle">Enter your credentials to access your account</p>

        <EmailField value={email} onChange={setEmail} />

        <div className="auth-field">
          <label htmlFor="password">Password</label>
          <PasswordInput
            id="password"
            className="auth-input"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        {error && <p className="auth-error">{error}</p>}

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </AuthLayout>
  )
}
