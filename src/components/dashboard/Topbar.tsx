import { useState, type ReactNode } from 'react'
import { MagnifyingGlass, Bell, Plus } from '@phosphor-icons/react'
import NewActionMenu from './NewActionMenu'

export default function Topbar({
  onAddJob,
  onCreateCrew,
  extra,
}: {
  onAddJob: () => void
  onCreateCrew: () => void
  extra?: ReactNode
}) {
  const [menuOpen, setMenuOpen] = useState(false)

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

        <div className="topbar__new-action">
          <button type="button" className="btn btn--primary" onClick={() => setMenuOpen((o) => !o)}>
            <Plus size={16} weight="bold" />
            New Action
          </button>
          {menuOpen && (
            <NewActionMenu
              onClose={() => setMenuOpen(false)}
              onAddJob={() => {
                setMenuOpen(false)
                onAddJob()
              }}
              onCreateCrew={() => {
                setMenuOpen(false)
                onCreateCrew()
              }}
            />
          )}
        </div>
      </div>
    </header>
  )
}
