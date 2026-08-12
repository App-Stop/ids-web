import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import logo from '../../assets/logo.png'
import caretLeft from '../../assets/caret-left.svg'
import { sendPasswordReset } from '../../lib/auth'
import { DOMAIN } from '../../components/EmailField'
import './crew-auth.css'

/** Crew password reset request. Admins use /forgot-password. */
export default function CrewForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await sendPasswordReset(email + DOMAIN)
      navigate('/login/reset-password')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="cauth cauth-page">
      <button
        type="button"
        className="cauth-back"
        onClick={() => navigate(-1)}
        aria-label="Go back"
      >
        <img src={caretLeft} alt="" />
      </button>

      <form className="cauth-form" onSubmit={onSubmit}>
        <div className="cauth-logo">
          <img src={logo} alt="DSI Concrete Cutting · IDS Demolition" />
        </div>

        <div className="cauth-heading">
          <h1 className="cauth-title">Forgot Password</h1>
          <p className="cauth-subtitle">
            A reset password link will be sent to your email.
          </p>
        </div>

        <div className="cauth-fields">
          <div className="cauth-field">
            <label htmlFor="crew-reset-email">Email address</label>
            <div className="cauth-email">
              <input
                id="crew-reset-email"
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
        </div>

        {error && <p className="cauth-error">{error}</p>}

        <div className="cauth-spacer" />

        <button className="cauth-submit" type="submit" disabled={loading}>
          {loading ? 'Sending…' : 'Send'}
        </button>
      </form>
    </div>
  )
}
