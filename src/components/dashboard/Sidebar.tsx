import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import logo from '../../assets/logo.png'
import { Icon } from './icons'

const OPERATIONS = [
  { label: 'Dashboard', icon: Icon.Grid, path: '/dashboard' },
  { label: 'Schedule Board', icon: Icon.Calendar, path: '/schedule-board' },
  { label: 'Jobs Management', icon: Icon.Wrench, path: '/jobs-management' },
  { label: 'Cost Tracking', icon: Icon.Dollar, path: '/cost-tracking' },
]

const MANAGEMENT = [
  { label: 'Crew Management', icon: Icon.Users, path: '/Crew' },
  { label: 'Timesheet', icon: Icon.List, path: '/timesheet' },
]

export default function Sidebar({ active }: { active: string }) {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()

  return (
    <aside className={`sidebar ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="sidebar__brand">
        <img src={logo} alt="IDS Demolition" />
        <button
          type="button"
          className="icon-btn sidebar__collapse-btn"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Icon.Panel width={16} height={16} />
        </button>
      </div>

      <nav>
        {!collapsed && <p className="sidebar__group">Operations</p>}
        {OPERATIONS.map(({ label, icon: IconCmp, path }) => (
          <button
            key={label}
            className={`sidebar__item ${active === label ? 'is-active' : ''}`}
            type="button"
            title={collapsed ? label : undefined}
            onClick={() => path && navigate(path)}
          >
            <IconCmp />
            {!collapsed && label}
          </button>
        ))}

        {!collapsed && <p className="sidebar__group">Management</p>}
        {MANAGEMENT.map(({ label, icon: IconCmp, path }) => (
          <button
            key={label}
            className={`sidebar__item ${active === label ? 'is-active' : ''}`}
            type="button"
            title={collapsed ? label : undefined}
            onClick={() => path && navigate(path)}
          >
            <IconCmp />
            {!collapsed && label}
          </button>
        ))}
      </nav>

      <button type="button" className="sidebar__user sidebar__user--button" onClick={() => navigate('/profile')}>
        <span className="avatar avatar--muted">HY</span>
        {!collapsed && (
          <>
            <div className="sidebar__user-info">
              <strong>Hank Yocum</strong>
              <span>Admin</span>
            </div>
            <Icon.Settings width={16} height={16} />
          </>
        )}
      </button>
    </aside>
  )
}
