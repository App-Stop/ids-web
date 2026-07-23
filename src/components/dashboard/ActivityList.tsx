import { Icon } from './icons'
import { activity } from '../../lib/dashboardData'

const KIND_ICON = {
  labor: { icon: Icon.ArrowRight, cls: 'activity-icon--info' },
  assigned: { icon: Icon.UserPlus, cls: 'activity-icon--accent' },
  completed: { icon: Icon.Check, cls: 'activity-icon--success' },
  overdue: { icon: Icon.AlertCircle, cls: 'activity-icon--danger' },
}

export default function ActivityList() {
  return (
    <div className="panel">
      <div className="panel__head">
        <h2>Activity</h2>
        <button type="button" className="btn btn--outline btn--sm">
          <Icon.CheckDouble width={16} height={16} />
          Mark all as seen
        </button>
      </div>

      <ul className="activity-list">
        {activity.map((item) => {
          const { icon: IconCmp, cls } = KIND_ICON[item.kind]
          return (
            <li key={item.id} className="activity-item">
              <span className={`activity-icon ${cls}`}>
                <IconCmp width={16} height={16} />
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
