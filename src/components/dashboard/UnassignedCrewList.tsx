import Avatar from './Avatar'
import type { UnassignedCrew } from '../../lib/dashboardData'

export default function UnassignedCrewList({
  crews,
  onAssignJob,
}: {
  crews: UnassignedCrew[]
  onAssignJob: (crew: UnassignedCrew) => void
}) {
  return (
    <div className="panel">
      <div className="panel__head">
        <h2>Unassigned Crew</h2>
      </div>

      {crews.length === 0 ? (
        <p className="empty-state">All crews are assigned.</p>
      ) : (
        <ul className="unassigned-list">
          {crews.map((crew) => (
            <li key={crew.id} className="unassigned-item">
              <Avatar name={crew.leadName} src={crew.avatar} background={crew.color} />
              <span className="unassigned-item__name">{crew.name}</span>
              <button type="button" className="btn btn--primary
               btn--sm" onClick={() => onAssignJob(crew)}>
                Assign Job
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
