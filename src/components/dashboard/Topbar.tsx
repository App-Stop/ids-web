import { useState, type ReactNode } from 'react'
import { Icon } from './icons'
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
        <Icon.Search />
        <input type="text" placeholder="Search anything..." />
      </label>

      <div className="topbar__actions">
        {extra}

        <button type="button" className="icon-btn icon-btn--bordered">
          <Icon.Bell />
          <i className="dot-badge" />
        </button>

        <div className="topbar__new-action">
          <button type="button" className="btn btn--primary" onClick={() => setMenuOpen((o) => !o)}>
            <Icon.Plus width={16} height={16} />
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
