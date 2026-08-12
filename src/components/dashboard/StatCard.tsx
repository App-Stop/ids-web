import type { ReactNode } from 'react'

export default function StatCard({
  icon,
  label,
  value,
  valueClass,
  sub,
  subClass,
  badge,
}: {
  icon: ReactNode
  label: string
  value: string
  valueClass?: string
  sub: string
  subClass?: string
  badge?: string
}) {
  return (
    <div className="stat-card">
      <div className="stat-card__head">
        <span className="stat-card__icon">{icon}</span>
        <span className="stat-card__label">{label}</span>
       
      </div>
      <div className="stat-card__value-row">
        <span className={`stat-card__value ${valueClass ?? ''}`}>{value}</span>
        {badge && <span className="badge badge--up">{badge}</span>}
      </div>
      <span className={`stat-card__sub ${subClass ?? ''}`}>{sub}</span>
    </div>
  )
}
