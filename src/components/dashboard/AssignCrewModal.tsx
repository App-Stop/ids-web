import { useState } from 'react'
import Modal from './Modal'
import Dropdown from './Dropdown'
import Avatar from './Avatar'
import { assignableCrews, type Job } from '../../lib/dashboardData'

export default function AssignCrewModal({
  job,
  onCancel,
  onAssign,
}: {
  job: Job
  onCancel: () => void
  onAssign: (crewLeadId: string, note: string) => void
}) {
  const [crewId, setCrewId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const selected = assignableCrews.find((c) => c.id === crewId)

  return (
    <Modal onClose={onCancel} width={420}>
      <h2 className="modal-title">Assign Crew</h2>
      <p className="job-head__meta" style={{ marginTop: '0.15rem' }}>
        Bid #{job.bidNo} &middot; Job #{job.jobNo}
      </p>
      <p className="assign-crew__job-name">{job.name}</p>

      <label className="field-label">Assign Crew</label>
      <Dropdown
        value={crewId}
        placeholder="-"
        onChange={setCrewId}
        selectedLabel={
          selected && (
            <span className="dd__crew-label">
              <Avatar name={selected.leadName} src={selected.avatar} size={24} />
              <span className="dd__crew-label__text">
                {selected.name} (${selected.rate}/h)
              </span>
              <i className="dot" style={{ background: selected.color }} />
            </span>
          )
        }
        options={assignableCrews.map((c) => ({
          id: c.id,
          label: (
            <span className="dd__crew-label">
              <Avatar name={c.leadName} src={c.avatar} size={24} />
              <span className="dd__crew-label__text">{c.name}</span>
              <i className="dot" style={{ background: c.color }} />
            </span>
          ),
        }))}
      />

      <label className="field-label">Add a note</label>
      <textarea
        className="field-textarea"
        placeholder="Note about the job..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <div className="modal-actions">
        <button type="button" className="btn btn--outline" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!crewId}
          onClick={() => crewId && onAssign(crewId, note)}
        >
          Assign Crew
        </button>
      </div>
    </Modal>
  )
}
