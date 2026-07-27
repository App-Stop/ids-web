import { useState } from 'react'
import Modal from './Modal'
import Dropdown from './Dropdown'
import Avatar from './Avatar'
import { crewColors, crewLeads, type Job } from '../../lib/dashboardData'

export type CrewStatus = 'active' | 'inactive' | 'unassigned'

const STATUS_OPTIONS: { id: CrewStatus; label: string; color: string }[] = [
  { id: 'active', label: 'Active', color: '#22c55e' },
  { id: 'inactive', label: 'Inactive', color: '#9ca3af' },
  { id: 'unassigned', label: 'Unassigned', color: '#f97316' },
]

export interface CrewFormData {
  crewName: string
  crewLeadId: string
  workers: number
  jobId: string | null
  status: CrewStatus
  color: string
}

export interface EditableCrew {
  name: string
  color: string
  rate: number
}

export default function CreateCrewModal({
  jobs,
  crew,
  onCancel,
  onSubmit,
}: {
  jobs: Job[]
  crew?: EditableCrew
  onCancel: () => void
  onSubmit: (data: CrewFormData) => void
}) {
  const isEdit = !!crew
  const [crewName, setCrewName] = useState(crew?.name ?? '')
  const [crewLeadId, setCrewLeadId] = useState<string | null>(null)
  const [workers, setWorkers] = useState<number>(1)
  const [jobId, setJobId] = useState<string | null>(null)
  const [status, setStatus] = useState<CrewStatus>('active')
  const [color, setColor] = useState(crew?.color ?? crewColors[0])

  const selectedLead = crewLeads.find((c) => c.id === crewLeadId)
  const selectedJob = jobs.find((j) => j.id === jobId)
  const selectedStatus = STATUS_OPTIONS.find((s) => s.id === status)!
  const canSubmit = isEdit ? Boolean(crewName.trim()) : Boolean(crewName.trim() && crewLeadId && workers > 0)

  function handleSubmit() {
    if (!canSubmit) return
    if (!isEdit && !crewLeadId) return
    onSubmit({ crewName, crewLeadId: crewLeadId ?? '', workers, jobId, status, color })
  }

  return (
    <Modal onClose={onCancel}>
      <h2 className="modal-title">{isEdit ? 'Edit Crew' : 'Create New Crew'}</h2>

      <label className="field-label">Crew Name*</label>
      <input className="field-input" placeholder="Enter Crew Name" value={crewName} onChange={(e) => setCrewName(e.target.value)} />

      {!isEdit && (
        <>
          <label className="field-label">Crew Leader*</label>
          <Dropdown
            value={crewLeadId}
            placeholder="-"
            onChange={setCrewLeadId}
            selectedLabel={
              selectedLead && (
                <span className="dd__avatar-label">
                  <Avatar name={selectedLead.name} size={24} />
                  {selectedLead.name} (${selectedLead.rate}/h)
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

          <label className="field-label">Workers*</label>
          <input
            className="field-input"
            type="number"
            min={1}
            value={workers}
            onChange={(e) => setWorkers(Number(e.target.value))}
          />

          <label className="field-label">Assign Job</label>
          <Dropdown
            value={jobId}
            placeholder="-"
            onChange={setJobId}
            selectedLabel={
              selectedJob && (
                <span className="dd__dot-label">
                  <i className="dot" style={{ background: selectedJob.color }} />
                  {selectedJob.name}
                </span>
              )
            }
            options={jobs.map((j) => ({
              id: j.id,
              label: (
                <span className="dd__dot-label">
                  <i className="dot" style={{ background: j.color }} />
                  {j.name}
                </span>
              ),
            }))}
          />

          <label className="field-label">Status</label>
          <Dropdown
            value={status}
            onChange={(id) => setStatus(id as CrewStatus)}
            selectedLabel={
              <span className="dd__dot-label">
                <i className="dot" style={{ background: selectedStatus.color }} />
                {selectedStatus.label}
              </span>
            }
            options={STATUS_OPTIONS.map((s) => ({
              id: s.id,
              label: (
                <span className="dd__dot-label">
                  <i className="dot" style={{ background: s.color }} />
                  {s.label}
                </span>
              ),
            }))}
          />
        </>
      )}

      <label className="field-label">Crew Color</label>
      <div className="color-picker">
        {crewColors.map((c) => (
          <button
            key={c}
            type="button"
            className={`color-swatch ${c === color ? 'is-selected' : ''}`}
            style={{ background: c }}
            onClick={() => setColor(c)}
          />
        ))}
      </div>

      <div className="modal-actions">
        <button type="button" className="btn btn--outline" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn--primary" disabled={!canSubmit} onClick={handleSubmit}>
          {isEdit ? 'Update Crew' : 'Add Crew'}
        </button>
      </div>
    </Modal>
  )
}
