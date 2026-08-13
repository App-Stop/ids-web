import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import BrandLogos from '../components/BrandLogos'
import { resetPassword } from '../lib/auth'
import PasswordInput from '../components/PasswordInput'

export default function ResetPassword() {
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
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <form className="auth-card" onSubmit={onSubmit}>
        <BrandLogos />
        <h1 className="auth-title">Reset Password</h1>
        <p className="auth-subtitle">Please create a new password.</p>

        <div className="auth-field">
          <label htmlFor="new-password">New Password</label>
          <PasswordInput
            id="new-password"
            className="auth-input"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        <div className="auth-field">
          <label htmlFor="confirm-password">Confirm New Password</label>
          <PasswordInput
            id="confirm-password"
            className="auth-input"
            placeholder="Re-enter your password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        {error && <p className="auth-error">{error}</p>}

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? 'Resetting…' : 'Reset Password'}
        </button>
      </form>
    </AuthLayout>
  )
}
