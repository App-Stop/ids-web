import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { House, ClipboardText, Clock, User, SignOut } from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext'
import '../../pages/crew/crew.css'

const TABS = [
  { to: '/crew', label: 'Home', Icon: House, end: true },
  { to: '/crew/jobs', label: 'Jobs', Icon: ClipboardText },
  { to: '/crew/timesheet', label: 'Hours', Icon: Clock },
  { to: '/crew/profile', label: 'Profile', Icon: User },
]

export default function CrewLayout({ title }: { title?: string }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function onLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="crew-app">
      <header className="crew-topbar">
        <h1 className="crew-topbar__title">
          {title ?? (`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'IDS Demolition')}
        </h1>
        <button type="button" className="crew-topbar__action" onClick={onLogout}>
          <SignOut size={18} />
          Log out
        </button>
      </header>

      <main className="crew-main">
        <Outlet />
      </main>

      <nav className="crew-tabbar">
        {TABS.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `crew-tab${isActive ? ' is-active' : ''}`}
          >
            <span className="crew-tab__icon">
              <Icon size={22} />
            </span>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
