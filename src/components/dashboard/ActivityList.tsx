import { ArrowRight, UserPlus, Check, WarningCircle, Checks } from '@phosphor-icons/react'
import { activity } from '../../lib/dashboardData'

const KIND_ICON = {
  labor: { Icon: ArrowRight, cls: 'activity-icon--info' },
  assigned: { Icon: UserPlus, cls: 'activity-icon--accent' },
  completed: { Icon: Check, cls: 'activity-icon--success' },
  overdue: { Icon: WarningCircle, cls: 'activity-icon--danger' },
}

export default function ActivityList() {
  return (
    <div className="panel">
      <div className="panel__head">
        <h2>Activity</h2>
        <button type="button" className="btn btn--outline btn--sm">
          <Checks size={16} weight="regular" />
          Mark all as seen
        </button>
      </div>

      <ul className="activity-list">
        {activity.map((item) => {
          const { Icon, cls } = KIND_ICON[item.kind]
          return (
            <li key={item.id} className="activity-item">
              <span className={`activity-icon ${cls}`}>
                <Icon size={16} weight="bold" />
              </span>
              <div className="activity-item__body">
                <span className="activity-item__title">{item.title}</span>
                <span className="activity-item__email">{item.email}</span>
              </div>
              <span className="activity-item__date">{item.date}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
