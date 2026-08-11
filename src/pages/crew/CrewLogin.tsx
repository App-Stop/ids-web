import React, { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import BrandLogos from '../../components/BrandLogos'
import { getErrorMessage } from '../../lib/errors'
import { useAuth } from '../../context/AuthContext'
import { homePathForRole } from '../../components/ProtectedRoute'
import './crew.css'

/** Shared login for crew-lead and labour. Admins use /admin/login. */
export default function CrewLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const { userLogin, isAuthenticated, role } = useAuth()

  if (isAuthenticated) return <Navigate to={homePathForRole(role)} replace />

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const body = await userLogin(email, password)
      navigate(homePathForRole(body.data?.user?.role ?? body.data?.admin?.role), {
        replace: true,
      })
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid email or password'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="crew-login">
      <form className="crew-login__card" onSubmit={onSubmit}>
        <BrandLogos />

        <h1 className="crew-login__title">Sign In</h1>
        <p className="crew-login__subtitle">Crew access to your jobs and hours</p>

        <div className="crew-field">
          <label htmlFor="crew-email">Email</label>
          <input
            id="crew-email"
            type="email"
            inputMode="email"
            className="crew-input"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            required
          />
        </div>

        <div className="crew-field">
          <label htmlFor="crew-password">Password</label>
          <input
            id="crew-password"
            type="password"
            className="crew-input"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        {error && <p className="crew-error">{error}</p>}

        <button className="crew-submit" type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>

        <p className="crew-login__alt">
          <Link to="/forgot-password">Forgot password?</Link>
        </p>
        <p className="crew-login__alt">
          Office staff? <Link to="/admin/login">Admin sign in</Link>
        </p>
      </form>
    </div>
  )
}
