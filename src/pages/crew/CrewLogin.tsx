import React, { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import logo from '../../assets/logo.png'
import { getErrorMessage } from '../../lib/errors'
import { useAuth } from '../../context/AuthContext'
import { homePathForRole, ADMIN_LOGIN_PATH } from '../../components/ProtectedRoute'
import { DOMAIN } from '../../components/EmailField'
import './crew-auth.css'

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
      const fullEmail = email.includes('@') ? email : `${email.trim()}${DOMAIN}`
      const body = await userLogin(fullEmail, password)
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
    <div className="cauth cauth-page">
      <form className="cauth-form" onSubmit={onSubmit}>
        <div className="cauth-logo">
          <img src={logo} alt="DSI Concrete Cutting · IDS Demolition" />
        </div>

        <div className="cauth-heading">
          <h1 className="cauth-title">Sign In</h1>
          <p className="cauth-subtitle">
            Enter your credentials to access your account
          </p>
        </div>

        <div className="cauth-fields">
          <div className="cauth-field">
            <label htmlFor="crew-email">Email address</label>
            <div className="cauth-email">
              <input
                id="crew-email"
                type="text"
                placeholder="yourname"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                required
              />
              <span>{DOMAIN}</span>
            </div>
          </div>

          <div className="cauth-field">
            <label htmlFor="crew-password">Password</label>
            <input
              id="crew-password"
              type="password"
              className="cauth-input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <Link to="/login/forgot-password" className="cauth-forgot">
              Forgot Password
            </Link>
          </div>
        </div>

        {error && <p className="cauth-error">{error}</p>}

        <div className="cauth-spacer" />

        <Link to={ADMIN_LOGIN_PATH} className="cauth-alt">
          Login as Admin
        </Link>

        <button className="cauth-submit" type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}
