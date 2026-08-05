import { type ReactNode } from 'react'

export default function Topbar({ extra }: { extra?: ReactNode } = {}) {
  if (!extra) return null

  return (
    <header className="topbar">
      <div className="topbar__actions">{extra}</div>
    </header>
  )
}
