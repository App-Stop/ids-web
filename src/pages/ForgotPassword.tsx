import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import BrandLogos from '../components/BrandLogos'
import EmailField, { DOMAIN } from '../components/EmailField'
import { sendPasswordReset } from '../lib/auth'

export default function ForgotPassword() {
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
      navigate('/reset-password')
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
        <h1 className="auth-title">Forgot Password</h1>
        <p className="auth-subtitle">A reset password link will be sent to your email.</p>

        <EmailField value={email} onChange={setEmail} />

        {error && <p className="auth-error">{error}</p>}

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? 'Sending…' : 'Send'}
        </button>
      </form>
    </AuthLayout>
  )
}
