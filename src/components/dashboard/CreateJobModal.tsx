import { useState } from 'react'
import Modal from './Modal'
import Dropdown from './Dropdown'
import Avatar from './Avatar'
import { crewColors, crewLeads, type Job } from '../../lib/dashboardData'

export interface JobFormData {
  name: string
  siteAddress: string
  gc: string
  startDate: string
  endDate: string
  contractAmount: number
  laborBudgetTotal: number
  crewLeadId: string | null
  note: string
  color: string
}

export default function CreateJobModal({
  job,
  onCancel,
  onSubmit,
}: {
  job?: Job
  onCancel: () => void
  onSubmit: (data: JobFormData) => void
}) {
  const isEdit = !!job
  const [name, setName] = useState(job?.name ?? '')
  const [siteAddress, setSiteAddress] = useState('')
  const [gc, setGc] = useState(job?.gc ?? '')
  const [startDate, setStartDate] = useState(job?.startDate ?? '')
  const [endDate, setEndDate] = useState(job?.endDate ?? '')
  const [contractAmount, setContractAmount] = useState(job?.contractAmount ?? 0)
  const [laborBudgetTotal, setLaborBudgetTotal] = useState(job?.laborBudgetTotal ?? 0)
  const [crewLeadId, setCrewLeadId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [color, setColor] = useState(job?.color ?? crewColors[0])

  const selectedLead = crewLeads.find((c) => c.id === crewLeadId)
  const canSubmit = isEdit || Boolean(name.trim() && siteAddress.trim() && gc.trim() && startDate.trim() && endDate.trim())

  function handleSubmit() {
    if (!canSubmit) return
    onSubmit({ name, siteAddress, gc, startDate, endDate, contractAmount, laborBudgetTotal, crewLeadId, note, color })
  }

  return (
    <Modal onClose={onCancel} width={640}>
      <div className="modal-head-row">
        <h2 className="modal-title">{isEdit ? 'Edit Job' : 'Create Job'}</h2>
        {isEdit && (
          <span className="job-head__meta">
            Bid #{job!.bidNo} &middot; Job #{job!.jobNo}
          </span>
        )}
      </div>

      <div className="form-grid">
        <div className="form-col">
          <label className="field-label">Name*</label>
          <input className="field-input" placeholder="Enter Job Name" value={name} onChange={(e) => setName(e.target.value)} />

          <label className="field-label">Site Address*</label>
          <input className="field-input" placeholder="Enter Address" value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} />

          <label className="field-label">General Contractor*</label>
          <input className="field-input" placeholder="Enter GC Name" value={gc} onChange={(e) => setGc(e.target.value)} />

          <div className="field-row">
            <div>
              <label className="field-label">Start Date*</label>
              <input className="field-input" placeholder="MM-DD-YYYY" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="field-label">End Date*</label>
              <input className="field-input" placeholder="MM-DD-YYYY" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="field-row">
            <div>
              <label className="field-label">Contract Amount*</label>
              <div className="field-money">
                <span>$</span>
                <input
                  type="number"
                  value={contractAmount}
                  onChange={(e) => setContractAmount(Number(e.target.value))}
                />
              </div>
            </div>
            <div>
              <label className="field-label">Labor Budget*</label>
              <div className="field-money">
                <span>$</span>
                <input
                  type="number"
                  value={laborBudgetTotal}
                  onChange={(e) => setLaborBudgetTotal(Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="form-col">
          <label className="field-label">Assign Crew Lead</label>
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

          <label className="field-label">Add a note</label>
          <textarea
            className="field-textarea field-textarea--tall"
            placeholder="Note about the job..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

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
        </div>
      </div>

      <div className="modal-actions">
        <button type="button" className="btn btn--outline" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn--primary" disabled={!canSubmit} onClick={handleSubmit}>
          {isEdit ? 'Update Job' : 'Create Job'}
        </button>
      </div>
    </Modal>
  )
}
