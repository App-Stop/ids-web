import { useRef, useState } from 'react'
import Modal from './Modal'
import Dropdown from './Dropdown'
import Avatar from './Avatar'
import { Icon } from './icons'
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

/** Job dates are stored as MM-DD-YYYY; native date inputs use YYYY-MM-DD. */
function toIsoDate(mdy: string) {
  if (!mdy) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(mdy)) return mdy
  const parts = mdy.split('-')
  if (parts.length !== 3) return ''
  const [mm, dd, yyyy] = parts
  if (!mm || !dd || !yyyy) return ''
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

function toMdyDate(iso: string) {
  if (!iso) return ''
  if (/^\d{2}-\d{2}-\d{4}$/.test(iso)) return iso
  const parts = iso.split('-')
  if (parts.length !== 3) return ''
  const [yyyy, mm, dd] = parts
  return `${mm}-${dd}-${yyyy}`
}

function DatePickerField({
  value,
  onChange,
  placeholder = 'MM-DD-YYYY',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const iso = toIsoDate(value)

  return (
    <div className="field-date">
      <button
        type="button"
        className="field-date__trigger"
        onClick={() => {
          const input = ref.current
          if (!input) return
          if ('showPicker' in input && typeof input.showPicker === 'function') {
            input.showPicker()
          } else {
            input.focus()
            input.click()
          }
        }}
      >
        <span className={value ? undefined : 'field-date__placeholder'}>{value || placeholder}</span>
        <Icon.Calendar width={16} height={16} />
      </button>
      <input
        ref={ref}
        type="date"
        className="field-date__native"
        value={iso}
        onChange={(e) => onChange(toMdyDate(e.target.value))}
      />
    </div>
  )
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
              <DatePickerField value={startDate} onChange={setStartDate} />
            </div>
            <div>
              <label className="field-label">End Date*</label>
              <DatePickerField value={endDate} onChange={setEndDate} />
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
