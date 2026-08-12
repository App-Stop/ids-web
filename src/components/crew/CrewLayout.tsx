import { NavLink, Outlet } from 'react-router-dom'
import {
  CalendarDots,
  SquaresFour,
  UserCircle,
  UsersThree,
} from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext'
import '../../pages/crew/crew.css'

const TABS = [
  { to: '/crew', label: 'Home', Icon: SquaresFour, end: true },
  { to: '/crew/jobs', label: 'Schedule', Icon: CalendarDots },
  { to: '/crew/crew', label: 'Crew', Icon: UsersThree, leadOnly: true },
  { to: '/crew/profile', label: 'Profile', Icon: UserCircle },
]

export default function CrewLayout() {
  const { role } = useAuth()
  const isLead = role === 'crew-lead'
  const tabs = TABS.filter((tab) => !tab.leadOnly || isLead)

  return (
    <div className="crew-app">
      <main className="crew-main">
        <Outlet />
      </main>

      <nav className="crew-tabbar">
        <div className="crew-tabbar__pill">
          {tabs.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `crew-tab${isActive ? ' is-active' : ''}`}
            >
              <Icon size={24} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
