import { type ReactNode } from 'react'
import { MagnifyingGlass, Bell } from '@phosphor-icons/react'

export default function Topbar({ extra }: { extra?: ReactNode } = {}) {
  return (
    <header className="topbar">
      <label className="topbar__search">
        <MagnifyingGlass size={18} weight="regular" />
        <input type="text" placeholder="Search anything..." />
      </label>

      <div className="topbar__actions">
        {extra}

        <button type="button" className="icon-btn icon-btn--bordered" aria-label="Notifications">
          <Bell size={18} weight="regular" />
          <i className="dot-badge" />
        </button>
      </div>
    </header>
  )
}
