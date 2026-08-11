import { useAuth } from '../../context/AuthContext'

export default function CrewHome() {
  const { user, role } = useAuth()

  return (
    <>
      <h2 className="crew-greeting">Hi {user?.firstName ?? 'there'}</h2>
      <p className="crew-greeting__sub">
        <span className="crew-role-chip">{role?.replace('-', ' ')}</span>
      </p>

      <h3 className="crew-section-title">Today</h3>
      <div className="crew-card">
        <p className="crew-empty">No jobs assigned for today yet.</p>
      </div>
    </>
  )
}
