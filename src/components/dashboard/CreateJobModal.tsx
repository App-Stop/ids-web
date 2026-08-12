import { useEffect, useRef, useState } from 'react'
import Modal from './Modal'
import Dropdown from './Dropdown'
import Avatar from './Avatar'
import { Icon } from './icons'
import { crewColors, type Job } from '../../lib/dashboardData'
import { createJob, updateJob, getJobById, createCrewAssignment, type CreateJobPayload, type UpdateJobPayload, type JobItem } from '../../api/jobApi'
import { getCrewsSummary, type UserItem } from '../../api/crewApi'
import { parseApiErrors } from '../../lib/errors'

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

interface AvailableCrewItem {
  id: string
  name: string
  leadName: string
  rate: number
  color: string
  avatar?: string
}

export default function CreateJobModal({
  job,
  presetJobs,
  onCancel,
  onSubmit,
}: {
  job?: Job
  /** Existing sheet jobs — picking one prefills the create form. */
  presetJobs?: Job[]
  onCancel: () => void
  onSubmit: (data: JobFormData, apiJob?: JobItem) => void
}) {
  const isEdit = !!job
  const [jobIdNumber, setJobIdNumber] = useState<number | ''>('')
  const [name, setName] = useState(job?.name ?? '')
  const [siteAddress, setSiteAddress] = useState('')
  const [gc, setGc] = useState(job?.gc ?? '')
  const [gcSuper, setGcSuper] = useState('')
  const [idsSuper, setIdsSuper] = useState('')
  const [startDate, setStartDate] = useState(job?.startDate ?? '')
  const [endDate, setEndDate] = useState(job?.endDate ?? '')
  const [contractAmount, setContractAmount] = useState<number | ''>(job?.contractAmount ?? '')
  const [laborBudgetTotal, setLaborBudgetTotal] = useState<number | ''>(job?.laborBudgetTotal ?? '')
  const [crewLeadId, setCrewLeadId] = useState<string | null>(null)
  const [note, setNote] = useState<string>('')

  const [assignCrewNow, setAssignCrewNow] = useState(false)
  const [assignStartDate, setAssignStartDate] = useState<string>(toMdyDate(new Date().toISOString().slice(0, 10)))
  const [assignEndDate, setAssignEndDate] = useState<string>('')
  const [presetId, setPresetId] = useState<string>('')
  const [availableCrews, setAvailableCrews] = useState<AvailableCrewItem[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const color = job?.color ?? crewColors[0]

  useEffect(() => {
    async function loadData() {
      try {
        const crewsRes = await getCrewsSummary()
        if (crewsRes.success && Array.isArray(crewsRes.data)) {
          const crews: AvailableCrewItem[] = crewsRes.data.map((c) => {
            const leadObj = typeof c.crewLead === 'object' && c.crewLead !== null ? (c.crewLead as UserItem) : null
            const leadName = leadObj ? `${leadObj.firstName || ''} ${leadObj.lastName || ''}`.trim() : c.name
            return {
              id: c._id,
              name: c.name,
              leadName: leadName || c.name,
              rate: leadObj?.hourlyRate ?? 0,
              color: c.crewColor || '#3b82f6',
              avatar: `https://i.pravatar.cc/64?img=${(c._id.charCodeAt(0) || 5) % 70}`,
            }
          })
          setAvailableCrews(crews)
        }

        if (isEdit && job?.id) {
          const jobRes = await getJobById(job.id)
          if (jobRes && jobRes.success && jobRes.data) {
            const j = jobRes.data
            if (j.jobIdNumber !== undefined && j.jobIdNumber !== null) setJobIdNumber(j.jobIdNumber)
            setName(j.name || '')
            setSiteAddress(j.siteAddress || '')
            setGc(j.generalContractor || '')
            if (j.gcSuper) setGcSuper(j.gcSuper)
            if (j.idsSuper) {
              if (typeof j.idsSuper === 'object' && j.idsSuper !== null) {
                setIdsSuper(`${j.idsSuper.firstName || ''} ${j.idsSuper.lastName || ''}`.trim())
              } else if (typeof j.idsSuper === 'string') {
                setIdsSuper(j.idsSuper)
              }
            }
            if (j.startDate) setStartDate(toMdyDate(j.startDate.slice(0, 10)))
            if (j.endDate) setEndDate(toMdyDate(j.endDate.slice(0, 10)))
            setContractAmount(j.contractAmount !== undefined && j.contractAmount !== null ? j.contractAmount : '')
            setLaborBudgetTotal(j.laborBudget !== undefined && j.laborBudget !== null ? j.laborBudget : '')
            if (j.note) setNote(j.note)
            const assignedCrew = j.assignToCrew ? (typeof j.assignToCrew === 'object' ? j.assignToCrew._id : j.assignToCrew) : null
            setCrewLeadId(assignedCrew)
          }
        }
      } catch (err) {
        console.error('Failed to fetch modal details:', err)
      }
    }

    loadData()
  }, [isEdit, job?.id])

  const selectedCrew = availableCrews.find((c) => c.id === crewLeadId)
  const canSubmit = !isSubmitting

  function applyPreset(id: string) {
    setPresetId(id)
    const preset = presetJobs?.find((j) => j.id === id)
    if (!preset) return
    setName(preset.name)
    setGc(preset.gc)
    setStartDate(preset.startDate)
    setEndDate(preset.endDate)
    setContractAmount(preset.contractAmount)
    setLaborBudgetTotal(preset.laborBudgetTotal)
    setSiteAddress(preset.name)
  }

  async function handleSubmit() {
    setApiError('')
    setFieldErrors({})
    setIsSubmitting(true)

    const contractVal = contractAmount !== '' ? Number(contractAmount) : undefined
    const laborVal = laborBudgetTotal !== '' ? Number(laborBudgetTotal) : undefined

    const formData: JobFormData = {
      name,
      siteAddress,
      gc,
      startDate,
      endDate,
      contractAmount: contractVal ?? 0,
      laborBudgetTotal: laborVal ?? 0,
      crewLeadId,
      note,
      color: selectedCrew?.color ?? color,
    }

    try {
      if (!isEdit) {
        const payload: CreateJobPayload = {
          jobIdNumber: jobIdNumber !== '' ? Number(jobIdNumber) : undefined,
          name: name.trim(),
          generalContractor: gc.trim(),
          gcSuper: gcSuper.trim() || undefined,
          idsSuper: idsSuper.trim() || undefined,
          siteAddress: siteAddress.trim(),
          startDate: toIsoDate(startDate) || undefined,
          endDate: toIsoDate(endDate) || undefined,
          contractAmount: contractVal as any,
          laborBudget: laborVal as any,
          note: note.trim() || undefined,
          status: 'awarded',
        }
        const res = await createJob(payload)
        const createdJobId = res.data._id
        if (assignCrewNow && crewLeadId && createdJobId) {
          try {
            await createCrewAssignment(createdJobId, {
              crewId: crewLeadId,
              startDate: toIsoDate(assignStartDate) || toIsoDate(startDate) || new Date().toISOString().slice(0, 10),
              endDate: toIsoDate(assignEndDate) || undefined,
              note: note.trim() || undefined,
            })
          } catch (assignErr: any) {
            console.error('Failed to post crew assignment:', assignErr)
            const parsedAssign = parseApiErrors(assignErr, 'Job was created, but crew assignment failed.')
            setApiError(parsedAssign.generalMessage)
            setFieldErrors(parsedAssign.fieldErrors)
            return
          }
        }
        onSubmit(formData, res.data)
      } else {
        if (!job?.id) return
        const patchPayload: UpdateJobPayload = {
          jobIdNumber: jobIdNumber !== '' ? Number(jobIdNumber) : undefined,
          name: name.trim(),
          generalContractor: gc.trim(),
          gcSuper: gcSuper.trim() || null,
          idsSuper: idsSuper.trim() || null,
          siteAddress: siteAddress.trim(),
          startDate: toIsoDate(startDate) || undefined,
          endDate: toIsoDate(endDate) || undefined,
          contractAmount: contractVal as any,
          laborBudget: laborVal as any,
          note: note.trim() || undefined,
        }
        const res = await updateJob(job.id, patchPayload)
        if (assignCrewNow && crewLeadId && job.id) {
          try {
            await createCrewAssignment(job.id, {
              crewId: crewLeadId,
              startDate: toIsoDate(assignStartDate) || toIsoDate(startDate) || new Date().toISOString().slice(0, 10),
              endDate: toIsoDate(assignEndDate) || undefined,
              note: note.trim() || undefined,
            })
          } catch (assignErr: any) {
            console.error('Failed to post crew assignment:', assignErr)
            const parsedAssign = parseApiErrors(assignErr, 'Job was updated, but crew assignment failed.')
            setApiError(parsedAssign.generalMessage)
            setFieldErrors(parsedAssign.fieldErrors)
            return
          }
        }
        onSubmit(formData, res.data)
      }
    } catch (err: any) {
      const parsed = parseApiErrors(err, `Failed to ${isEdit ? 'update' : 'create'} job. Please check inputs and try again.`)
      setApiError(parsed.generalMessage)
      setFieldErrors(parsed.fieldErrors)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal onClose={onCancel} width={980}>
      <div className="job-form-modal">
        <div className="modal-head-row job-form-modal__head">
          <h2 className="modal-title">{isEdit ? 'Edit Job' : 'Create Job'}</h2>
          {isEdit && (
            <span className="job-head__meta job-form-modal__meta">
              Bid #{job!.bidNo} &middot; Job #{job!.jobNo}
            </span>
          )}
        </div>

        {apiError && (
          <div className="form-error-alert">
            <Icon.AlertCircle width={18} height={18} />
            <span>{apiError}</span>
          </div>
        )}

        <div className="job-form-modal__grid">
          <div className="job-form-modal__main">
            {!isEdit && presetJobs && presetJobs.length > 0 && (
              <>
                <label className="field-label">Select Job from Sheet</label>
                <Dropdown
                  value={presetId}
                  placeholder="Choose a job to populate fields"
                  onChange={applyPreset}
                  selectedLabel={presetJobs.find((j) => j.id === presetId)?.name}
                  options={presetJobs.map((j) => ({
                    id: j.id,
                    label: j.name,
                  }))}
                />
              </>
            )}

            <div className="field-row">
              <div style={{ flex: '0 0 140px' }}>
                <label className="field-label">Job ID Number <span style={{ color: '#9ca3af', fontWeight: 400 }}>(Optional)</span></label>
                <input
                  type="number"
                  className={`field-input${fieldErrors.jobIdNumber ? ' field-input--error' : ''}`}
                  placeholder="Auto / #1"
                  value={jobIdNumber}
                  onChange={(e) => setJobIdNumber(e.target.value === '' ? '' : Number(e.target.value))}
                />
                {fieldErrors.jobIdNumber && <span className="field-error-text">{fieldErrors.jobIdNumber}</span>}
              </div>
              <div style={{ flex: 1 }}>
                <label className="field-label">Name*</label>
                <input
                  className={`field-input${fieldErrors.name ? ' field-input--error' : ''}`}
                  placeholder="Enter Job Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {fieldErrors.name && <span className="field-error-text">{fieldErrors.name}</span>}
              </div>
            </div>

            <label className="field-label">Site Address*</label>
            <input
              className={`field-input${fieldErrors.siteAddress ? ' field-input--error' : ''}`}
              placeholder="Enter Address"
              value={siteAddress}
              onChange={(e) => setSiteAddress(e.target.value)}
            />
            {fieldErrors.siteAddress && <span className="field-error-text">{fieldErrors.siteAddress}</span>}

            <label className="field-label">General Contractor*</label>
            <input
              className={`field-input${fieldErrors.generalContractor || fieldErrors.gc ? ' field-input--error' : ''}`}
              placeholder="Enter GC Name"
              value={gc}
              onChange={(e) => setGc(e.target.value)}
            />
            {(fieldErrors.generalContractor || fieldErrors.gc) && (
              <span className="field-error-text">{fieldErrors.generalContractor || fieldErrors.gc}</span>
            )}

            <div className="field-row">
              <div style={{ flex: 1 }}>
                <label className="field-label">GC Super <span style={{ color: '#000', fontWeight: 400 }}>*</span></label>
                <input
                  className={`field-input${fieldErrors.gcSuper ? ' field-input--error' : ''}`}
                  placeholder="General Contractor Superintendent"
                  value={gcSuper}
                  onChange={(e) => setGcSuper(e.target.value)}
                />
                {fieldErrors.gcSuper && <span className="field-error-text">{fieldErrors.gcSuper}</span>}
              </div>
              <div style={{ flex: 1 }}>
                <label className="field-label">IDS Super <span style={{ color: '#000', fontWeight: 400 }}>*</span></label>
                <input
                  className={`field-input${fieldErrors.idsSuper ? ' field-input--error' : ''}`}
                  placeholder="IDS Superintendent Name"
                  value={idsSuper}
                  onChange={(e) => setIdsSuper(e.target.value)}
                />
                {fieldErrors.idsSuper && <span className="field-error-text">{fieldErrors.idsSuper}</span>}
              </div>
            </div>

            <div className="field-row job-form-modal__date-row">
              <div className={fieldErrors.startDate ? 'field-date--error' : ''}>
                <label className="field-label">Start Date*</label>
                <DatePickerField value={startDate} onChange={setStartDate} />
                {fieldErrors.startDate && <span className="field-error-text">{fieldErrors.startDate}</span>}
              </div>
              <div className={fieldErrors.endDate ? 'field-date--error' : ''}>
                <label className="field-label">End Date <span style={{ color: '#9ca3af', fontWeight: 400 }}>(Optional)</span></label>
                <DatePickerField value={endDate} onChange={setEndDate} />
                {fieldErrors.endDate && <span className="field-error-text">{fieldErrors.endDate}</span>}
              </div>
            </div>

            <div className="field-row job-form-modal__money-row">
              <div>
                <label className="field-label">Contract Amount*</label>
                <div className={`field-money${fieldErrors.contractAmount ? ' field-money--error' : ''}`}>
                  <span>$</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={contractAmount}
                    onChange={(e) => setContractAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
                {fieldErrors.contractAmount && <span className="field-error-text">{fieldErrors.contractAmount}</span>}
              </div>
              <div>
                <label className="field-label">Labor Budget*</label>
                <div className={`field-money${fieldErrors.laborBudget ? ' field-money--error' : ''}`}>
                  <span>$</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={laborBudgetTotal}
                    onChange={(e) => setLaborBudgetTotal(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
                {fieldErrors.laborBudget && <span className="field-error-text">{fieldErrors.laborBudget}</span>}
              </div>
            </div>
          </div>

          <div className="job-form-modal__side">
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={assignCrewNow}
                  onChange={(e) => setAssignCrewNow(e.target.checked)}
                />
                <span>Assign crew now</span>
              </label>
            </div>

            {assignCrewNow && (
              <>
                <label className="field-label">Assign Crew*</label>
                <Dropdown
                  value={crewLeadId ?? ''}
                  placeholder="Select crew"
                  onChange={(id) => setCrewLeadId(id || null)}
                  selectedLabel={
                    selectedCrew && (
                      <span className="dd__avatar-label">
                        <Avatar name={selectedCrew.name} src={selectedCrew.avatar} size={24} />
                        {selectedCrew.name}
                      </span>
                    )
                  }
                  options={[
                    { id: '', label: 'None' },
                    ...availableCrews.map((c) => ({
                      id: c.id,
                      label: (
                        <span className="dd__crew-label">
                          <Avatar name={c.leadName} src={c.avatar} size={24} />
                          <span className="dd__crew-label__text">{c.name}</span>
                          <i className="dot" style={{ background: c.color }} />
                        </span>
                      ),
                    })),
                  ]}
                />

                <div className="field-row" style={{ marginTop: '12px' }}>
                  <div>
                    <label className="field-label">Assignment Start Date*</label>
                    <DatePickerField value={assignStartDate} onChange={setAssignStartDate} />
                  </div>
                  <div>
                    <label className="field-label">Assignment End Date</label>
                    <DatePickerField value={assignEndDate} onChange={setAssignEndDate} />
                  </div>
                </div>
              </>
            )}

            <label className="field-label">Add a note <span style={{ color: '#9ca3af', fontWeight: 400 }}>(Optional)</span></label>
            <textarea
              className="field-textarea field-textarea--tall job-form-modal__note"
              placeholder="Note about the job..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-actions job-form-modal__actions">
          <button type="button" className="btn btn--outline" disabled={isSubmitting} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" disabled={!canSubmit} onClick={handleSubmit}>
            {isSubmitting ? (isEdit ? 'Updating...' : 'Creating...') : isEdit ? 'Update Job' : 'Create Job'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
