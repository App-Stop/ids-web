import { useState } from 'react'
import Modal from './Modal'
import Dropdown from './Dropdown'
import Avatar from './Avatar'
import JobSummaryChip from './JobSummaryChip'
import { crewLeads, type Job } from '../../lib/dashboardData'

export default function AssignCrewModal({
  job,
  onCancel,
  onAssign,
}: {
  job: Job
  onCancel: () => void
  onAssign: (crewLeadId: string, note: string) => void
}) {
  const [leadId, setLeadId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const selected = crewLeads.find((c) => c.id === leadId)

  return (
    <Modal onClose={onCancel}>
      <h2 className="modal-title">Assign Crew</h2>

      <JobSummaryChip job={job} />

      <label className="field-label">Choose Crew Lead</label>
      <Dropdown
        value={leadId}
        placeholder="-"
        onChange={setLeadId}
        selectedLabel={
          selected && (
            <span className="dd__avatar-label">
              <Avatar name={selected.name} size={24} />
              {selected.name} (${selected.rate}/h)
            </span>
          )
        }
        options={crewLeads.map((c) => ({
          id: c.id,
          label: (
            <span className="dd__avatar-label">
              <Avatar name={c.name} size={24} />
              {c.name} (${c.rate}/h)
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
          disabled={!leadId}
          onClick={() => leadId && onAssign(leadId, note)}
        >
          Assign Crew
        </button>
      </div>
    </Modal>
  )
}
