import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import logo from '../../assets/logo.png'
import { resetPassword } from '../../lib/auth'
import { CREW_LOGIN_PATH } from '../../components/ProtectedRoute'
import './crew-auth.css'

/** Crew new-password screen. Admins use /reset-password. */
export default function CrewResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await resetPassword(password)
      navigate(CREW_LOGIN_PATH)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
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
          <h1 className="cauth-title">Reset Password</h1>
          <p className="cauth-subtitle">Please create a new password.</p>
        </div>

        <div className="cauth-fields">
          <div className="cauth-field">
            <label htmlFor="crew-new-password">New Password</label>
            <input
              id="crew-new-password"
              type="password"
              className="cauth-input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="cauth-field">
            <label htmlFor="crew-confirm-password">Confirm New Password</label>
            <input
              id="crew-confirm-password"
              type="password"
              className="cauth-input"
              placeholder="Re-enter your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
        </div>

        {error && <p className="cauth-error">{error}</p>}

        <div className="cauth-spacer" />

        <button className="cauth-submit" type="submit" disabled={loading}>
          {loading ? 'Resetting…' : 'Reset Password'}
        </button>
      </form>
    </div>
  )
}
