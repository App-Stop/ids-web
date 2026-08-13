import { useEffect, useRef, useState } from 'react'
import Modal from './Modal'
import Dropdown from './Dropdown'
import Avatar from './Avatar'
import { Icon } from './icons'
import LocationPickerInput from './LocationPickerInput'
import { crewColors, type Job } from '../../lib/dashboardData'
import { createJob, updateJob, createCrewAssignment, type CreateJobPayload, type UpdateJobPayload, type JobItem } from '../../api/jobApi'
import { type UserItem } from '../../api/crewApi'
import { useCachedFetchers } from '../../hooks/useQueryHooks'
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
  status: string
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
  const [status, setStatus] = useState<string>(job?.status || 'awarded')

  const [assignCrewNow, setAssignCrewNow] = useState(false)
  const [excludeWeekends, setExcludeWeekends] = useState(false)
  const [assignStartDate, setAssignStartDate] = useState<string>(toMdyDate(new Date().toISOString().slice(0, 10)))
  const [assignEndDate, setAssignEndDate] = useState<string>('')
  const [presetId, setPresetId] = useState<string>('')
  const [availableCrews, setAvailableCrews] = useState<AvailableCrewItem[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const { fetchCrewsSummary, fetchJobById } = useCachedFetchers()
  const [apiError, setApiError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const color = job?.color ?? crewColors[0]

  useEffect(() => {
    async function loadData() {
      setIsLoadingData(true)
      try {
        const crewsRes = await fetchCrewsSummary()
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
          const jobRes = await fetchJobById(job.id)
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
            if (j.status) setStatus(j.status)
            const assignedCrew = j.assignToCrew ? (typeof j.assignToCrew === 'object' ? j.assignToCrew._id : j.assignToCrew) : null
            setCrewLeadId(assignedCrew)
          }
        }
      } catch (err) {
        console.error('Failed to fetch modal details:', err)
      } finally {
        setIsLoadingData(false)
      }
    }

    loadData()
  }, [isEdit, job?.id])

  const selectedCrew = availableCrews.find((c) => c.id === crewLeadId)
  const canSubmit = !isSubmitting && !isLoadingData

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
    if (preset.status) setStatus(preset.status)
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
      status,
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
          status: status,
          ...(assignCrewNow && crewLeadId
            ? {
                crewAssignment: {
                  crewId: crewLeadId,
                  startDate: toIsoDate(assignStartDate) || toIsoDate(startDate) || new Date().toISOString().slice(0, 10),
                  endDate: toIsoDate(assignEndDate) || undefined,
                  excludeWeekends: excludeWeekends,
                  note: note.trim() || undefined,
                },
              }
            : {}),
        }
        const res = await createJob(payload)
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
          status: status,
        }
        const res = await updateJob(job.id, patchPayload)
        if (assignCrewNow && crewLeadId && job.id) {
          try {
            await createCrewAssignment(job.id, {
              crewId: crewLeadId,
              startDate: toIsoDate(assignStartDate) || toIsoDate(startDate) || new Date().toISOString().slice(0, 10),
              endDate: toIsoDate(assignEndDate) || undefined,
              excludeWeekends: excludeWeekends,
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
               Job #{job!.jobNo}
            </span>
          )}
        </div>

        {isLoadingData && (
          <div style={{ padding: '0.4rem 0', color: '#6b7280', fontSize: '0.875rem', fontStyle: 'italic' }}>
            Loading job details…
          </div>
        )}

        {apiError && (
          <div className="form-error-alert">
            <Icon.AlertCircle width={18} height={18} />
            <span>{apiError}</span>
          </div>
        )}

        <fieldset disabled={isLoadingData || isSubmitting} style={{ border: 'none', padding: 0, margin: 0, opacity: isLoadingData ? 0.6 : 1 }}>
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
              <div style={{ flex: '0 0 160px' }}>
                <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Job ID Number
                  <span
                    title="Auto-generated if left empty"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      color: '#6366f1',
                      fontWeight: 500,
                      fontSize: '0.75rem',
                      cursor: 'help'
                    }}
                  >
                    <Icon.Sparkles width={12} height={12} />
                    Auto
                  </span>
                </label>
                <input
                  type="number"
                  className={`field-input${fieldErrors.jobIdNumber ? ' field-input--error' : ''}`}
                  placeholder="Optional"
                  value={jobIdNumber}
                  onChange={(e) => setJobIdNumber(e.target.value === '' ? '' : Number(e.target.value))}
                />
                <span style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '3px', display: 'block', lineHeight: 1.2 }}>
                  Auto-generated if left empty
                </span>
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
            <LocationPickerInput
              value={siteAddress}
              onChange={setSiteAddress}
              hasError={Boolean(fieldErrors.siteAddress)}
              placeholder="Start typing address..."
              disabled={isLoadingData || isSubmitting}
            />
            {fieldErrors.siteAddress && <span className="field-error-text">{fieldErrors.siteAddress}</span>}

            <label className="field-label">General Contractor</label>
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
                <label className="field-label">GC Super</label>
                <input
                  className={`field-input${fieldErrors.gcSuper ? ' field-input--error' : ''}`}
                  placeholder="General Contractor Superintendent"
                  value={gcSuper}
                  onChange={(e) => setGcSuper(e.target.value)}
                />
                {fieldErrors.gcSuper && <span className="field-error-text">{fieldErrors.gcSuper}</span>}
              </div>
              <div style={{ flex: 1 }}>
                <label className="field-label">IDS Super</label>
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
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Number(e.target.value)
                      setContractAmount(val)
                      if (val === '') {
                        setLaborBudgetTotal('')
                      } else {
                        setLaborBudgetTotal(Math.round(val * 0.4))
                      }
                    }}
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

            <div style={{ marginTop: '0.85rem' }}>
              <label className="field-label">Status*</label>
              <Dropdown
                value={status}
                placeholder="Select status"
                onChange={(id) => setStatus(id)}
                selectedLabel={
                  status === 'in-progress'
                    ? 'In Progress'
                    : status === 'completed'
                    ? 'Complete'
                    : status === 'awarded'
                    ? 'Awarded'
                    : 'Select status'
                }
                options={[
                  { id: 'awarded', label: 'Awarded' },
                  { id: 'in-progress', label: 'In Progress' },
                  { id: 'completed', label: 'Complete' },
                ]}
              />
              {fieldErrors.status && <span className="field-error-text">{fieldErrors.status}</span>}
            </div>
          </div>

          <div className="job-form-modal__side">
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={assignCrewNow}
                  onChange={(e) => {
                    const checked = e.target.checked
                    setAssignCrewNow(checked)
                    if (checked) {
                      if (startDate) setAssignStartDate(startDate)
                      if (endDate) setAssignEndDate(endDate)
                    }
                  }}
                />
                <span>Assign crew now</span>
              </label>

              {assignCrewNow && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, color: '#475569', marginTop: '8px', marginLeft: '24px' }}>
                  <input
                    type="checkbox"
                    checked={excludeWeekends}
                    onChange={(e) => setExcludeWeekends(e.target.checked)}
                  />
                  <span>Exclude Weekends From Schedule</span>
                </label>
              )}
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
                {fieldErrors['crewAssignment.crewId'] && (
                  <span className="field-error-text">{fieldErrors['crewAssignment.crewId']}</span>
                )}

                <div className="field-row" style={{ marginTop: '12px' }}>
                  <div className={fieldErrors['crewAssignment.startDate'] ? 'field-date--error' : ''}>
                    <label className="field-label">Assignment Start Date*</label>
                    <DatePickerField value={assignStartDate} onChange={setAssignStartDate} />
                    {fieldErrors['crewAssignment.startDate'] && (
                      <span className="field-error-text">{fieldErrors['crewAssignment.startDate']}</span>
                    )}
                  </div>
                  <div className={fieldErrors['crewAssignment.endDate'] ? 'field-date--error' : ''}>
                    <label className="field-label">Assignment End Date</label>
                    <DatePickerField value={assignEndDate} onChange={setAssignEndDate} />
                    {fieldErrors['crewAssignment.endDate'] && (
                      <span className="field-error-text">{fieldErrors['crewAssignment.endDate']}</span>
                    )}
                  </div>
                </div>
              </>
            )}

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
        </fieldset>
      </div>
    </Modal>
  )
}
