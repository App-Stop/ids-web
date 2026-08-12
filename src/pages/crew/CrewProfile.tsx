import { useNavigate } from 'react-router-dom'
import { SignOut } from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext'
import { CREW_LOGIN_PATH } from '../../components/ProtectedRoute'

export default function CrewProfile() {
  const { user, role, logout } = useAuth()
  const navigate = useNavigate()

  function onLogout() {
    logout()
    navigate(CREW_LOGIN_PATH, { replace: true })
  }

  return (
    <>
      <h3 className="crew-section-title">Profile</h3>
      <div className="crew-card">
        <p className="crew-greeting" style={{ fontSize: 18 }}>
          {`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || '—'}
        </p>
        <p className="crew-greeting__sub" style={{ marginBottom: 12 }}>
          {user?.email}
        </p>
        <span className="crew-role-chip">{role?.replace('-', ' ')}</span>
      </div>

      <button type="button" className="crew-logout" onClick={onLogout}>
        <SignOut size={18} />
        Log out
      </button>
    </>
  )
}
