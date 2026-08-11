import { useAuth } from '../../context/AuthContext'

export default function CrewProfile() {
  const { user, role } = useAuth()

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
    </>
  )
}
