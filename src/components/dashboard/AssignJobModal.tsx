import { useState } from 'react'
import Modal from './Modal'
import Dropdown from './Dropdown'
import Avatar from './Avatar'
import type { Job, UnassignedCrew } from '../../lib/dashboardData'

export default function AssignJobModal({
  crew,
  date,
  jobs,
  onCancel,
  onAssign,
}: {
  crew: UnassignedCrew
  date: string
  jobs: Job[]
  onCancel: () => void
  onAssign: (jobId: string, note: string) => void
}) {
  const [jobId, setJobId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const selected = jobs.find((j) => j.id === jobId)

  return (
    <Modal onClose={onCancel}>
      <h2 className="modal-title">Assign Job</h2>

      <div className="crew-row">
        <Avatar name={crew.leadName} src={crew.avatar} />
        <span className="crew-row__name">
          {crew.leadName} (${crew.rate}/h)
        </span>
        <span className="crew-row__date">{date}</span>
      </div>

      <label className="field-label">Select a job</label>
      <Dropdown
        value={jobId}
        placeholder="-"
        onChange={setJobId}
        selectedLabel={selected?.name}
        options={jobs.map((j) => ({
          id: j.id,
          label: j.name,
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
          disabled={!jobId}
          onClick={() => jobId && onAssign(jobId, note)}
        >
          Assign Job
        </button>
      </div>
    </Modal>
  )
}
